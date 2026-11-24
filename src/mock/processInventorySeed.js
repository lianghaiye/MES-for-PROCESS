/**
 * 按产品 / 配方主数据生成库存批次。
 * 同一份批次同时进入库存台账（库存明细）和原料批次（批次指令投料）。
 * 关键物料至少 3 个已放行批次，含量、效期不同，便于投料时挑选。
 */
import dayjs from 'dayjs'
import { PROCESS_MASTER_ITEMS } from '@/mock/processMasterSeed'

export const PROCESS_TANKS = [
  { id: 'tank-resin', name: '树脂罐', kind: 'tank', capacity: 800 },
  { id: 'tank-solvent', name: '溶剂罐', kind: 'tank', capacity: 600 },
  { id: 'tank-alkyd', name: '树脂液罐', kind: 'tank', capacity: 400 },
  { id: 'tank-paint', name: '成品漆罐', kind: 'tank', capacity: 400 },
  { id: 'silo-pigment', name: '颜料仓', kind: 'silo', capacity: 200 },
  { id: 'shelf-aux', name: '助剂架', kind: 'silo', capacity: 40 },
  { id: 'tank-recycle', name: '回收稀料罐', kind: 'tank', capacity: 80 },
  { id: 'yard-black', name: '黑粉堆场', kind: 'silo', capacity: 500000 },
  { id: 'tank-acid', name: '硫酸罐', kind: 'tank', capacity: 100000 },
  { id: 'silo-wet', name: '湿法辅料仓', kind: 'silo', capacity: 40000 },
  { id: 'tank-brine', name: '卤水罐', kind: 'tank', capacity: 120000 },
  { id: 'wh-licarbon', name: '工碳库', kind: 'silo', capacity: 40000 },
  { id: 'yard-waste', name: '渣场', kind: 'silo', capacity: 60000 },
]

/** 配方投料与产出都会用到的批次目录 */
const GROUPS = [
  {
    itemId: 'pi-resin',
    warehouse: '原料仓',
    locationId: 'tank-resin',
    sourceType: 'purchase',
    lots: [
      {
        qty: 180,
        content: 1,
        status: 'released',
        age: 20,
        expiry: 500,
        supplier: '采购供应商A/R-18',
      },
      {
        qty: 120,
        content: 0.98,
        status: 'released',
        age: 12,
        expiry: 480,
        supplier: '采购供应商A/R-22',
      },
      { qty: 80, content: 1, status: 'released', age: 5, expiry: 28, supplier: '采购供应商A/R-30' },
      { qty: 60, content: 1, status: 'pending', age: 1, expiry: 500, supplier: '采购供应商A/R-31' },
    ],
  },
  {
    itemId: 'pi-solvent',
    warehouse: '原料仓',
    locationId: 'tank-solvent',
    sourceType: 'purchase',
    lots: [
      {
        qty: 160,
        content: 0.8,
        status: 'released',
        age: 16,
        expiry: 400,
        supplier: '采购供应商B/S-09',
      },
      {
        qty: 90,
        content: 0.82,
        status: 'released',
        age: 9,
        expiry: 360,
        supplier: '采购供应商B/S-12',
      },
      {
        qty: 40,
        content: 0.75,
        status: 'released',
        age: 8,
        expiry: 18,
        supplier: '采购供应商B/S-03',
      },
      {
        qty: 30,
        content: 0.7,
        status: 'released',
        age: 200,
        expiry: -12,
        supplier: '采购供应商B/S-01',
      },
      {
        qty: 50,
        content: 0.8,
        status: 'pending',
        age: 1,
        expiry: 400,
        supplier: '采购供应商B/S-15',
      },
    ],
  },
  {
    itemId: 'pi-alkyd-base',
    warehouse: '半成品仓',
    locationId: 'tank-alkyd',
    sourceType: 'output',
    lots: [
      {
        qty: 80,
        content: 0.5,
        status: 'released',
        age: 10,
        expiry: 70,
        supplier: 'PF-ALKYD-001/V1.0',
      },
      {
        qty: 60,
        content: 0.48,
        status: 'released',
        age: 6,
        expiry: 60,
        supplier: 'PF-ALKYD-001/槽2',
      },
      {
        qty: 40,
        content: 0.52,
        status: 'released',
        age: 3,
        expiry: 22,
        supplier: 'PF-ALKYD-001/槽3',
      },
    ],
  },
  {
    itemId: 'pi-pigment',
    warehouse: '原料仓',
    locationId: 'silo-pigment',
    sourceType: 'customer',
    lots: [
      { qty: 40, content: 1, status: 'released', age: 14, expiry: 700, supplier: '客户来料/T-07' },
      { qty: 25, content: 1, status: 'released', age: 7, expiry: 680, supplier: '客户来料/T-11' },
      { qty: 15, content: 1, status: 'released', age: 2, expiry: 40, supplier: '客户来料/T-14' },
    ],
  },
  {
    itemId: 'pi-drier',
    warehouse: '库线边仓',
    locationId: 'shelf-aux',
    sourceType: 'purchase',
    lots: [
      {
        qty: 8,
        content: 0.06,
        status: 'released',
        age: 30,
        expiry: 300,
        supplier: '标准件供应商/D-02',
      },
      {
        qty: 5,
        content: 0.055,
        status: 'released',
        age: 12,
        expiry: 280,
        supplier: '标准件供应商/D-06',
      },
      {
        qty: 2,
        content: 0.065,
        status: 'released',
        age: 4,
        expiry: 16,
        supplier: '标准件供应商/D-08',
      },
    ],
  },
  {
    itemId: 'pi-paint',
    warehouse: '成品主仓',
    locationId: 'tank-paint',
    sourceType: 'output',
    lots: [
      {
        qty: 86,
        content: 0.55,
        status: 'released',
        age: 8,
        expiry: 300,
        supplier: 'PF-PAINT-001/槽1',
      },
      {
        qty: 42,
        content: 0.54,
        status: 'released',
        age: 4,
        expiry: 280,
        supplier: 'PF-PAINT-001/槽2',
      },
      {
        qty: 28,
        content: 0.56,
        status: 'released',
        age: 2,
        expiry: 24,
        supplier: 'PF-PAINT-001/槽3',
      },
    ],
  },
  {
    itemId: 'pi-custom-paint',
    warehouse: '成品主仓',
    locationId: 'tank-paint',
    sourceType: 'output',
    lots: [
      {
        qty: 36,
        content: 0.5,
        status: 'released',
        age: 5,
        expiry: 150,
        supplier: 'PF-CUS-001/色卡A',
      },
      {
        qty: 18,
        content: 0.49,
        status: 'released',
        age: 2,
        expiry: 20,
        supplier: 'PF-CUS-001/色卡B',
      },
    ],
  },
  {
    itemId: 'pi-thinner',
    warehouse: '原料仓',
    locationId: 'tank-recycle',
    sourceType: 'output',
    lots: [
      {
        qty: 24,
        content: 0.7,
        status: 'released',
        age: 9,
        expiry: 120,
        supplier: '面漆副产/回收1',
      },
      {
        qty: 12,
        content: 0.66,
        status: 'released',
        age: 3,
        expiry: 18,
        supplier: '面漆副产/回收2',
      },
    ],
  },
  {
    itemId: 'pi-residue',
    warehouse: '报废仓',
    locationId: 'yard-waste',
    sourceType: 'output',
    lots: [
      { qty: 16, content: 1, status: 'released', age: 4, expiry: 20, supplier: '醇酸合成/釜残' },
    ],
  },
  {
    itemId: 'pi-black-powder',
    warehouse: '原料仓',
    locationId: 'yard-black',
    sourceType: 'purchase',
    lots: [
      {
        qty: 120000,
        content: 0.015,
        status: 'released',
        age: 6,
        expiry: 200,
        supplier: '湖南回收料/车-18',
      },
      {
        qty: 85000,
        content: 0.012,
        status: 'released',
        age: 4,
        expiry: 180,
        supplier: '湖南回收料/车-21',
      },
      {
        qty: 60000,
        content: 0.018,
        status: 'released',
        age: 2,
        expiry: 30,
        supplier: '外地黑粉/车-07',
      },
      {
        qty: 40000,
        content: 0.016,
        status: 'pending',
        age: 0,
        expiry: 200,
        supplier: '外地黑粉/车-09',
      },
    ],
  },
  {
    itemId: 'pi-sulfuric',
    warehouse: '库线边仓',
    locationId: 'tank-acid',
    sourceType: 'purchase',
    lots: [
      {
        qty: 30000,
        content: 0.98,
        status: 'released',
        age: 10,
        expiry: 360,
        supplier: '园区酸厂/罐-03',
      },
      {
        qty: 22000,
        content: 0.96,
        status: 'released',
        age: 5,
        expiry: 340,
        supplier: '园区酸厂/罐-05',
      },
      {
        qty: 12000,
        content: 0.985,
        status: 'released',
        age: 1,
        expiry: 20,
        supplier: '园区酸厂/罐-06',
      },
    ],
  },
  {
    itemId: 'pi-defluor',
    warehouse: '库线边仓',
    locationId: 'silo-wet',
    sourceType: 'purchase',
    lots: [
      {
        qty: 2000,
        content: 1,
        status: 'released',
        age: 15,
        expiry: 240,
        supplier: '湖南辅料/F-02',
      },
      { qty: 1200, content: 1, status: 'released', age: 8, expiry: 220, supplier: '湖南辅料/F-04' },
      { qty: 800, content: 1, status: 'released', age: 3, expiry: 25, supplier: '湖南辅料/F-06' },
    ],
  },
  {
    itemId: 'pi-caustic',
    warehouse: '库线边仓',
    locationId: 'silo-wet',
    sourceType: 'purchase',
    lots: [
      {
        qty: 1800,
        content: 0.99,
        status: 'released',
        age: 18,
        expiry: 240,
        supplier: '片碱供应商/N-01',
      },
      {
        qty: 900,
        content: 0.97,
        status: 'released',
        age: 7,
        expiry: 200,
        supplier: '片碱供应商/N-04',
      },
      {
        qty: 500,
        content: 0.99,
        status: 'released',
        age: 2,
        expiry: 18,
        supplier: '片碱供应商/N-06',
      },
    ],
  },
  {
    itemId: 'pi-pfs',
    warehouse: '库线边仓',
    locationId: 'silo-wet',
    sourceType: 'purchase',
    lots: [
      {
        qty: 1200,
        content: 1,
        status: 'released',
        age: 11,
        expiry: 120,
        supplier: '净水药剂/P-02',
      },
      { qty: 600, content: 1, status: 'released', age: 5, expiry: 100, supplier: '净水药剂/P-05' },
      { qty: 400, content: 1, status: 'pending', age: 0, expiry: 120, supplier: '净水药剂/P-07' },
    ],
  },
  {
    itemId: 'pi-soda',
    warehouse: '库线边仓',
    locationId: 'silo-wet',
    sourceType: 'purchase',
    lots: [
      {
        qty: 8000,
        content: 0.99,
        status: 'released',
        age: 12,
        expiry: 400,
        supplier: '纯碱供应商/C-03',
      },
      {
        qty: 5000,
        content: 0.985,
        status: 'released',
        age: 6,
        expiry: 380,
        supplier: '纯碱供应商/C-06',
      },
      {
        qty: 2500,
        content: 0.992,
        status: 'released',
        age: 2,
        expiry: 22,
        supplier: '纯碱供应商/C-08',
      },
    ],
  },
  {
    itemId: 'pi-licarbon',
    warehouse: '成品主仓',
    locationId: 'wh-licarbon',
    sourceType: 'output',
    lots: [
      {
        qty: 12800,
        content: 0.985,
        status: 'released',
        age: 9,
        expiry: 500,
        supplier: 'PF-LIC-001/袋批1',
      },
      {
        qty: 6400,
        content: 0.988,
        status: 'released',
        age: 4,
        expiry: 480,
        supplier: 'PF-LIC-001/袋批2',
      },
      {
        qty: 3200,
        content: 0.982,
        status: 'released',
        age: 1,
        expiry: 40,
        supplier: 'PF-LIC-001/袋批3',
      },
    ],
  },
  {
    itemId: 'pi-acid-brine',
    warehouse: '半成品仓',
    locationId: 'tank-brine',
    sourceType: 'output',
    lots: [
      {
        qty: 48000,
        content: 0.02,
        status: 'released',
        age: 3,
        expiry: 20,
        supplier: '酸浸/浓滤液1',
      },
      {
        qty: 22000,
        content: 0.018,
        status: 'released',
        age: 1,
        expiry: 12,
        supplier: '酸浸/浓滤液2',
      },
    ],
  },
  {
    itemId: 'pi-acid-slag',
    warehouse: '报废仓',
    locationId: 'yard-waste',
    sourceType: 'output',
    lots: [
      {
        qty: 16000,
        content: 0.003,
        status: 'released',
        age: 5,
        expiry: 60,
        supplier: '酸浸压滤/白班',
      },
      {
        qty: 8000,
        content: 0.0028,
        status: 'released',
        age: 1,
        expiry: 40,
        supplier: '酸浸压滤/夜班',
      },
    ],
  },
  {
    itemId: 'pi-f-slag',
    warehouse: '报废仓',
    locationId: 'yard-waste',
    sourceType: 'output',
    lots: [
      {
        qty: 3000,
        content: 0.005,
        status: 'released',
        age: 4,
        expiry: 40,
        supplier: '除杂/氟钙镁1',
      },
      {
        qty: 1200,
        content: 0.004,
        status: 'released',
        age: 1,
        expiry: 14,
        supplier: '除杂/氟钙镁2',
      },
    ],
  },
]

function masterOf(itemId) {
  const row = PROCESS_MASTER_ITEMS.find((item) => item.id === itemId)
  if (!row) throw new Error(`缺少主数据 ${itemId}`)
  return row
}

function money(master) {
  const price = Number(master.purchaseUnitPrice || master.unitPrice || 0)
  return price > 0 ? price : null
}

/** 稳定批次清单。同一天内多次调用结果一致。 */
export function buildProcessInventoryLots() {
  const today = dayjs().startOf('day')
  const seqByDay = new Map()
  const rows = []
  GROUPS.forEach((group) => {
    const master = masterOf(group.itemId)
    group.lots.forEach((lot, index) => {
      const produced = today.subtract(lot.age, 'day')
      const expiry = today.add(lot.expiry, 'day')
      const dayKey = produced.format('YYMMDD')
      const seq = (seqByDay.get(dayKey) || 0) + 1
      seqByDay.set(dayKey, seq)
      const released = lot.status === 'released'
      rows.push({
        id: `mb-${master.code}-${index + 1}`,
        batchNo: `B-${dayKey}-${String(seq).padStart(3, '0')}`,
        itemId: master.id,
        itemCode: master.code,
        itemName: master.name,
        specModel: master.specModel || '',
        unit: master.inventoryUnit || 'kg',
        qty: lot.qty,
        content: lot.content,
        status: lot.status,
        warehouse: group.warehouse,
        locationId: group.locationId,
        supplierBatchNo: lot.supplier,
        productionDate: produced.format('YYYY-MM-DD'),
        expiryDate: expiry.format('YYYY-MM-DD'),
        receivedAt: `${produced.format('YYYY-MM-DD')} ${index % 2 === 0 ? '09:20' : '14:10'}`,
        sourceType: group.sourceType,
        unitCost: money(master),
        qcNo: released
          ? `LLZJ-${produced.format('YYYYMMDD')}-${String(index + 1).padStart(2, '0')}`
          : '',
        /** 已放行演示批自带检验结论；完整检单见 buildProcessLotIncomingQcTasks */
        qcResult: released ? '合格' : '',
      })
    })
  })
  return rows
}

/** 为流程库存已放行批次生成已完成的来料化验单，便于投料点开详情。 */
export function buildProcessLotIncomingQcTasks() {
  const lots = buildProcessInventoryLots().filter((lot) => lot.status === 'released' && lot.qcNo)
  return lots.map((lot, index) => ({
    id: `qctask-proc-lot-${lot.id}`,
    qcNo: lot.qcNo,
    bizScope: '来料质检',
    qcStatus: '已完成',
    qcResult: '质检通过',
    sourceType: 'process_inventory',
    sourceDocNo: lot.batchNo,
    supplier: lot.supplierBatchNo || '',
    itemCode: lot.itemCode || '',
    itemName: lot.itemName || '',
    unit: lot.unit || 'kg',
    remark: `流程库存演示 · 批次 ${lot.batchNo}`,
    inspector: '质检员',
    inspectedAt: lot.receivedAt || '',
    lineItems: [
      {
        id: `qtl-proc-lot-${index + 1}`,
        itemCode: lot.itemCode || '',
        itemName: lot.itemName || '',
        unit: lot.unit || 'kg',
        batchNo: lot.batchNo,
        stockBatchNo: lot.batchNo,
        supplierBatchNo: lot.supplierBatchNo || '',
        receiptQty: lot.qty,
        inspectQty: Math.max(0.1, Number((Number(lot.qty) * 0.01).toFixed(3))),
        lineConclusion: '合格',
      },
    ],
    createdAt: lot.receivedAt || '',
    updatedAt: lot.receivedAt || '',
  }))
}

/** 库存台账批次。数量记在 currentLength，与现有批次账本一致。 */
export function cloneProcessStockBatches() {
  return buildProcessInventoryLots().map((lot) => ({
    id: `bat-${lot.id}`,
    batchNo: lot.batchNo,
    parentBatchId: '',
    warehouse: lot.warehouse,
    itemCode: lot.itemCode,
    itemName: lot.itemName,
    currentLength: lot.qty,
    inboundQty: lot.qty,
    inboundPurchaseQty: lot.qty,
    purchaseUnit: lot.unit,
    unit: lot.unit,
    status: '在库',
    sourceType:
      lot.sourceType === 'output'
        ? '产出入库'
        : lot.sourceType === 'customer'
          ? '客供入库'
          : '采购入库',
    sourceDocNo: lot.supplierBatchNo,
    unitCost: lot.unitCost,
    createdAt: `${lot.productionDate}T01:00:00.000Z`,
    updatedAt: `${lot.receivedAt.replace(' ', 'T')}:00.000Z`,
    attrs: {
      specModel: lot.specModel,
      content: lot.content,
      expiryDate: lot.expiryDate,
      supplierBatchNo: lot.supplierBatchNo,
      processStatus: lot.status,
    },
  }))
}
