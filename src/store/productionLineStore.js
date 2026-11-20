import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { persistJson, safeSetItem } from '@/utils/safeStorage'
import { positionOptions } from '@/store/employeeGroupStore'
import { getDeviceById } from '@/store/equipmentStore'
import { MOCK_POSITIONS } from '@/mock/processConfigSeed'
import { getUser } from '@/utils/auth'

const STORAGE_KEY = 'i_doms_production_lines'
const SEED_VERSION_KEY = 'i_doms_production_lines_seed_v'
const CURRENT_SEED_VERSION = '4'

function resolveOperatorName() {
  const user = getUser()
  return user?.name || user?.username || user?.realName || 'admin1'
}

export const PRODUCTION_LINE_STATUS = ['使用中', '停用']
export const PRODUCTION_LINE_PATH_MAIN = 'main'
export const PRODUCTION_LINE_PATH_BRANCH = 'branch'
export const PRODUCTION_LINE_PATH_OPTIONS = [
  { value: PRODUCTION_LINE_PATH_MAIN, label: '主线' },
  { value: PRODUCTION_LINE_PATH_BRANCH, label: '支线' },
]

function nowText() {
  return dayjs().format('YYYY-MM-DD HH:mm')
}

function allPositionNames() {
  return [...new Set([...(MOCK_POSITIONS || []), ...(positionOptions || [])].filter(Boolean))]
}

function nextStationId() {
  return `pls-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/** 工段：有序；支线通过 forkAfterSeq / joinBeforeSeq 挂到主线 */
export function createLineStation(partial = {}) {
  const pathKind =
    partial.pathKind === PRODUCTION_LINE_PATH_BRANCH
      ? PRODUCTION_LINE_PATH_BRANCH
      : PRODUCTION_LINE_PATH_MAIN
  const equipmentIds = Array.isArray(partial.equipmentIds)
    ? [...new Set(partial.equipmentIds.filter(Boolean))]
    : []
  const positionNames = Array.isArray(partial.positionNames)
    ? [...new Set(partial.positionNames.map((n) => String(n || '').trim()).filter(Boolean))]
    : []
  return {
    id: partial.id || nextStationId(),
    seq: Number(partial.seq) > 0 ? Number(partial.seq) : 1,
    name: String(partial.name || '').trim(),
    pathKind,
    branchName:
      pathKind === PRODUCTION_LINE_PATH_BRANCH ? String(partial.branchName || '').trim() : '',
    forkAfterSeq:
      pathKind === PRODUCTION_LINE_PATH_BRANCH && Number(partial.forkAfterSeq) > 0
        ? Number(partial.forkAfterSeq)
        : null,
    joinBeforeSeq:
      pathKind === PRODUCTION_LINE_PATH_BRANCH && Number(partial.joinBeforeSeq) > 0
        ? Number(partial.joinBeforeSeq)
        : null,
    equipmentIds,
    positionNames,
  }
}

function collectFromStations(stations) {
  const equipmentIds = []
  const positionNames = []
  ;(stations || []).forEach((st) => {
    ;(st.equipmentIds || []).forEach((id) => {
      if (id && !equipmentIds.includes(id)) equipmentIds.push(id)
    })
    ;(st.positionNames || []).forEach((name) => {
      if (name && !positionNames.includes(name)) positionNames.push(name)
    })
  })
  return { equipmentIds, positionNames }
}

function migrateLegacyStations(row = {}) {
  if (Array.isArray(row.stations) && row.stations.length) {
    return row.stations.map((st, idx) =>
      createLineStation({
        ...st,
        seq: st.seq || idx + 1,
      }),
    )
  }
  // 兼容旧扁平设备/岗位：合成一个主线工段
  const equipmentIds = Array.isArray(row.equipmentIds) ? row.equipmentIds : []
  const positionNames = Array.isArray(row.positionNames) ? row.positionNames : []
  if (!equipmentIds.length && !positionNames.length) return []
  return [
    createLineStation({
      id: `pls-legacy-${row.id || 'x'}`,
      seq: 1,
      name: '工段1',
      pathKind: PRODUCTION_LINE_PATH_MAIN,
      equipmentIds,
      positionNames,
    }),
  ]
}

export function createProductionLineSeed() {
  const t = nowText()
  return [
    {
      id: 'pl-acid-1',
      code: 'PL-ACID-01',
      name: '酸浸 1# 线',
      workshop: '前段车间',
      status: '使用中',
      stations: [
        createLineStation({
          id: 'pls-a1-1',
          seq: 1,
          name: '配料',
          pathKind: 'main',
          equipmentIds: ['eq-d-1'],
          positionNames: ['配料岗'],
        }),
        createLineStation({
          id: 'pls-a1-2',
          seq: 2,
          name: '反应',
          pathKind: 'main',
          equipmentIds: ['eq-d-2'],
          positionNames: ['反应岗'],
        }),
        createLineStation({
          id: 'pls-a1-3',
          seq: 3,
          name: '过滤',
          pathKind: 'main',
          equipmentIds: ['eq-d-3'],
          positionNames: ['分离岗'],
        }),
        createLineStation({
          id: 'pls-a1-2b',
          seq: 4,
          name: '旁路调酸',
          pathKind: 'branch',
          branchName: '支线A',
          forkAfterSeq: 1,
          joinBeforeSeq: 3,
          equipmentIds: ['eq-d-5'],
          positionNames: ['反应岗'],
        }),
      ],
      remark: '主线配料→反应→过滤；配料后可走支线A调酸再汇合过滤',
      createdAt: t,
      updatedAt: t,
    },
    {
      id: 'pl-acid-2',
      code: 'PL-ACID-02',
      name: '酸浸 2# 线',
      workshop: '前段车间',
      status: '使用中',
      stations: [
        createLineStation({
          id: 'pls-a2-1',
          seq: 1,
          name: '反应',
          pathKind: 'main',
          equipmentIds: ['eq-d-2'],
          positionNames: ['反应岗'],
        }),
        createLineStation({
          id: 'pls-a2-2',
          seq: 2,
          name: '离心',
          pathKind: 'main',
          equipmentIds: ['eq-d-4'],
          positionNames: ['分离岗'],
        }),
      ],
      remark: '酸浸备用/并行线',
      createdAt: t,
      updatedAt: t,
    },
    {
      id: 'pl-fill-1',
      code: 'PL-FILL-01',
      name: '灌装线',
      workshop: '后段车间',
      status: '使用中',
      stations: [
        createLineStation({
          id: 'pls-f1-1',
          seq: 1,
          name: '灌装',
          pathKind: 'main',
          equipmentIds: ['eq-d-7'],
          positionNames: ['灌装岗'],
        }),
      ],
      remark: '',
      createdAt: t,
      updatedAt: t,
    },
  ]
}

export function normalizeLine(row = {}) {
  const stations = migrateLegacyStations(row)
    .map((st) => createLineStation(st))
    .sort((a, b) => Number(a.seq) - Number(b.seq))
  const { equipmentIds, positionNames } = collectFromStations(stations)
  return {
    id: row.id || `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    code: String(row.code || '').trim(),
    name: String(row.name || '').trim(),
    workshop: String(row.workshop || '').trim(),
    status: PRODUCTION_LINE_STATUS.includes(row.status) ? row.status : '使用中',
    stations,
    // 汇总字段：便于列表与旧逻辑只读
    equipmentIds,
    positionNames,
    remark: String(row.remark || '').trim(),
    creator: row.creator || '系统管理员',
    createdAt: row.createdAt || nowText(),
    updater: row.updater || row.creator || '系统管理员',
    updatedAt: row.updatedAt || row.createdAt || nowText(),
  }
}

function shouldReseed() {
  return localStorage.getItem(SEED_VERSION_KEY) !== CURRENT_SEED_VERSION
}

function load() {
  try {
    if (shouldReseed()) {
      safeSetItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
      return createProductionLineSeed().map(normalizeLine)
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createProductionLineSeed().map(normalizeLine)
    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed) ? parsed : parsed?.lines
    if (!Array.isArray(list) || !list.length) return createProductionLineSeed().map(normalizeLine)
    return list.map(normalizeLine)
  } catch {
    return createProductionLineSeed().map(normalizeLine)
  }
}

export const productionLineState = reactive({
  lines: load(),
})

watch(
  () => productionLineState.lines,
  () => persistJson(STORAGE_KEY, productionLineState.lines),
  { deep: true },
)

export function listProductionLines(filters = {}) {
  return productionLineState.lines.filter((row) => {
    if (filters.status && row.status !== filters.status) return false
    if (filters.keyword) {
      const kw = String(filters.keyword).trim()
      const hit =
        String(row.code || '').includes(kw) ||
        String(row.name || '').includes(kw) ||
        String(row.workshop || '').includes(kw)
      if (!hit) return false
    }
    return true
  })
}

export function listEnabledProductionLineOptions() {
  return productionLineState.lines
    .filter((row) => row.status === '使用中')
    .map((row) => ({
      value: row.id,
      label: row.code ? `${row.name}（${row.code}）` : row.name,
    }))
}

export function getProductionLineById(id) {
  if (!id) return null
  return productionLineState.lines.find((row) => row.id === id) || null
}

export function formatProductionLineLabel(id) {
  const row = getProductionLineById(id)
  if (!row) return ''
  return row.code ? `${row.name}（${row.code}）` : row.name
}

/** 计划没选产线时，生成批次指令按配方阶段上的设备执行。 */
export function formatPlanLineLabel(id) {
  if (!id) return '按配方设备'
  return formatProductionLineLabel(id) || '—'
}

export function formatDeviceLabel(id) {
  const device = getDeviceById(id)
  if (!device) return ''
  return device.code ? `${device.name}（${device.code}）` : device.name
}

export function formatProductionLineEquipment(line) {
  const ids = line?.equipmentIds || []
  if (!ids.length) return ''
  return ids
    .map((id) => formatDeviceLabel(id))
    .filter(Boolean)
    .join('、')
}

export function formatProductionLinePositions(line) {
  return (line?.positionNames || []).filter(Boolean).join('、')
}

export function formatProductionLineTopology(line) {
  const stations = [...(line?.stations || [])].sort((a, b) => Number(a.seq) - Number(b.seq))
  if (!stations.length) return ''
  const main = stations.filter((s) => s.pathKind !== PRODUCTION_LINE_PATH_BRANCH)
  const branches = stations.filter((s) => s.pathKind === PRODUCTION_LINE_PATH_BRANCH)
  const mainText = main.map((s) => s.name || `工段${s.seq}`).join(' → ')
  if (!branches.length) return mainText
  const branchText = branches
    .map((s) => {
      const label = s.branchName || '支线'
      const span = `自主线#${s.forkAfterSeq || '?'}汇入#${s.joinBeforeSeq || '末'}`
      return `${label}:${s.name || '工段'}（${span}）`
    })
    .join('；')
  return `${mainText}｜${branchText}`
}

/** 拓扑预览：主线节点 + 挂在两段之间的支线 */
export function buildProductionLineTopologyPreview(lineOrStations) {
  const stations = Array.isArray(lineOrStations) ? lineOrStations : lineOrStations?.stations || []
  const list = stations
    .map((st) => createLineStation(st))
    .sort((a, b) => Number(a.seq) - Number(b.seq))
  const main = list.filter((s) => s.pathKind !== PRODUCTION_LINE_PATH_BRANCH)
  const branches = list.filter((s) => s.pathKind === PRODUCTION_LINE_PATH_BRANCH)
  const gaps = main.map((from, i) => ({
    afterStation: from,
    beforeStation: main[i + 1] || null,
    branches: branches.filter((b) => Number(b.forkAfterSeq) === Number(from.seq)),
  }))
  return { main, branches, gaps }
}

function nextCode() {
  const seq =
    productionLineState.lines.reduce((max, row) => {
      const m = String(row.code || '').match(/PL-(\d+)$/i)
      const n = m ? Number(m[1]) : 0
      return Math.max(max, n)
    }, 0) + 1
  return `PL-${String(seq).padStart(2, '0')}`
}

function validateStations(stations) {
  const list = (Array.isArray(stations) ? stations : []).map((st, idx) =>
    createLineStation({ ...st, seq: st.seq || idx + 1 }),
  )
  if (!list.length) return { ok: false, message: '请至少添加一个工段' }
  const main = list
    .filter((s) => s.pathKind !== PRODUCTION_LINE_PATH_BRANCH)
    .sort((a, b) => Number(a.seq) - Number(b.seq))
  if (!main.length) return { ok: false, message: '请至少有一个主线工段' }
  const allowedPos = new Set(allPositionNames())
  for (const st of list) {
    if (!st.name) return { ok: false, message: '工段名称不能为空' }
    if (!st.equipmentIds.length) return { ok: false, message: `工段「${st.name}」请选择设备` }
    for (const id of st.equipmentIds) {
      if (!getDeviceById(id)) return { ok: false, message: `工段「${st.name}」设备无效` }
    }
    const unknown = st.positionNames.find((n) => !allowedPos.has(n))
    if (unknown) return { ok: false, message: `岗位「${unknown}」不在岗位主数据中` }
    if (st.pathKind === PRODUCTION_LINE_PATH_BRANCH) {
      if (!st.branchName) return { ok: false, message: `支线工段「${st.name}」请填写支线名称` }
      if (!(Number(st.forkAfterSeq) > 0)) {
        return { ok: false, message: `支线「${st.branchName}」请选择从哪个主线工段后分出` }
      }
      const forkOk = main.some((m) => Number(m.seq) === Number(st.forkAfterSeq))
      if (!forkOk) return { ok: false, message: `支线「${st.branchName}」的分出点须是主线工段序号` }
      if (st.joinBeforeSeq != null) {
        const joinOk = main.some((m) => Number(m.seq) === Number(st.joinBeforeSeq))
        if (!joinOk)
          return { ok: false, message: `支线「${st.branchName}」的汇合点须是主线工段序号` }
        if (Number(st.joinBeforeSeq) <= Number(st.forkAfterSeq)) {
          return { ok: false, message: `支线「${st.branchName}」汇合点须大于分出点` }
        }
      }
    }
  }

  // 压缩主线序号，并按主线 id 回写支线分出/汇合，避免重排后拓扑断裂
  const oldMainSeqById = new Map(main.map((m) => [m.id, Number(m.seq)]))
  main.forEach((m, i) => {
    m.seq = i + 1
  })
  const newMainSeqById = new Map(main.map((m) => [m.id, Number(m.seq)]))
  const oldToNew = new Map()
  oldMainSeqById.forEach((oldSeq, id) => {
    oldToNew.set(oldSeq, newMainSeqById.get(id))
  })
  const branches = list.filter((s) => s.pathKind === PRODUCTION_LINE_PATH_BRANCH)
  branches.forEach((st) => {
    if (st.forkAfterSeq != null && oldToNew.has(Number(st.forkAfterSeq))) {
      st.forkAfterSeq = oldToNew.get(Number(st.forkAfterSeq))
    }
    if (st.joinBeforeSeq != null && oldToNew.has(Number(st.joinBeforeSeq))) {
      st.joinBeforeSeq = oldToNew.get(Number(st.joinBeforeSeq))
    }
  })

  // 展示序：主线按序；支线插在分出点之后
  const ordered = []
  const placed = new Set()
  main.forEach((m) => {
    ordered.push(m)
    branches
      .filter((b) => Number(b.forkAfterSeq) === Number(m.seq) && !placed.has(b.id))
      .forEach((b) => {
        placed.add(b.id)
        ordered.push(b)
      })
  })
  branches.filter((b) => !placed.has(b.id)).forEach((b) => ordered.push(b))

  // 全局 seq 仅作列表序；支线 fork/join 继续指向「主线序号」（非全局序号）
  // 因此主线 seq 保持 1..n，支线 seq 用小数语义不可行 → 支线 seq = 主线最大 + 支线序
  // 拓扑预览按 forkAfterSeq 挂接，不依赖支线全局 seq 与主线交错。
  let branchSeqBase = main.length
  ordered.forEach((st) => {
    if (st.pathKind === PRODUCTION_LINE_PATH_BRANCH) {
      branchSeqBase += 1
      st.seq = branchSeqBase
    }
  })
  return { ok: true, stations: ordered }
}

function validatePayload(payload, editingId) {
  const name = String(payload.name || '').trim()
  if (!name) return { ok: false, message: '请输入产线名称' }
  const code = String(payload.code || '').trim() || nextCode()
  const dup = productionLineState.lines.find((row) => row.code === code && row.id !== editingId)
  if (dup) return { ok: false, message: '产线编码已存在' }
  const stationCheck = validateStations(payload.stations)
  if (!stationCheck.ok) return stationCheck
  const { equipmentIds, positionNames } = collectFromStations(stationCheck.stations)
  return {
    ok: true,
    data: {
      code,
      name,
      workshop: String(payload.workshop || '').trim(),
      status: PRODUCTION_LINE_STATUS.includes(payload.status) ? payload.status : '使用中',
      stations: stationCheck.stations,
      equipmentIds,
      positionNames,
      remark: String(payload.remark || '').trim(),
    },
  }
}

export function addProductionLine(payload) {
  const checked = validatePayload(payload)
  if (!checked.ok) return checked
  const t = nowText()
  const operator = resolveOperatorName()
  const row = normalizeLine({
    ...checked.data,
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    creator: operator,
    createdAt: t,
    updater: operator,
    updatedAt: t,
  })
  productionLineState.lines.unshift(row)
  return { ok: true, row }
}

export function updateProductionLine(id, payload) {
  const idx = productionLineState.lines.findIndex((row) => row.id === id)
  if (idx < 0) return { ok: false, message: '产线不存在' }
  const checked = validatePayload(payload, id)
  if (!checked.ok) return checked
  const prev = productionLineState.lines[idx]
  const operator = resolveOperatorName()
  productionLineState.lines[idx] = normalizeLine({
    ...prev,
    ...checked.data,
    id: prev.id,
    creator: prev.creator || operator,
    createdAt: prev.createdAt,
    updater: operator,
    updatedAt: nowText(),
  })
  return { ok: true, row: productionLineState.lines[idx] }
}

export function setProductionLineStatus(id, status) {
  const row = getProductionLineById(id)
  if (!row) return { ok: false, message: '产线不存在' }
  if (!PRODUCTION_LINE_STATUS.includes(status)) return { ok: false, message: '状态无效' }
  row.status = status
  row.updater = resolveOperatorName()
  row.updatedAt = nowText()
  return { ok: true, row }
}
