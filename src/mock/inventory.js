/** 采购选库存时按编码取现存量。数量与流程库存批次一致。 */
import { buildProcessInventoryLots } from '@/mock/processInventorySeed'

const totals = new Map()
buildProcessInventoryLots().forEach((lot) => {
  const prev = totals.get(lot.itemCode)
  totals.set(lot.itemCode, {
    code: lot.itemCode,
    name: lot.itemName,
    specModel: lot.specModel,
    unit: lot.unit,
    stockQty: (prev?.stockQty || 0) + lot.qty,
  })
})

export const mockInventory = [...totals.values()]
