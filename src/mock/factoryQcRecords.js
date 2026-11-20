import dayjs from 'dayjs'

export function createQcLineItem(partial = {}) {
  return {
    id: `qc-line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    itemName: '',
    itemCode: '',
    specModel: '',
    shipQty: 0,
    shipWarehouse: '',
    unit: 'kg',
    inspectQty: 0,
    lineQcResult: undefined,
    treatmentPlan: undefined,
    ...partial,
  }
}

function createFactoryQc(partial) {
  return {
    qcStatus: '待质检',
    qcResult: '',
    qcNo: '',
    sourceOrderNo: '',
    salesOrderNo: '',
    customerName: '',
    source: '销售发货',
    inspector: '',
    inspectedAt: '',
    creator: partial.creator || 'admin1',
    createdAt: partial.createdAt || dayjs().format('YYYY-MM-DD HH:mm:ss'),
    outboundDocNo: '',
    inspectMethod: '抽检',
    inspectDate: dayjs().format('YYYY-MM-DD'),
    remark: '',
    lineItems: [],
    ...partial,
  }
}

/** 流程型出厂质检演示（湿法成品） */
export const mockFactoryQcRecords = [
  createFactoryQc({
    id: 'fqc-proc-1',
    qcNo: `CCZJ${dayjs().format('YYYYMMDD')}0001`,
    qcStatus: '待质检',
    salesOrderNo: 'SO-PROC-001',
    sourceOrderNo: 'OUT-PROC-001',
    customerName: '流程客户A',
    outboundDocNo: 'OUT-PROC-001',
    creator: 'admin1',
    createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    inspectMethod: '抽检',
    inspectDate: dayjs().format('YYYY-MM-DD'),
    remark: '流程演示：湿法成品出厂检',
    lineItems: [
      createQcLineItem({
        id: 'fqc-proc-line-1',
        itemName: '示范湿法成品',
        itemCode: 'CP-PROC-001',
        shipQty: 180,
        shipWarehouse: '成品仓',
        unit: 'kg',
        inspectQty: 3,
      }),
    ],
  }),
]

export function cloneFactoryQcRecords() {
  return JSON.parse(JSON.stringify(mockFactoryQcRecords))
}

export function filterFactoryQcRecords(list, filters) {
  return list.filter((item) => {
    if (filters.qcStatus && item.qcStatus !== filters.qcStatus) return false
    if (filters.qcResult && item.qcResult !== filters.qcResult) return false
    if (filters.salesOrderNo && !item.salesOrderNo?.includes(filters.salesOrderNo)) return false
    if (filters.customerName && !item.customerName?.includes(filters.customerName)) return false
    return true
  })
}

export function resolveHeaderQcResult(lineItems) {
  const results = (lineItems || []).map((l) => l.lineQcResult).filter(Boolean)
  if (!results.length) return ''
  const allPass = results.every((r) => r === '合格')
  const allFail = results.every((r) => r === '不合格')
  if (allPass) return '质检通过'
  if (allFail) return '质检不通过'
  return '部分通过'
}
