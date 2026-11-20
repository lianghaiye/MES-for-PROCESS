import { message } from 'ant-design-vue'
import {
  isQuickMaterialDeduct,
  resolveInventoryDeductDocNo,
} from '@/mock/materialRequisitionRecords'
import { listMobileMaterialReqs } from '@/store/mobileMaterialReqStore'

/**
 * 打开库存扣减单关联单据（流程仓：领料申请；生产工单入口已下线）
 * @returns {boolean} 是否成功打开
 */
export function openInventoryDeductSourceDoc(record, { router, openTab } = {}) {
  if (!record || !router || !openTab) return false

  if (isQuickMaterialDeduct(record)) {
    const reqNo = resolveInventoryDeductDocNo(record)
    const hit =
      listMobileMaterialReqs().find(
        (r) =>
          (reqNo && (r.reqNo === reqNo || r.requisitionNo === reqNo)) ||
          (record.reqId && r.id === record.reqId),
      ) || null
    if (!hit?.id) {
      message.info('未找到关联领料申请')
      return false
    }
    const path = `/production/material-requisition/${hit.id}`
    openTab(path, `领料申请 ${hit.reqNo || reqNo || ''}`.trim())
    router.push(path)
    return true
  }

  // 离散生产/总装工单入口已移除，不再跳转
  return false
}
