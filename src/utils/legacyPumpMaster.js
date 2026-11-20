/** 离散泵演示主数据（产品、产品物料、泵族 SKU）。流程涂料主数据不走这里。 */

const PUMP_SPU_IDS = new Set([
  'spu-isg-001',
  'spu-qj-001',
  'spu-impeller-001',
  'spu-shaft-001',
  'spu-service-001',
])

const PUMP_PART_KEYWORDS = [
  '叶轮',
  '轴承',
  '密封',
  '法兰',
  '螺栓',
  '螺母',
  '蜗壳',
  '联轴器',
  '托架',
  '轴套',
  '口环',
  '导叶',
  '泵',
  '填料',
  '地脚',
  '护罩',
  '止推',
  '吸入室',
  '排出弯管',
  '润滑脂',
  '机械密封',
]

export function isLegacyPumpMaster(row) {
  if (!row || typeof row !== 'object') return false
  const name = String(row.name || '')
  const id = String(row.id || '')
  const code = String(row.code || '')
  if (PUMP_PART_KEYWORDS.some((word) => name.includes(word))) return true
  if (PUMP_SPU_IDS.has(String(row.spuId || '')) || PUMP_SPU_IDS.has(id)) return true
  if (id === 'prod-blank-size-demo' || code === 'CP-BLANK-DEMO') return true
  if (/^prod-000\d{2}$/.test(id)) return true
  if (/^mat-\d{4}$/.test(id) || id.startsWith('mat-bom-') || id.startsWith('mat-std-')) return true
  if (/^CP26100\d{2}$/.test(code)) return true
  if (/^F000[12]-/.test(code) || /^WL\d{6}$/.test(code)) return true
  if (/^0100\d{5}$/.test(code) || code.startsWith('MAT-STD-') || code.startsWith('LH-MAT-')) {
    return true
  }
  return false
}

export function dropLegacyPumpMasters(list) {
  return (Array.isArray(list) ? list : []).filter((row) => !isLegacyPumpMaster(row))
}
