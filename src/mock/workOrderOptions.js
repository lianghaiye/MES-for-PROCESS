/** 加工工单弹窗下拉选项 Mock */
export const processRouteOptions = [
  '机加标准路线',
  '装配标准路线',
  '热处理路线',
  '焊接标准路线',
  '树脂合成路线',
  '配漆路线',
]
/** 流程型工作中心。机加、装配、总装、热处理等离散车间不再作为可选项。 */
export const workCenterOptions = ['默认工厂', '反应车间', '配漆车间']
export const personInChargeOptions = ['孙琴丽', '张三', '李四', '王五']

/** 工作中心默认负责人 */
export const workCenterManagers = {
  默认工厂: 'admin1',
  反应车间: '张三',
  配漆车间: '李四',
}

export function resolveWorkCenterOwner(workCenter) {
  return workCenterManagers[workCenter] || personInChargeOptions[0] || ''
}

export const unitOptions = ['件', '套', 'kg', 'm', '台']
export const warehouseOptions = ['原料仓', '半成品仓', '成品仓', '外协仓']
export { urgencyOptions, getUrgencyOptions } from '@/constants/urgency'
