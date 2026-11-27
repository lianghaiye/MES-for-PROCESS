/**
 * 批令阶段「本次启用」与时序门禁（无 any/all）。
 * pathKind 来自配方挂接的工艺路线拓扑；仅支线可对本单关闭。
 */

import { ROUTE_PATH_BRANCH, ROUTE_PATH_MAIN, ROUTE_PATH_SINK } from '@/utils/processRouteTopology'

/** 阶段是否对本单启用（默认 true） */
export function isStepEnabledOnOrder(step) {
  if (!step) return false
  return step.enabledOnOrder !== false
}

/** 是否允许在批令上切换「本次启用」（仅支线） */
export function canToggleStepEnabled(step) {
  return String(step?.pathKind || '') === ROUTE_PATH_BRANCH
}

/** 归一 pathKind；未知按主线（不可关） */
export function normalizeStepPathKind(value) {
  const v = String(value || '').trim()
  if (v === ROUTE_PATH_BRANCH || v === ROUTE_PATH_SINK) return v
  return ROUTE_PATH_MAIN
}

/**
 * 按工序 processId 一对一匹配路线节点，给配方阶段打 pathKind。
 * 同工序多节点：按路线 nodes 顺序依次消费。
 */
export function annotateStepsWithRoutePathKind(steps = [], route = null) {
  const nodes = Array.isArray(route?.nodes) ? [...route.nodes] : []
  const pool = nodes.map((n) => ({ ...n }))
  return (steps || []).map((step) => {
    const pid = String(step.processId || '').trim()
    let matched = null
    if (pid) {
      const idx = pool.findIndex((n) => String(n.processId || '').trim() === pid)
      if (idx >= 0) matched = pool.splice(idx, 1)[0]
    }
    const pathKind = matched
      ? normalizeStepPathKind(matched.pathKind)
      : normalizeStepPathKind(step.pathKind)
    return {
      ...step,
      pathKind,
      routeNodeId: matched?.id || step.routeNodeId || '',
      // 默认启用；已有快照上的关闭态保留
      enabledOnOrder: step.enabledOnOrder === false ? false : true,
    }
  })
}

/** 按 stepNo 排序 */
export function sortedSnapshotSteps(steps = []) {
  return [...(steps || [])].sort((a, b) => Number(a.stepNo) - Number(b.stepNo))
}

/** 主线/汇合点：构成串行脊；支线不挡后续主线 */
function isSerialSpine(step) {
  const kind = normalizeStepPathKind(step?.pathKind)
  return kind === ROUTE_PATH_MAIN || kind === ROUTE_PATH_SINK
}

/**
 * 开启阶段时序时：只卡「启用」阶段；支线互不挡、也不挡后续主线。
 * 支线确认：须最近一条启用的主线/汇合点已确认。
 * 主线/汇合点确认：须最近一条启用的主线/汇合点已确认（中间支线忽略）。
 */
export function enabledStepSequenceErrors(order, step) {
  const errors = []
  if (!order || !step) return errors
  if (!isStepEnabledOnOrder(step)) {
    errors.push('本阶段已对本单关闭，无需确认')
    return errors
  }
  const steps = sortedSnapshotSteps(order.routeSnapshot || [])
  const index = steps.findIndex((row) => Number(row.stepNo) === Number(step.stepNo))
  if (index <= 0) return errors

  const confirmed = new Set((order.confirmedSteps || []).map((n) => Number(n)))
  // 向前找最近一条仍启用的串行脊（主线/汇合点）
  let gate = null
  for (let i = index - 1; i >= 0; i -= 1) {
    const prev = steps[i]
    if (!isStepEnabledOnOrder(prev)) continue
    if (isSerialSpine(prev)) {
      gate = prev
      break
    }
    // 当前也是支线时，同为支线的前序不构成门禁（互不强制先后）
  }
  if (!gate) return errors
  if (!confirmed.has(Number(gate.stepNo))) {
    const label = gate.name || gate.processName || `步骤${gate.stepNo}`
    errors.push(`请先确认上一步「${label}」`)
  }
  return errors
}

/** 完工：仅要求仍启用的阶段都已确认 */
export function allEnabledStepsConfirmed(order) {
  const steps = order?.routeSnapshot || []
  if (!steps.length) return false
  const confirmed = new Set((order.confirmedSteps || []).map((n) => Number(n)))
  return steps.filter((s) => isStepEnabledOnOrder(s)).every((s) => confirmed.has(Number(s.stepNo)))
}

/**
 * 切换支线阶段启用态；关时顺带从已确认列表去掉该步（避免脏数据）。
 * @returns {{ ok: boolean, message?: string }}
 */
export function applyStepEnabledOnOrder(order, stepNo, enabled) {
  if (!order?.routeSnapshot) return { ok: false, message: '指令不存在' }
  const step = order.routeSnapshot.find((s) => Number(s.stepNo) === Number(stepNo))
  if (!step) return { ok: false, message: '阶段不存在' }
  if (!canToggleStepEnabled(step)) {
    return { ok: false, message: '仅支线阶段可对本单关闭' }
  }
  step.enabledOnOrder = Boolean(enabled)
  if (!step.enabledOnOrder && Array.isArray(order.confirmedSteps)) {
    order.confirmedSteps = order.confirmedSteps.filter((n) => Number(n) !== Number(stepNo))
  }
  return { ok: true }
}
