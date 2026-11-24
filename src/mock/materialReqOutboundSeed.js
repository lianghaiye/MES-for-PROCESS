import { createOutboundLine, createOutboundOrder } from '@/mock/outboundOrders'

/** 与流程领料演示单对应的领料出库单 */
export function createMaterialReqOutboundOrders() {
  return [
    createOutboundOrder({
      id: 'ob-mr-seed-002',
      docNo: 'OUT202611180102',
      outboundType: '领料出库',
      warehouse: '原料仓',
      receiveWarehouse: '库线边仓',
      requisitionDept: '配漆车间',
      workshop: '配漆车间',
      sourceOrderNo: 'BO-DEMO-ALKYD',
      materialReqId: 'mr-seed-002',
      materialReqNo: 'ML202611180002',
      status: '待出库',
      createdAt: '2026-11-18',
      outboundTime: '2026-11-18 10:12:00',
      remark: '领料申请：树脂液批次备料，待仓库出库',
      workOrders: [],
      lineItems: [
        createOutboundLine({
          id: 'ob-mr-seed-002-l1',
          itemId: 'pi-resin',
          itemCode: 'RM-RESIN',
          itemName: '醇酸树脂',
          specModel: '固体分 100%',
          shipQty: 18,
          unit: 'kg',
          shipWarehouse: '原料仓',
          lineSource: '批次指令',
          sourceDocNo: 'BO-DEMO-ALKYD',
          workOrderNo: 'BO-DEMO-ALKYD',
        }),
        createOutboundLine({
          id: 'ob-mr-seed-002-l2',
          itemId: 'pi-solvent',
          itemCode: 'RM-SOLVENT',
          itemName: '溶剂',
          specModel: '二甲苯 含量 80%',
          shipQty: 12,
          unit: 'kg',
          shipWarehouse: '原料仓',
          lineSource: '批次指令',
          sourceDocNo: 'BO-DEMO-ALKYD',
          workOrderNo: 'BO-DEMO-ALKYD',
        }),
      ],
    }),
    createOutboundOrder({
      id: 'ob-mr-seed-003',
      docNo: 'OUT202611190103',
      outboundType: '领料出库',
      warehouse: '原料仓',
      receiveWarehouse: '库线边仓',
      requisitionDept: '反应车间',
      workshop: '反应车间',
      sourceOrderNo: 'ML202611190001',
      materialReqId: 'mr-seed-003',
      materialReqNo: 'ML202611190001',
      status: '已出库',
      createdAt: '2026-11-19',
      completedAt: '2026-11-19',
      outboundTime: '2026-11-19 11:20:00',
      remark: '领料申请：补催干剂，不指定批次指令',
      workOrders: [],
      lineItems: [
        createOutboundLine({
          id: 'ob-mr-seed-003-l1',
          itemId: 'pi-drier',
          itemCode: 'RM-DRIER',
          itemName: '催干剂',
          specModel: '钴含量 6%',
          shipQty: 2,
          unit: 'kg',
          shipWarehouse: '原料仓',
          lineSource: '手工添加',
          sourceDocNo: 'ML202611190001',
          lineStatus: '已出库',
          issuedBatchNo: 'RB20261119001、RB20261119002',
          pickedBatchNo: 'RB20261119001',
          batchAllocations: [
            { batchNo: 'RB20261119001', qty: 1.2 },
            { batchNo: 'RB20261119002', qty: 0.8 },
          ],
        }),
      ],
    }),
  ]
}

export function ensureMaterialReqOutboundOrders(orders = []) {
  const seeds = createMaterialReqOutboundOrders()
  const seedIds = new Set(seeds.map((row) => row.id))
  const list = (orders || []).filter((order) => {
    const id = String(order?.id || '')
    return !(id.startsWith('ob-mr-seed-') && !seedIds.has(id))
  })
  const indexById = new Map(list.map((order, index) => [order.id, index]))
  seeds.forEach((seed) => {
    const index = indexById.get(seed.id)
    if (index == null) {
      list.unshift(seed)
      return
    }
    list[index] = seed
  })
  return list
}
