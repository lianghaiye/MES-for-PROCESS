/**
 * 入库单「批次详情」展示：合并库存批次（stockBatch）与流程产出批次（materialBatch）。
 */
import { stockBatchState } from '@/store/stockBatchStore'
import {
  BATCH_STATUS_LABEL,
  findProcessItem,
  listTanks,
  materialBatchState,
} from '@/store/materialBatchStore'
import { getWarehouseSelectOptions } from '@/store/warehouseStore'

function locationName(locationId) {
  const tank = listTanks().find((row) => row.id === locationId)
  if (!tank) return ''
  const kindLabel = tank.kind === 'tank' ? '储罐' : '料仓'
  return `${tank.name}（${kindLabel}）`
}

function mapProcessBatch(batch) {
  const item = findProcessItem(batch.itemId)
  return {
    id: batch.id,
    batchNo: batch.batchNo,
    itemCode: item?.code || '',
    itemName: item?.name || '',
    warehouse: locationName(batch.locationId) || '',
    currentLength: batch.qty,
    unit: batch.unit || item?.unit || '',
    status: BATCH_STATUS_LABEL[batch.status] || batch.status || '—',
    sourceType: batch.sourceType || '生产入库',
    salesOrderNo: '',
    attrs: {
      content: batch.content,
      manageByPiece: false,
    },
    _process: true,
  }
}

/** 入库单关联的全部可展示批次（库存台账 + 流程批次） */
export function listInboundDisplayBatches(order) {
  const docNo = order?.docNo
  if (!docNo) return []

  const fromLineBatchNos = new Set()
  const barcodeNos = new Set()
  ;(order.lineItems || []).forEach((line) => {
    ;(line.batchNos || []).forEach((no) => {
      if (no) fromLineBatchNos.add(String(no))
    })
    if (line.barcodeBatchNo) barcodeNos.add(String(line.barcodeBatchNo))
  })

  const stock = (stockBatchState.batches || []).filter((b) => {
    if (b.sourceDocNo === docNo) return true
    if (fromLineBatchNos.size && fromLineBatchNos.has(String(b.batchNo))) return true
    return false
  })

  void materialBatchState.batches
  const process = (materialBatchState.batches || [])
    .filter((b) => {
      const no = String(b.batchNo || '')
      if (barcodeNos.has(no) || fromLineBatchNos.has(no)) return true
      if (
        order.sourceType === '批次指令' &&
        order.sourceOrderNo &&
        b.sourceDocNo === order.sourceOrderNo
      ) {
        return true
      }
      return false
    })
    .map(mapProcessBatch)

  const seen = new Set(stock.map((b) => String(b.batchNo)))
  const merged = [...stock]
  process.forEach((b) => {
    if (seen.has(String(b.batchNo))) return
    seen.add(String(b.batchNo))
    merged.push(b)
  })
  return merged
}

/** 按入库明细分组展示 */
export function groupInboundDisplayBatches(order, allBatches) {
  const lines = order?.lineItems || []
  const usedBatchIds = new Set()

  const groups = lines.map((line, index) => {
    const code = line.itemCode || ''
    const lineBatchNos = new Set()
    ;(line.batchNos || []).forEach((no) => {
      if (no) lineBatchNos.add(String(no))
    })
    if (line.barcodeBatchNo) lineBatchNos.add(String(line.barcodeBatchNo))

    const batches = (allBatches || []).filter((b) => {
      if (usedBatchIds.has(b.id)) return false
      const matchByNo = lineBatchNos.size && lineBatchNos.has(String(b.batchNo))
      const matchByCode = code && b.itemCode === code
      if (matchByNo || matchByCode) {
        usedBatchIds.add(b.id)
        return true
      }
      return false
    })

    return {
      key: line.id || `${code || 'line'}-${index}`,
      itemCode: code,
      itemName: line.itemName || '',
      material: line.material || '',
      unit: line.stockUnit || line.unit || '',
      batches,
    }
  })

  const orphanBatches = (allBatches || []).filter((b) => !usedBatchIds.has(b.id))
  if (orphanBatches.length) {
    groups.push({
      key: 'orphan-batches',
      itemCode: '',
      itemName: '其他批次',
      material: '',
      unit: '',
      batches: orphanBatches,
    })
  }
  return groups
}

/** 入库位置类型：仓库 / 储罐 */
export const INBOUND_LOCATION_TYPE = {
  WAREHOUSE: 'warehouse',
  TANK: 'tank',
}

export const inboundLocationTypeOptions = [
  { label: '仓库', value: INBOUND_LOCATION_TYPE.WAREHOUSE },
  { label: '储罐', value: INBOUND_LOCATION_TYPE.TANK },
]

/**
 * 入库位置下拉。
 * - warehouse：仓库主数据
 * - tank：库存位置中 kind=tank 的储罐（含设备台账勾选「作为库存存放点」同步进来的罐）
 */
export function getInboundLocationSelectOptions(locationType = INBOUND_LOCATION_TYPE.WAREHOUSE) {
  void materialBatchState.tanks
  if (locationType === INBOUND_LOCATION_TYPE.TANK) {
    return listTanks()
      .filter((tank) => tank.kind === 'tank')
      .map((tank) => ({
        value: tank.name,
        label: tank.code ? `${tank.name}（${tank.code}）` : tank.name,
      }))
  }
  return getWarehouseSelectOptions() || []
}

/** 根据已选位置名反推类型（编辑回填用） */
export function resolveInboundLocationType(locationName) {
  const name = String(locationName || '').trim()
  if (!name) return INBOUND_LOCATION_TYPE.WAREHOUSE
  const hit = listTanks().find((tank) => tank.kind === 'tank' && tank.name === name)
  return hit ? INBOUND_LOCATION_TYPE.TANK : INBOUND_LOCATION_TYPE.WAREHOUSE
}
