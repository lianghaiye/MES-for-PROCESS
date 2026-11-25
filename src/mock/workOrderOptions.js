/** 加工工单弹窗下拉选项 Mock */
export const processRouteOptions = [
  '机加标准路线',
  '装配标准路线',
  '热处理路线',
  '焊接标准路线',
  '树脂合成路线',
  '配漆路线',
]
export const personInChargeOptions = ['孙琴丽', '张三', '李四', '王五']

/**
 * 工作中心名称列表（兼容旧下拉）。
 * 主数据在 workCenterStore；此处动态读取启用中的名称。
 */
export function getWorkCenterOptions() {
  try {
    // eslint-disable-next-line global-require
    const { listWorkCenterNames } = require('@/store/workCenterStore')
    const names = listWorkCenterNames({ enabledOnly: true })
    if (names.length) return names
  } catch {
    /* ignore */
  }
  return ['默认工厂', '反应车间', '配漆车间']
}

/** @deprecated 请优先用 getWorkCenterOptions()；保留数组形态供旧 .map 使用 */
export const workCenterOptions = getWorkCenterOptions()

/** @deprecated 负责人改从工作中心主数据 manager 读取 */
export const workCenterManagers = {
  默认工厂: 'admin1',
  反应车间: '张三',
  配漆车间: '李四',
}

export function resolveWorkCenterOwner(workCenter) {
  try {
    // eslint-disable-next-line global-require
    const { resolveWorkCenterOwner: resolve } = require('@/store/workCenterStore')
    const hit = resolve(workCenter)
    if (hit) return hit
  } catch {
    /* ignore */
  }
  return workCenterManagers[workCenter] || personInChargeOptions[0] || ''
}

export const unitOptions = ['件', '套', 'kg', 'm', '台']
export const warehouseOptions = ['原料仓', '半成品仓', '成品仓', '外协仓']
export { urgencyOptions, getUrgencyOptions } from '@/constants/urgency'
