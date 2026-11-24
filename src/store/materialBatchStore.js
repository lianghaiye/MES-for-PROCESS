import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { compareExpiry, isIssueAllowedBatch, round3 } from '@/utils/processBatchMath'
import { buildProcessInventoryLots, PROCESS_TANKS } from '@/mock/processInventorySeed'

const STORAGE_KEY = 'i-doms-material-batch-v1'
const SEED_VERSION_KEY = 'i-doms-material-batch-seed-v'
/** v4：演示批带检验结论，便于投料展示 */
const CURRENT_SEED_VERSION = '5'

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
  },
  { id: 'pi-paint', code: 'FG-PAINT', name: '醇酸面漆', unit: 'kg', content: 0.55, kind: 'fg' },
  {
    id: 'pi-custom-paint',
    code: 'FG-PAINT-CUS',
    name: '客户指定色漆',
    unit: 'kg',
    content: 0.5,
    kind: 'fg',
  },
  { id: 'pi-residue', code: 'WS-RESIDUE', name: '蒸馏残渣', unit: 'kg', content: 1, kind: 'by' },
  { id: 'pi-thinner', code: 'BP-THINNER', name: '回收稀料', unit: 'kg', content: 0.7, kind: 'by' },
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

/** 批次放行/库存状态。与化验单「检验结论」分开，避免都叫合格。 */
export const BATCH_STATUS_LABEL = {
  pending: '待检',
  await_decide: '待判定',
  await_reuse: '待回用',
  await_reextract: '待再提',
  released: '已放行',
  rejected: '已拒收',
  expired: '过期',
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
    /** mixed=混罐看液位；batch=保住批次身份 */
    stockMode:
      row.stockMode === 'mixed' || row.stockMode === 'batch'
        ? row.stockMode
        : kind === 'tank'
          ? 'batch'
          : 'mixed',
  }
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

export function listProcessItems() {
  return PROCESS_ITEMS
}

export function findProcessItem(id) {
  return PROCESS_ITEMS.find((i) => i.id === id) || null
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
 * 设备台账「储罐」同步库存位置：同码/已关联则更新，否则新建。
 * 罐容取公称容积；液位仍由罐内批次汇总，本函数不改结存。
 */
export function upsertTankLocationFromEquipment(device) {
  if (!device || String(device.category || '') !== '储罐') return null
  const deviceId = String(device.id || '').trim()
  if (!deviceId) return null
  const code = String(device.code || '').trim()
  const capacity = Number(device.nominalCapacity) > 0 ? Number(device.nominalCapacity) : 0
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
        stockMode: tank.stockMode || 'batch',
      }),
    )
  }
  return tank
}

/** 设备不再是储罐时，只解除挂接，不删位置（罐内可能仍有批次）。 */
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
    assertSideOutputAssayAllowsUse(origin, output)
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
        return b.status === 'await_reuse' && recycleBatchPassesAssayGate(b)
      }
      if (
        b.status === 'await_reuse' ||
        b.status === 'await_reextract' ||
        b.status === 'await_decide'
      ) {
        return false
      }
      return isIssueAllowedBatch(b, day)
    })
    .sort(compareExpiry)
}

/** 某物料当前可 FIFO 扣减的来源库位（仓/罐），带可扣量。 */
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
 * 按库位先进先出拆分投料量（先失效日，再余量）。
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
    batch.status === 'await_decide'
  ) {
    return false
  }
  return isIssueAllowedBatch(batch, day)
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
