import dayjs from 'dayjs'
import { getUser } from '@/utils/auth'
import { PROCESS_FORM_SYSTEM_KEYS, QC_FIELD_VALUE_SOURCE } from '@/mock/qcFieldLibrary'
import { deviceLabelById } from '@/store/equipmentStore'

/** 是否系统带出指标 */
export function isProcessFormSystemField(field) {
  return (
    field?.valueSource === QC_FIELD_VALUE_SOURCE.SYSTEM ||
    Boolean(String(field?.systemKey || '').trim())
  )
}

/**
 * 解析系统指标展示值
 * @param {string} systemKey
 * @param {{ operatorName?: string, operatedAt?: string, equipmentId?: string, equipmentLabel?: string, batchNo?: string }} ctx
 */
export function resolveProcessFormSystemValue(systemKey, ctx = {}) {
  const key = String(systemKey || '').trim()
  if (key === PROCESS_FORM_SYSTEM_KEYS.OPERATOR) {
    if (ctx.operatorName) return ctx.operatorName
    const user = getUser()
    return user?.name || user?.realName || user?.username || '—'
  }
  if (key === PROCESS_FORM_SYSTEM_KEYS.OPERATED_AT) {
    return ctx.operatedAt || dayjs().format('YYYY-MM-DD HH:mm:ss')
  }
  if (key === PROCESS_FORM_SYSTEM_KEYS.EQUIPMENT) {
    if (ctx.equipmentLabel) return ctx.equipmentLabel
    if (ctx.equipmentId) return deviceLabelById(ctx.equipmentId) || ctx.equipmentId
    return '—'
  }
  if (key === PROCESS_FORM_SYSTEM_KEYS.BATCH_NO) {
    return ctx.batchNo || '—'
  }
  return '—'
}

/** 系统指标中文说明 */
export function processFormSystemKeyLabel(systemKey) {
  const map = {
    [PROCESS_FORM_SYSTEM_KEYS.OPERATOR]: '当前登录人',
    [PROCESS_FORM_SYSTEM_KEYS.OPERATED_AT]: '提交时间',
    [PROCESS_FORM_SYSTEM_KEYS.EQUIPMENT]: '本格设备',
    [PROCESS_FORM_SYSTEM_KEYS.BATCH_NO]: '批指令号',
  }
  return map[String(systemKey || '').trim()] || '系统数据'
}
