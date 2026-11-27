import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { compareExpiry, isIssueAllowedBatch, round3 } from '@/utils/processBatchMath'
import { buildProcessInventoryLots, PROCESS_TANKS } from '@/mock/processInventorySeed'

const STORAGE_KEY = 'i-doms-material-batch-v1'
const SEED_VERSION_KEY = 'i-doms-material-batch-seed-v'
/** v4：演示批带检验结论，便于投料展示 */
/** v7：流程物料补 allowWorkshopStaging / allowRecycle；批次状态含车间暂存 */
const CURRENT_SEED_VERSION = '7'

export const PROCESS_ITEMS = [
  {
    id: 'pi-resin',
    code: 'RM-RESIN',
    name: '醇酸树脂',
    unit: 'kg',
    content: 1,
    kind: 'raw',
    isKeyMaterial: true,
    isAuxiliary: false,
    allowWorkshopStaging: false,
    allowRecycle: false,
  },
  {
    id: 'pi-solvent',
    code: 'RM-SOLVENT',
    name: '溶剂',
    unit: 'kg',
    content: 0.8,
    kind: 'raw',
    isKeyMaterial: false,
    isAuxiliary: false,
    allowWorkshopStaging: false,
    allowRecycle: false,
  },
  {
    id: 'pi-alkyd-base',
    code: 'SF-ALKYD',
    name: '醇酸树脂液',
    unit: 'kg',
    content: 0.5,
    kind: 'fg',
    isKeyMaterial: true,
    isAuxiliary: false,
    allowWorkshopStaging: true,
    allowRecycle: false,
  },
  {
    id: 'pi-pigment',
    code: 'RM-TIO2',
    name: '钛白粉',
    unit: 'kg',
    content: 1,
    kind: 'raw',
    isKeyMaterial: true,
    isAuxiliary: false,
    allowWorkshopStaging: false,
    allowRecycle: false,
  },
  {
    id: 'pi-drier',
    code: 'RM-DRIER',
    name: '催干剂',
    unit: 'kg',
    content: 0.06,
    kind: 'raw',
    isKeyMaterial: false,
    isAuxiliary: true,
    allowWorkshopStaging: false,
    allowRecycle: false,
  },
  {
    id: 'pi-paint',
    code: 'FG-PAINT',
    name: '醇酸面漆',
    unit: 'kg',
    content: 0.55,
    kind: 'fg',
    allowWorkshopStaging: true,
    allowRecycle: false,
  },
  {
    id: 'pi-custom-paint',
    code: 'FG-PAINT-CUS',
    name: '客户指定色漆',
    unit: 'kg',
    content: 0.5,
    kind: 'fg',
    allowWorkshopStaging: true,
    allowRecycle: false,
  },
  {
    id: 'pi-residue',
    code: 'WS-RESIDUE',
    name: '蒸馏残渣',
    unit: 'kg',
    content: 1,
    kind: 'by',
    allowWorkshopStaging: true,
    allowRecycle: false,
  },
  {
    id: 'pi-thinner',
    code: 'BP-THINNER',
    name: '回收稀料',
    unit: 'kg',
    content: 0.7,
    kind: 'by',
    allowWorkshopStaging: true,
    allowRecycle: true,
  },
  {
    id: 'pi-black-powder',
    code: 'RM-LI-BLACK',
    name: '含锂黑粉',
    unit: 'kg',
    content: 0.015,
    kind: 'raw',
    isKeyMaterial: true,
    isAuxiliary: false,
  },
  {
    id: 'pi-sulfuric',
    code: 'RM-H2SO4',
    name: '硫酸',
    unit: 'kg',
    content: 0.98,
    kind: 'raw',
    isKeyMaterial: false,
    isAuxiliary: true,
  },
  {
    id: 'pi-defluor',
    code: 'RM-DEFLUOR',
    name: '除氟剂',
    unit: 'kg',
    content: 1,
    kind: 'raw',
    isKeyMaterial: false,
    isAuxiliary: true,
  },
  {
    id: 'pi-soda',
    code: 'RM-SODA',
    name: '纯碱',
    unit: 'kg',
    content: 0.99,
    kind: 'raw',
    isKeyMaterial: true,
    isAuxiliary: false,
  },
  {
    id: 'pi-caustic',
    code: 'RM-NAOH',
    name: '片碱',
    unit: 'kg',
    content: 0.99,
    kind: 'raw',
    isKeyMaterial: false,
    isAuxiliary: true,
  },
  {
    id: 'pi-pfs',
    code: 'RM-PFS',
    name: '聚合硫酸铁',
    unit: 'kg',
    content: 1,
    kind: 'raw',
    isKeyMaterial: false,
    isAuxiliary: true,
  },
  {
    id: 'pi-licarbon',
    code: 'FG-LIC-IND',
    name: '工业级碳酸锂',
    unit: 'kg',
    content: 0.985,
    kind: 'fg',
  },
  {
    id: 'pi-acid-brine',
    code: 'IM-BRINE-ACID',
    name: '酸浸卤水',
    unit: 'kg',
    content: 0.02,
    kind: 'by',
  },
  {
    id: 'pi-acid-slag',
    code: 'BP-ACID-SLAG',
    name: '酸浸渣',
    unit: 'kg',
    content: 0.003,
    kind: 'by',
  },
  {
    id: 'pi-f-slag',
    code: 'WS-F-SLAG',
    name: '氟钙镁渣',
    unit: 'kg',
    content: 0.005,
    kind: 'by',
  },
  {
    id: 'pi-wash-water',
    code: 'RC-WASH-WATER',
    name: '洗渣水',
    unit: 'kg',
    content: 0.004,
    kind: 'by',
  },
  {
    id: 'pi-mother-liquor',
    code: 'RC-MOTHER-LIQ',
    name: '沉锂母液',
    unit: 'kg',
    content: 0.01,
    kind: 'by',
  },
]

/**
 * 物料批次库存状态（内部）。
 * 产出追溯界面主展示改为「处理状态 / 检单状态」；released 表示仓管已确认入库后的可用库存，不再叫「成品放行」。
 */
export const BATCH_STATUS_LABEL = {
  pending: '待检',
  await_inbound: '待入库',
  await_decide: '待判定',
  await_staging: '车间暂存',
  await_reuse: '待回用',
  await_reextract: '待再提',
  released: '已入库',
  rejected: '已废弃',
  expired: '过期',
}

/** 流程物料默认：成品/副产默认可暂存；回收稀料类默认可回流 */
function defaultItemFlags(item) {
  const kind = String(item?.kind || '')
  const seededStaging = item?.allowWorkshopStaging
  const seededRecycle = item?.allowRecycle
  return {
    allowWorkshopStaging:
      typeof seededStaging === 'boolean' ? seededStaging : kind === 'fg' || kind === 'by',
    allowRecycle: typeof seededRecycle === 'boolean' ? seededRecycle : false,
  }
}

export function getMaterialBatchByNo(batchNo) {
  const no = String(batchNo || '').trim()
  if (!no) return null
  return materialBatchState.batches.find((row) => row.batchNo === no) || null
}

function today() {
  return dayjs().format('YYYY-MM-DD')
}

/** 库存位置（储罐 / 料仓）。储罐可挂接设备台账。 */
export function normalizeStockLocation(row = {}) {
  const kind = row.kind === 'tank' ? 'tank' : 'silo'
  return {
    id: String(row.id || '').trim(),
    name: String(row.name || '').trim(),
    kind,
    capacity: Number(row.capacity) > 0 ? Number(row.capacity) : 0,
    equipmentId: String(row.equipmentId || '').trim(),
    code: String(row.code || '').trim(),
    /** 仓管员/管理员，与仓库 managerName 同语义；入库单取仓管员时会读这里 */
    managerName: String(row.managerName || '').trim(),
    /** mixed=混罐看液位；batch=保住批次身份 */
    stockMode:
      row.stockMode === 'mixed' || row.stockMode === 'batch'
        ? row.stockMode
        : kind === 'tank'
          ? 'batch'
          : 'mixed',
  }
}

/** 按名称或编码找库存位置（入库选储罐时 warehouse 字段存的是位置名）。 */
export function findStockLocationByNameOrCode(nameOrCode) {
  const key = String(nameOrCode || '').trim()
  if (!key) return null
  const upper = key.toUpperCase()
  return (
    materialBatchState.tanks.find((row) => String(row.name || '').trim() === key) ||
    materialBatchState.tanks.find(
      (row) =>
        String(row.code || '')
          .trim()
          .toUpperCase() === upper,
    ) ||
    null
  )
}

function seed() {
  return {
    tanks: PROCESS_TANKS.map((tank) => normalizeStockLocation(tank)),
    batches: buildProcessInventoryLots().map((lot) =>
      batchRow({
        id: lot.id,
        batchNo: lot.batchNo,
        itemId: lot.itemId,
        status: lot.status,
        qty: lot.qty,
        unit: lot.unit,
        supplierBatchNo: lot.supplierBatchNo,
        productionDate: lot.productionDate,
        expiryDate: lot.expiryDate,
        content: lot.content,
        locationId: lot.locationId,
        sourceType: lot.sourceType,
        qcNo: lot.qcNo,
        qcResult: lot.qcResult || '',
        receivedAt: lot.receivedAt,
      }),
    ),
    movements: [],
    /** 流程物料开关覆盖：{ [itemId]: { allowWorkshopStaging, allowRecycle } } */
    itemFlags: {},
  }
}

function batchRow(partial) {
  const item = PROCESS_ITEMS.find((i) => i.id === partial.itemId)
  return {
    unit: item?.unit || 'kg',
    content: null,
    supplierBatchNo: '',
    productionDate: '',
    expiryDate: '',
    sourceType: 'purchase',
    sourceId: '',
    previousBatchId: '',
    qcNo: '',
    qcResult: '',
    receivedAt: '',
    ...partial,
  }
}

function load() {
  try {
    if (localStorage.getItem(SEED_VERSION_KEY) !== CURRENT_SEED_VERSION) return null
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.batches) || !Array.isArray(parsed.tanks)) return null
    return parsed
  } catch {
    return null
  }
}

const loaded = load()
export const materialBatchState = reactive(
  loaded
    ? {
        ...loaded,
        tanks: (loaded.tanks || []).map(normalizeStockLocation),
        itemFlags: loaded.itemFlags && typeof loaded.itemFlags === 'object' ? loaded.itemFlags : {},
      }
    : seed(),
)

watch(
  materialBatchState,
  () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(materialBatchState))
    localStorage.setItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
  },
  { deep: true },
)

function refreshExpiry() {
  const day = today()
  materialBatchState.batches.forEach((b) => {
    if (b.status === 'released' && b.expiryDate && b.expiryDate < day) b.status = 'expired'
  })
}

/** 合并种子与本地覆盖后的流程物料开关 */
export function getProcessItemFlags(itemId) {
  const item = PROCESS_ITEMS.find((i) => i.id === itemId)
  const base = defaultItemFlags(item || {})
  const override = materialBatchState.itemFlags?.[itemId] || {}
  return {
    allowWorkshopStaging:
      typeof override.allowWorkshopStaging === 'boolean'
        ? override.allowWorkshopStaging
        : base.allowWorkshopStaging,
    allowRecycle:
      typeof override.allowRecycle === 'boolean' ? override.allowRecycle : base.allowRecycle,
  }
}

/** 优先读产品/物料主数据同编码字段，没有再回落流程物料开关 */
function resolveMasterProcessFlags(itemId) {
  const item = PROCESS_ITEMS.find((i) => i.id === itemId)
  const code = String(item?.code || '').trim()
  if (code) {
    try {
      const { findMasterItemByCode } = require('@/utils/stockAlertDisplay')
      const hit = findMasterItemByCode(code)?.item
      if (hit && typeof hit.allowWorkshopStaging === 'boolean') {
        return {
          allowWorkshopStaging: hit.allowWorkshopStaging,
          allowRecycle:
            typeof hit.allowRecycle === 'boolean'
              ? hit.allowRecycle
              : getProcessItemFlags(itemId).allowRecycle,
        }
      }
      if (hit && typeof hit.allowRecycle === 'boolean') {
        const flags = getProcessItemFlags(itemId)
        return {
          allowWorkshopStaging: flags.allowWorkshopStaging,
          allowRecycle: hit.allowRecycle,
        }
      }
    } catch {
      /* ignore */
    }
  }
  return getProcessItemFlags(itemId)
}

export function isProcessItemAllowWorkshopStaging(itemId) {
  return resolveMasterProcessFlags(itemId).allowWorkshopStaging
}

export function isProcessItemAllowRecycle(itemId) {
  return resolveMasterProcessFlags(itemId).allowRecycle
}

/** 更新流程物料「允许车间暂存 / 允许回流」 */
export function setProcessItemFlags(itemId, patch = {}) {
  if (!itemId || !PROCESS_ITEMS.some((i) => i.id === itemId)) {
    return { ok: false, message: '物料不存在' }
  }
  const prev = getProcessItemFlags(itemId)
  materialBatchState.itemFlags[itemId] = {
    allowWorkshopStaging:
      typeof patch.allowWorkshopStaging === 'boolean'
        ? patch.allowWorkshopStaging
        : prev.allowWorkshopStaging,
    allowRecycle: typeof patch.allowRecycle === 'boolean' ? patch.allowRecycle : prev.allowRecycle,
  }
  return { ok: true }
}

export function listProcessItems() {
  return PROCESS_ITEMS.map((item) => ({ ...item, ...getProcessItemFlags(item.id) }))
}

export function findProcessItem(id) {
  const item = PROCESS_ITEMS.find((i) => i.id === id)
  if (!item) return null
  return { ...item, ...getProcessItemFlags(item.id) }
}

export function listTanks() {
  return materialBatchState.tanks
}

export function getStockLocation(id) {
  if (!id) return null
  return materialBatchState.tanks.find((row) => row.id === id) || null
}

export function getStockLocationByEquipmentId(equipmentId) {
  if (!equipmentId) return null
  return materialBatchState.tanks.find((row) => row.equipmentId === equipmentId) || null
}

/**
 * 设备台账勾选「作为库存存放点」后同步库存位置：同码/已关联则更新，否则新建。
 * 罐容取公称容积；液位仍由罐内批次汇总，本函数不改结存。
 */
export function upsertTankLocationFromEquipment(device) {
  // 与设备类型解耦：仅 asStockLocation(作为库存存放点) 为真时才同步
  if (!device || !device.asStockLocation) return null
  const deviceId = String(device.id || '').trim()
  if (!deviceId) return null
  const code = String(device.code || '').trim()
  const capacity = Number(device.nominalCapacity) > 0 ? Number(device.nominalCapacity) : 0
  // 库存责任人优先；未填时回落设备责任人，保证入罐单也能带出仓管员
  const managerName = String(device.stockKeeperName || device.responsible || '').trim()
  let tank =
    materialBatchState.tanks.find((row) => row.equipmentId === deviceId) ||
    (device.inventoryLocationId
      ? materialBatchState.tanks.find((row) => row.id === device.inventoryLocationId)
      : null) ||
    (code
      ? materialBatchState.tanks.find(
          (row) =>
            row.kind === 'tank' && String(row.code || '').toUpperCase() === code.toUpperCase(),
        )
      : null)

  if (!tank) {
    tank = normalizeStockLocation({
      id: `loc-${deviceId}`,
      name: device.name || code || '储罐',
      kind: 'tank',
      capacity: capacity || 1,
      equipmentId: deviceId,
      code,
      managerName,
      stockMode: 'batch',
    })
    materialBatchState.tanks.push(tank)
  } else {
    Object.assign(
      tank,
      normalizeStockLocation({
        ...tank,
        name: device.name || tank.name,
        kind: 'tank',
        capacity: capacity > 0 ? capacity : tank.capacity,
        equipmentId: deviceId,
        code: code || tank.code,
        managerName,
        stockMode: tank.stockMode || 'batch',
      }),
    )
  }
  return tank
}

/** 取消「作为库存存放点」时，只解除挂接，不删位置（罐内可能仍有批次）。 */
export function detachTankLocationFromEquipment(equipmentId) {
  const tank = getStockLocationByEquipmentId(equipmentId)
  if (!tank) return null
  tank.equipmentId = ''
  return tank
}

export function tankLevel(locationId) {
  refreshExpiry()
  return round3(
    materialBatchState.batches
      .filter((b) => b.locationId === locationId && Number(b.qty) > 0)
      .reduce((s, b) => s + Number(b.qty), 0),
  )
}

export function tankFree(locationId) {
  const tank = materialBatchState.tanks.find((t) => t.id === locationId)
  if (!tank) return 0
  return round3(Number(tank.capacity) - tankLevel(locationId))
}

function assertCapacity(locationId, addQty) {
  const tank = materialBatchState.tanks.find((t) => t.id === locationId)
  if (!tank) throw new Error('请选择储罐或料仓')
  if (tankLevel(locationId) + Number(addQty) - 1e-9 > Number(tank.capacity)) {
    throw new Error(
      `${tank.name} 罐容 ${tank.capacity}，当前液位 ${tankLevel(locationId)}，装不下 ${addQty}`,
    )
  }
}

export function listMaterialBatches() {
  refreshExpiry()
  return materialBatchState.batches
}

export function getMaterialBatch(id) {
  refreshExpiry()
  return materialBatchState.batches.find((b) => b.id === id) || null
}

/**
 * 待处置产出演示批次：按固定 id 幂等写入，覆盖待判定/车间暂存/待回用/待再提。
 * @returns {Array<object>} 本次保证存在的批次行
 */
export function ensureDemoPendingDispositionBatches() {
  const day = today()
  const defs = [
    {
      id: 'mb-demo-decide-1',
      batchNo: 'BO-DISPOSE-DECIDE-1',
      itemId: 'pi-paint',
      status: 'await_decide',
      disposition: 'pending_decide',
      qty: 120,
      content: 0.55,
      locationId: 'tank-paint',
      sourceType: 'pending_decide',
    },
    {
      // 硬门禁待判定：列表上「确认去向」应禁用，直到化验合格
      id: 'mb-demo-decide-gate',
      batchNo: 'BO-DISPOSE-DECIDE-GATE',
      itemId: 'pi-alkyd-base',
      status: 'await_decide',
      disposition: 'pending_decide',
      qty: 80,
      content: 0.5,
      locationId: 'tank-alkyd',
      sourceType: 'pending_decide',
    },
    {
      id: 'mb-demo-staging-a',
      batchNo: 'BO-DISPOSE-STG-A',
      itemId: 'pi-paint',
      status: 'await_staging',
      disposition: 'staging',
      qty: 60,
      content: 0.55,
      locationId: 'tank-paint',
      sourceType: 'staging',
    },
    {
      // 同物料同含量、不同暂存位置 → 可与 A 勾选合并
      id: 'mb-demo-staging-b',
      batchNo: 'BO-DISPOSE-STG-B',
      itemId: 'pi-paint',
      status: 'await_staging',
      disposition: 'staging',
      qty: 40,
      content: 0.55,
      locationId: 'wh-licarbon',
      sourceType: 'staging',
    },
    {
      // 同物料不同含量 → 不能与 A/B 合并
      id: 'mb-demo-staging-c',
      batchNo: 'BO-DISPOSE-STG-C',
      itemId: 'pi-paint',
      status: 'await_staging',
      disposition: 'staging',
      qty: 30,
      content: 0.5,
      locationId: 'tank-paint',
      sourceType: 'staging',
    },
    {
      id: 'mb-demo-reuse-1',
      batchNo: 'BO-DISPOSE-REUSE-1',
      itemId: 'pi-thinner',
      status: 'await_reuse',
      disposition: 'reuse',
      qty: 25,
      content: 0.7,
      locationId: 'tank-recycle',
      sourceType: 'reuse',
    },
    {
      id: 'mb-demo-reextract-1',
      batchNo: 'BO-DISPOSE-REX-1',
      itemId: 'pi-residue',
      status: 'await_reextract',
      disposition: 'reextract',
      qty: 15,
      content: 1,
      locationId: 'yard-waste',
      sourceType: 'reextract',
    },
  ]

  const ensured = []
  defs.forEach((def) => {
    let row = materialBatchState.batches.find((b) => b.id === def.id)
    if (!row) {
      row = batchRow({
        ...def,
        unit: findProcessItem(def.itemId)?.unit || 'kg',
        productionDate: day,
        expiryDate: dayjs().add(180, 'day').format('YYYY-MM-DD'),
        sourceId: 'bo-demo-dispose',
        supplierBatchNo: '',
        qcNo: '',
        qcResult: '',
        receivedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      })
      materialBatchState.batches.unshift(row)
    } else {
      // 已存在则把演示状态/数量拉回，避免被本地操作改没后列表缺场景
      Object.assign(row, {
        status: def.status,
        disposition: def.disposition,
        qty: def.qty,
        content: def.content,
        locationId: def.locationId,
        sourceType: def.sourceType,
        sourceId: 'bo-demo-dispose',
        itemId: def.itemId,
        batchNo: def.batchNo,
      })
    }
    ensured.push(row)
  })
  return ensured
}

export function listIssueableBatches(itemId) {
  const day = today()
  return listMaterialBatches()
    .filter(
      (b) => (!itemId || b.itemId === itemId) && Number(b.qty) > 0 && isIssueAllowedBatch(b, day),
    )
    .sort(compareExpiry)
}

/**
 * 回流料硬门禁：有产出化验要求且未完成/不合格时，不进入可选列表。
 * 无硬门禁则确认回用后即可选。
 */
function recycleBatchPassesAssayGate(batch) {
  if (!batch?.sourceId) return true
  try {
    const {
      getBatchOrder,
      assertSideOutputAssayAllowsUse,
    } = require('@/store/batchInstructionStore')
    const origin = getBatchOrder(batch.sourceId)
    const output = (origin?.outputs || []).find((row) => row.batchId === batch.id)
    if (!origin || !output) return true
    assertSideOutputAssayAllowsUse(origin, output, { action: '回流投料' })
    return true
  } catch {
    return false
  }
}

/**
 * 投料可选批次。
 * @param {string} [itemId]
 * @param {object} [order]
 * @param {{ source?: 'fresh'|'recycle' }} [options]
 *   fresh 线边新料（可用库存，不含待回用/待再提）
 *   recycle 回流料（待回用；有硬门禁则须化验通过才出现）
 *   再提指令仅允许本单对应的待再提批次
 */
export function listFeedableBatches(itemId, order, options = {}) {
  const day = today()
  const reextractId = order?.reextractOfBatchId || ''
  const source = options.source || (reextractId ? 'reextract' : 'fresh')
  const locationId = String(options.locationId || '').trim()
  return listMaterialBatches()
    .filter((b) => {
      if (itemId && b.itemId !== itemId) return false
      if (locationId && String(b.locationId || '') !== locationId) return false
      if (!(Number(b.qty) > 0)) return false
      if (b.expiryDate && String(b.expiryDate) < day) return false
      if (reextractId) {
        return b.id === reextractId && b.status === 'await_reextract'
      }
      if (source === 'recycle') {
        // 待回用；或「允许回流」物料的车间暂存批
        if (b.status === 'await_reuse') return recycleBatchPassesAssayGate(b)
        if (b.status === 'await_staging' && isProcessItemAllowRecycle(b.itemId)) {
          return recycleBatchPassesAssayGate(b)
        }
        return false
      }
      if (
        b.status === 'await_reuse' ||
        b.status === 'await_reextract' ||
        b.status === 'await_decide' ||
        b.status === 'await_staging' ||
        b.status === 'await_inbound'
      ) {
        return false
      }
      return isIssueAllowedBatch(b, day)
    })
    .sort(compareExpiry)
}

/** 某物料当前可按库位 FEFO 扣减的来源库位（仓/罐），带可扣量。 */
export function listFeedSourceLocations(itemId, order, options = {}) {
  const batches = listFeedableBatches(itemId, order, { ...options, locationId: '' })
  const qtyByLoc = new Map()
  batches.forEach((batch) => {
    const id = String(batch.locationId || '').trim()
    if (!id) return
    qtyByLoc.set(id, round3((qtyByLoc.get(id) || 0) + Number(batch.qty || 0)))
  })
  return listTanks()
    .filter((tank) => qtyByLoc.has(tank.id))
    .map((tank) => {
      const qty = qtyByLoc.get(tank.id) || 0
      const kindLabel = tank.kind === 'tank' ? '储罐' : '仓库'
      return {
        value: tank.id,
        label: `${tank.name}（${kindLabel} · 可扣 ${qty}${batches[0]?.unit || 'kg'}）`,
        kind: tank.kind === 'tank' ? 'tank' : 'silo',
        qty,
      }
    })
}

/**
 * 按库位近效先出（FEFO）拆分投料量：候选批已按失效日期升序；过期批不参与。
 * options.locationId 有值时仅在该库位/罐内扣减。
 */
export function planFeedFifoAllocations(itemId, qty, order, options = {}) {
  const need = round3(qty)
  if (!(need > 0)) return []
  const source = options.source || 'fresh'
  const locationId = String(options.locationId || '').trim()
  const batches = listFeedableBatches(itemId, order, { source, locationId })
  const item = findProcessItem(itemId)
  const name = item?.name || itemId || '物料'
  const locName = locationId
    ? listTanks().find((tank) => tank.id === locationId)?.name || locationId
    : ''
  let left = need
  const rows = []
  for (const batch of batches) {
    if (left <= 1e-9) break
    const available = round3(Number(batch.qty) || 0)
    if (!(available > 0)) continue
    const take = round3(Math.min(available, left))
    rows.push({
      batchId: batch.id,
      batchNo: batch.batchNo,
      qty: take,
      content: batch.content,
      locationId: batch.locationId,
    })
    left = round3(left - take)
  }
  if (left > 1e-9) {
    const have = round3(need - left)
    const where = locName ? `在「${locName}」` : '线边'
    throw new Error(`${name} ${where}可扣量不足（可扣 ${have}，本次 ${need}，还差 ${left}）`)
  }
  return rows
}

function pushMovement(row) {
  materialBatchState.movements.unshift({
    id: `mv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    at: dayjs().format('YYYY-MM-DD HH:mm'),
    ...row,
  })
}

export function receiveMaterialBatch(payload) {
  const item = findProcessItem(payload.itemId)
  if (!item) throw new Error('请选择物料')
  const qty = round3(payload.qty)
  if (!(qty > 0)) throw new Error('收货数量必须大于 0')
  if (!payload.supplierBatchNo?.trim()) throw new Error('请填写供应商批号')
  if (!payload.productionDate) throw new Error('请填写生产日期')
  if (!payload.expiryDate) throw new Error('请填写失效日期')
  assertCapacity(payload.locationId, qty)
  const row = batchRow({
    id: `mb-${Date.now()}`,
    batchNo: `RB${dayjs().format('YYYYMMDDHHmmss')}`,
    itemId: item.id,
    status: 'pending',
    qty,
    unit: item.unit,
    supplierBatchNo: payload.supplierBatchNo.trim(),
    productionDate: payload.productionDate,
    expiryDate: payload.expiryDate,
    content: payload.content != null && payload.content !== '' ? Number(payload.content) : null,
    locationId: payload.locationId,
    sourceType: 'purchase',
  })
  materialBatchState.batches.unshift(row)
  return row
}

export function setBatchStatus(id, status) {
  const row = getMaterialBatch(id)
  if (!row) throw new Error('批次不存在')
  if (status === 'released' && row.expiryDate && row.expiryDate < today()) {
    row.status = 'expired'
    throw new Error('该批次已过期，不能放行')
  }
  row.status = status
  return row
}

export function canConsumeBatchForFeed(batch, order, source) {
  if (!batch) return false
  const day = today()
  if (batch.expiryDate && String(batch.expiryDate) < day) return false
  if (!(Number(batch.qty) > 0)) return false
  if (
    order?.reextractOfBatchId &&
    batch.id === order.reextractOfBatchId &&
    batch.status === 'await_reextract'
  ) {
    return true
  }
  const mode = source || (batch.status === 'await_reuse' ? 'recycle' : 'fresh')
  if (mode === 'recycle') {
    return batch.status === 'await_reuse' && recycleBatchPassesAssayGate(batch)
  }
  if (
    batch.status === 'await_reuse' ||
    batch.status === 'await_reextract' ||
    batch.status === 'await_decide' ||
    batch.status === 'await_inbound'
  ) {
    return false
  }
  if (!isIssueAllowedBatch(batch, day)) return false
  // 流程产出：入库确认后还须过硬门禁检单（如有）
  if (batch.sourceType && batch.sourceType !== 'purchase') {
    try {
      const { isProcessOutputBatchUsable } = require('@/store/batchInstructionStore')
      return isProcessOutputBatchUsable(batch)
    } catch {
      return true
    }
  }
  return true
}

export function consumeBatchQty(id, qty, movement, order, source) {
  const row = getMaterialBatch(id)
  const take = round3(qty)
  if (!row) throw new Error('批次不存在')
  if (!canConsumeBatchForFeed(row, order, source)) {
    throw new Error(
      '线边新料须可用；回流料须已确认回用且通过化验硬门禁（如有）；再提只可用本单待再提批次',
    )
  }
  if (take > Number(row.qty) + 1e-9)
    throw new Error(`批次 ${row.batchNo} 剩余 ${row.qty}，不够扣 ${take}`)
  row.qty = round3(Number(row.qty) - take)
  pushMovement({ type: '投料消耗', batchId: row.id, batchNo: row.batchNo, qty: take, ...movement })
  return row
}

export function addOutputBatch(payload) {
  const qty = round3(payload.qty)
  if (!(qty > 0)) throw new Error('产出数量必须大于 0')
  const tank = materialBatchState.tanks.find((row) => row.id === payload.locationId)
  if (!tank) throw new Error('请选择储罐或料仓')
  const item = findProcessItem(payload.itemId)
  const status = payload.status || 'pending'
  const row = batchRow({
    id: `mb-out-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    batchNo: payload.batchNo,
    itemId: payload.itemId,
    status,
    qty,
    unit: item?.unit || 'kg',
    content: payload.content != null && payload.content !== '' ? Number(payload.content) : null,
    productionDate: today(),
    expiryDate: payload.expiryDate || dayjs().add(180, 'day').format('YYYY-MM-DD'),
    locationId: payload.locationId,
    sourceType: payload.sourceType || 'output',
    sourceId: payload.sourceId || '',
    previousBatchId: payload.previousBatchId || '',
    disposition: payload.disposition || '',
    supplierBatchNo: '',
  })
  materialBatchState.batches.unshift(row)
  pushMovement({
    type: payload.movementType || '产出入库',
    batchId: row.id,
    batchNo: row.batchNo,
    qty,
    locationId: payload.locationId,
    orderId: payload.sourceId,
  })
  return row
}

export function transferTank({ batchId, toLocationId, qty }) {
  const src = getMaterialBatch(batchId)
  const take = round3(qty)
  if (!src) throw new Error('批次不存在')
  if (!(take > 0)) throw new Error('转移数量必须大于 0')
  if (take > Number(src.qty) + 1e-9) throw new Error('转移数量超过批次剩余重量')
  if (src.locationId === toLocationId) throw new Error('源罐和目标罐相同')
  assertCapacity(toLocationId, take)
  src.qty = round3(Number(src.qty) - take)
  const item = findProcessItem(src.itemId)
  const row = batchRow({
    ...src,
    id: `mb-mv-${Date.now()}`,
    batchNo: `${src.batchNo}-T`,
    qty: take,
    locationId: toLocationId,
    unit: item?.unit || src.unit,
    previousBatchId: src.id,
  })
  materialBatchState.batches.unshift(row)
  pushMovement({
    type: '罐间转移',
    batchId: src.id,
    batchNo: src.batchNo,
    qty: take,
    toBatchId: row.id,
    toLocationId,
  })
  return row
}

/** 发货：只出合格且未过期，近效期先出。 */
export function shipByFefo(itemId, qty) {
  const need = round3(qty)
  if (!(need > 0)) throw new Error('发货数量必须大于 0')
  const pools = listIssueableBatches(itemId)
  const available = round3(pools.reduce((s, b) => s + Number(b.qty), 0))
  if (available + 1e-9 < need) throw new Error(`合格且未过期的可用量只有 ${available}`)
  let left = need
  const used = []
  pools.forEach((b) => {
    if (!(left > 0)) return
    const take = round3(Math.min(left, Number(b.qty)))
    b.qty = round3(Number(b.qty) - take)
    left = round3(left - take)
    used.push({ batchId: b.id, batchNo: b.batchNo, qty: take, expiryDate: b.expiryDate })
    pushMovement({ type: '发货', batchId: b.id, batchNo: b.batchNo, qty: take })
  })
  return used
}

export function listMovements() {
  return materialBatchState.movements
}
