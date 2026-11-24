export function createInOutDetailLine(partial = {}) {
  return {
    id: `iod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    headerId: '',
    docNo: '',
    businessType: '入库单',
    docType: '其它入库',
    docStatus: '已审核',
    ioStatus: '待入库',
    itemType: '物料',
    itemName: '',
    specAttr: '',
    qty: 0,
    stockAfter: 0,
    unit: '件',
    barcodeBatchNo: '',
    productionDate: '',
    postingDate: '',
    expiryDate: '',
    operator: '',
    remark: '',
    ...partial,
  }
}

/** 离散制造演示出入库流水已清空，列表只展示后续真实单据 */
export const mockInOutDetails = []

export function filterInOutDetails(list, filters = {}) {
  return list.filter((row) => {
    if (filters.businessType && row.businessType !== filters.businessType) return false
    if (filters.docType && row.docType !== filters.docType) return false
    if (filters.itemName && !row.itemName.includes(filters.itemName)) return false
    if (filters.barcodeBatchNo && !(row.barcodeBatchNo || '').includes(filters.barcodeBatchNo))
      return false
    if (filters.docNo && !row.docNo.includes(filters.docNo)) return false
    if (filters.itemType && row.itemType !== filters.itemType) return false
    if (filters.docStatus && row.docStatus !== filters.docStatus) return false
    if (filters.ioStatus && row.ioStatus !== filters.ioStatus) return false
    return true
  })
}
