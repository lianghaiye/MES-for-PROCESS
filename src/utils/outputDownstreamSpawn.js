/**
 * 方案 A：配方产出行「下游配方 / 开支线指令」配置归一与展示。
 */

export const DOWNSTREAM_SPAWN_MODE = {
  MANUAL: 'manual',
  AUTO: 'auto',
}

export const DOWNSTREAM_SPAWN_MODE_OPTIONS = [
  { value: DOWNSTREAM_SPAWN_MODE.MANUAL, label: '一键生成' },
  { value: DOWNSTREAM_SPAWN_MODE.AUTO, label: '过账后自动开' },
]

/** 从产出行 / 计划行解析下游开单配置 */
export function normalizeDownstreamSpawn(source = {}) {
  const enabled = Boolean(source.downstreamSpawnEnabled)
  const formulaId = String(source.downstreamFormulaId || '').trim()
  const mode =
    source.downstreamSpawnMode === DOWNSTREAM_SPAWN_MODE.AUTO
      ? DOWNSTREAM_SPAWN_MODE.AUTO
      : DOWNSTREAM_SPAWN_MODE.MANUAL
  if (!enabled) {
    return {
      downstreamSpawnEnabled: false,
      downstreamFormulaId: '',
      downstreamSpawnMode: DOWNSTREAM_SPAWN_MODE.MANUAL,
    }
  }
  return {
    downstreamSpawnEnabled: true,
    downstreamFormulaId: formulaId,
    downstreamSpawnMode: mode,
  }
}

/** 是否具备「可开子令」的配置（不校验批次是否已产出） */
export function hasDownstreamSpawnConfig(row = {}) {
  const cfg = normalizeDownstreamSpawn(row)
  return cfg.downstreamSpawnEnabled && Boolean(cfg.downstreamFormulaId)
}

/** 产出行是否还能开支线（有批、已配下游、尚未开过） */
export function canSpawnBranchFromOutput(outputRow = {}) {
  if (!hasDownstreamSpawnConfig(outputRow)) return false
  if (!outputRow.batchId) return false
  if (outputRow.branchOrderId) return false
  return true
}
