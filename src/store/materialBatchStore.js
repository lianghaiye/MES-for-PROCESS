import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { compareExpiry, isIssueAllowedBatch, round3 } from '@/utils/processBatchMath'

const STORAGE_KEY = 'i-doms-material-batch-v1'

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
  { id: 'pi-paint', code: 'FG-PAINT', name: '醇酸面漆', unit: 'kg', content: 1, kind: 'fg' },
  { id: 'pi-thinner', code: 'BP-THINNER', name: '回收稀料', unit: 'kg', content: 1, kind: 'by' },
]

export const BATCH_STATUS_LABEL = {
  pending: '待检',
  released: '合格',
  rejected: '不合格',
  expired: '过期',
}

function today() {
  return dayjs().format('YYYY-MM-DD')
}

function seed() {
  const far = dayjs().add(400, 'day').format('YYYY-MM-DD')
  const soon = dayjs().add(20, 'day').format('YYYY-MM-DD')
  const past = dayjs().subtract(10, 'day').format('YYYY-MM-DD')
  const prod = dayjs().subtract(15, 'day').format('YYYY-MM-DD')
  return {
    tanks: [
      { id: 'tank-a', name: '原料罐 A', kind: 'tank', capacity: 500 },
      { id: 'tank-b', name: '成品罐 B', kind: 'tank', capacity: 400 },
      { id: 'silo-1', name: '料仓 1', kind: 'silo', capacity: 800 },
    ],
    batches: [
      batchRow({
        id: 'mb-resin-1',
        batchNo: 'RB202611-001',
        itemId: 'pi-resin',
        status: 'released',
        qty: 200,
        supplierBatchNo: 'SUP-R-18',
        productionDate: prod,
        expiryDate: far,
        content: 1,
        locationId: 'tank-a',
        sourceType: 'purchase',
      }),
      batchRow({
        id: 'mb-solvent-pending',
        batchNo: 'RB202611-002',
        itemId: 'pi-solvent',
        status: 'pending',
        qty: 100,
        supplierBatchNo: 'SUP-S-03',
        productionDate: prod,
        expiryDate: far,
        content: 0.75,
        locationId: 'silo-1',
        sourceType: 'purchase',
      }),
      batchRow({
        id: 'mb-solvent-ok',
        batchNo: 'RB202611-003',
        itemId: 'pi-solvent',
        status: 'released',
        qty: 80,
        supplierBatchNo: 'SUP-S-09',
        productionDate: prod,
        expiryDate: soon,
        content: 0.9,
        locationId: 'silo-1',
        sourceType: 'purchase',
      }),
      batchRow({
        id: 'mb-solvent-exp',
        batchNo: 'RB202601-004',
        itemId: 'pi-solvent',
        status: 'released',
        qty: 40,
        supplierBatchNo: 'SUP-S-01',
        productionDate: dayjs().subtract(200, 'day').format('YYYY-MM-DD'),
        expiryDate: past,
        content: 0.7,
        locationId: 'silo-1',
        sourceType: 'purchase',
      }),
    ],
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
    ...partial,
  }
}

function load() {
  try {
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
export const materialBatchState = reactive(loaded || seed())

watch(
  materialBatchState,
  () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(materialBatchState))
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

export function consumeBatchQty(id, qty, movement) {
  const row = getMaterialBatch(id)
  const take = round3(qty)
  if (!row) throw new Error('批次不存在')
  if (!isIssueAllowedBatch(row, today())) throw new Error('只能使用已放行且未过期的合格批次')
  if (take > Number(row.qty) + 1e-9)
    throw new Error(`批次 ${row.batchNo} 剩余 ${row.qty}，不够扣 ${take}`)
  row.qty = round3(Number(row.qty) - take)
  pushMovement({ type: '投料消耗', batchId: row.id, batchNo: row.batchNo, qty: take, ...movement })
  return row
}

export function addOutputBatch(payload) {
  const qty = round3(payload.qty)
  if (!(qty > 0)) throw new Error('产出数量必须大于 0')
  assertCapacity(payload.locationId, qty)
  const item = findProcessItem(payload.itemId)
  const row = batchRow({
    id: `mb-out-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    batchNo: payload.batchNo,
    itemId: payload.itemId,
    status: 'pending',
    qty,
    unit: item?.unit || 'kg',
    content: payload.content != null && payload.content !== '' ? Number(payload.content) : null,
    productionDate: today(),
    expiryDate: payload.expiryDate || dayjs().add(180, 'day').format('YYYY-MM-DD'),
    locationId: payload.locationId,
    sourceType: 'output',
    sourceId: payload.sourceId || '',
    previousBatchId: payload.previousBatchId || '',
    supplierBatchNo: '',
  })
  materialBatchState.batches.unshift(row)
  pushMovement({
    type: '产出入库',
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
