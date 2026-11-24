/** 报废单不再预置演示数据，列表只保留业务里实际产生的单据。 */
export function createScrapOrderSeed() {
  return []
}

/** 仅审核通过的报废单（拆解工单选单用） */
export function getApprovedScrapOrders(orders) {
  return (orders || []).filter((o) => o.auditStatus === '审核通过')
}
