/**
 * 方案 A：配方产出行「下游配方 / 开支线指令」配置归一与展示。
 * 可配多个下游配方；多于 1 个时只能手动生成（现场选配方），不能自动开。
 */

export const DOWNSTREAM_SPAWN_MODE = {
  MANUAL: 'manual',
  AUTO: 'auto',
}

export const DOWNSTREAM_SPAWN_MODE_OPTIONS = [
  { value: DOWNSTREAM_SPAWN_MODE.MANUAL, label: '手动生成（登产出后点「开支线指令」）' },
  { value: DOWNSTREAM_SPAWN_MODE.AUTO, label: '过账后自动开（仅限唯一下游配方）' },
]

/** 归一下游配方 id 列表（兼容旧字段 downstreamFormulaId 单值） */
export function listDownstreamFormulaIds(source = {}) {
  if (Array.isArray(source.downstreamFormulaIds)) {
    return [
      ...new Set(source.downstreamFormulaIds.map((id) => String(id || '').trim()).filter(Boolean)),
    ]
  }
  const one = String(source.downstreamFormulaId || '').trim()
  return one ? [one] : []
}

/**
 * 从产出行 / 计划行解析下游开单配置。
 * 多个下游时强制 manual，并保留 ids + 兼容字段 formulaId=第一项。
 */
export function normalizeDownstreamSpawn(source = {}) {
  const enabled = Boolean(source.downstreamSpawnEnabled)
  const ids = listDownstreamFormulaIds(source)
  let mode =
    source.downstreamSpawnMode === DOWNSTREAM_SPAWN_MODE.AUTO
      ? DOWNSTREAM_SPAWN_MODE.AUTO
      : DOWNSTREAM_SPAWN_MODE.MANUAL
  // 多个下游无法自动选配方 → 强制手动
  if (ids.length !== 1) mode = DOWNSTREAM_SPAWN_MODE.MANUAL
  if (!enabled) {
    return {
      downstreamSpawnEnabled: false,
      downstreamFormulaIds: [],
      downstreamFormulaId: '',
      downstreamSpawnMode: DOWNSTREAM_SPAWN_MODE.MANUAL,
    }
  }
  return {
    downstreamSpawnEnabled: true,
    downstreamFormulaIds: ids,
    downstreamFormulaId: ids[0] || '',
    downstreamSpawnMode: mode,
  }
}

/** 是否具备「可开子令」的配置（不校验批次是否已产出） */
export function hasDownstreamSpawnConfig(row = {}) {
  const cfg = normalizeDownstreamSpawn(row)
  return cfg.downstreamSpawnEnabled && cfg.downstreamFormulaIds.length > 0
}

/** 是否允许自动开（启用 + 恰好一个下游 + 模式 auto） */
export function canAutoSpawnBranch(row = {}) {
  const cfg = normalizeDownstreamSpawn(row)
  return (
    cfg.downstreamSpawnEnabled &&
    cfg.downstreamFormulaIds.length === 1 &&
    cfg.downstreamSpawnMode === DOWNSTREAM_SPAWN_MODE.AUTO
  )
}

/** 产出行是否还能开支线（有批、已配下游、尚未开过） */
export function canSpawnBranchFromOutput(outputRow = {}) {
  if (!hasDownstreamSpawnConfig(outputRow)) return false
  if (!outputRow.batchId) return false
  if (outputRow.branchOrderId) return false
  return true
}

/** 开单方式下拉：多配方时只留手动生成 */
export function downstreamSpawnModeOptionsFor(ids = []) {
  const list = Array.isArray(ids) ? ids : []
  if (list.length > 1) {
    return DOWNSTREAM_SPAWN_MODE_OPTIONS.filter((o) => o.value === DOWNSTREAM_SPAWN_MODE.MANUAL)
  }
  return DOWNSTREAM_SPAWN_MODE_OPTIONS
}
