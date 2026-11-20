/** 过期预警：到期前 N 天亮灯。已过期仍由批次状态拦截投料和发货。 */

import dayjs from 'dayjs'

export function validateExpiryAlert(alert) {
  if (!alert?.expiryAlertEnabled) return { ok: true }
  const days = Number(alert.expiryAlertDays)
  if (!Number.isFinite(days) || days <= 0 || Math.round(days) !== days) {
    return { ok: false, message: '请填写过期预警的提前天数' }
  }
  return { ok: true }
}

/**
 * @returns {{ type: 'soon'|'expired'|'', text: string, remain: number|null }}
 */
export function resolveExpiryAlert(expiryDate, alert, today) {
  const empty = { type: '', text: '—', remain: null }
  if (!alert?.expiryAlertEnabled) return empty
  const days = Number(alert.expiryAlertDays)
  if (!Number.isFinite(days) || days <= 0) return empty
  const expiry = String(expiryDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return empty
  const todayStr = today || dayjs().format('YYYY-MM-DD')
  const remain = dayjs(expiry).startOf('day').diff(dayjs(todayStr).startOf('day'), 'day')
  if (!Number.isFinite(remain)) return empty
  if (remain < 0) {
    return { type: 'expired', text: `已过期 ${Math.abs(remain)} 天`, remain }
  }
  if (remain <= days) {
    return { type: 'soon', text: remain === 0 ? '今天到期' : `还剩 ${remain} 天`, remain }
  }
  return { type: '', text: '—', remain }
}
