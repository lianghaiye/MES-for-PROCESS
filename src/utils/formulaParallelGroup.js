/**
 * 配方工艺阶段并行组：同组并行确认，组后按下 joinMode 汇合。
 * any = 组内完成一条即可；all = 全部完成才汇合。默认 any。
 */

export const PARALLEL_JOIN_MODE = {
  ANY: 'any',
  ALL: 'all',
}

export const PARALLEL_JOIN_MODE_OPTIONS = [
  { value: PARALLEL_JOIN_MODE.ANY, label: '组内完成一条即可' },
  { value: PARALLEL_JOIN_MODE.ALL, label: '全部完成才汇合' },
]

export function normalizeParallelGroupId(value) {
  return String(value || '').trim()
}

export function normalizeJoinMode(value) {
  return value === PARALLEL_JOIN_MODE.ALL ? PARALLEL_JOIN_MODE.ALL : PARALLEL_JOIN_MODE.ANY
}

/** 同组字段归一：有组则带 joinMode；无组则清空 */
export function normalizeStepParallelFields(step = {}) {
  const parallelGroupId = normalizeParallelGroupId(step.parallelGroupId)
  if (!parallelGroupId) {
    return { parallelGroupId: '', joinMode: '' }
  }
  return {
    parallelGroupId,
    joinMode: normalizeJoinMode(step.joinMode),
  }
}

/**
 * 校验并行组：同组 joinMode 必须一致；单成员组允许但无汇合意义。
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateParallelGroups(steps = []) {
  const byGroup = new Map()
  ;(steps || []).forEach((step, index) => {
    const id = normalizeParallelGroupId(step.parallelGroupId)
    if (!id) return
    const mode = normalizeJoinMode(step.joinMode)
    if (!byGroup.has(id)) byGroup.set(id, [])
    byGroup.get(id).push({ index, mode, name: step.name || `阶段${index + 1}` })
  })
  for (const [id, members] of byGroup.entries()) {
    const modes = [...new Set(members.map((m) => m.mode))]
    if (modes.length > 1) {
      return { ok: false, message: `并行组「${id}」的汇合方式须一致` }
    }
  }
  return { ok: true }
}

/** 按 stepNo 排序后的快照步骤 */
export function sortedSnapshotSteps(steps = []) {
  return [...(steps || [])].sort((a, b) => Number(a.stepNo) - Number(b.stepNo))
}

/**
 * 确认本步前的时序/汇合错误（开启阶段时序时由调用方启用）。
 * @returns {string[]}
 */
export function parallelGroupSequenceErrors(order, step) {
  const errors = []
  if (!order || !step) return errors
  const steps = sortedSnapshotSteps(order.routeSnapshot || [])
  const index = steps.findIndex((row) => Number(row.stepNo) === Number(step.stepNo))
  if (index < 0) return errors

  const confirmed = new Set((order.confirmedSteps || []).map((n) => Number(n)))
  const groupId = normalizeParallelGroupId(step.parallelGroupId)
  const peers = groupId
    ? steps.filter((row) => normalizeParallelGroupId(row.parallelGroupId) === groupId)
    : []

  // 组内：只要求「组前」已满足，不要求同组兄弟已确认
  if (groupId && peers.length) {
    const firstPeerIndex = Math.min(
      ...peers.map((p) => steps.findIndex((row) => Number(row.stepNo) === Number(p.stepNo))),
    )
    if (firstPeerIndex > 0) {
      const gate = joinGateErrorsForIndex(steps, firstPeerIndex, confirmed)
      errors.push(...gate)
    }
    return errors
  }

  // 组外串行：检查紧前阶段（若紧前在某并行组，按该组汇合方式）
  if (index <= 0) return errors
  errors.push(...joinGateErrorsForIndex(steps, index, confirmed))
  return errors
}

/**
 * 进入 steps[index] 之前，其前方序是否已满足。
 * 若前方是并行组末尾之后的第一刀，则按该组 joinMode 检查整组。
 */
function joinGateErrorsForIndex(steps, index, confirmed) {
  const errors = []
  if (index <= 0) return errors
  const prev = steps[index - 1]
  const prevGroup = normalizeParallelGroupId(prev.parallelGroupId)
  const currGroup = normalizeParallelGroupId(steps[index].parallelGroupId)

  // 仍在同一并行组内：不拦（组内并行）
  if (prevGroup && prevGroup === currGroup) return errors

  if (prevGroup) {
    const peers = steps.filter((row) => normalizeParallelGroupId(row.parallelGroupId) === prevGroup)
    const mode = normalizeJoinMode(peers[0]?.joinMode || prev.joinMode)
    const confirmedPeers = peers.filter((p) => confirmed.has(Number(p.stepNo)))
    if (mode === PARALLEL_JOIN_MODE.ALL) {
      const pending = peers.filter((p) => !confirmed.has(Number(p.stepNo)))
      if (pending.length) {
        const names = pending.map((p) => p.name || p.processName || `步骤${p.stepNo}`).join('、')
        errors.push(`并行组须全部完成才能继续，待确认：${names}`)
      }
    } else if (!confirmedPeers.length) {
      const names = peers.map((p) => p.name || p.processName || `步骤${p.stepNo}`).join('或')
      errors.push(`请先完成并行组中至少一步（${names}）`)
    }
    return errors
  }

  // 紧前为普通串行阶段
  if (!confirmed.has(Number(prev.stepNo))) {
    const prevLabel = prev.name || prev.processName || `步骤${prev.stepNo}`
    errors.push(`请先确认上一步「${prevLabel}」`)
  }
  return errors
}

export function formatJoinModeLabel(mode) {
  const m = normalizeJoinMode(mode)
  return PARALLEL_JOIN_MODE_OPTIONS.find((o) => o.value === m)?.label || m
}
