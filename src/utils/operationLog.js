import dayjs from 'dayjs'
import { getUser } from '@/utils/auth'

/** 按规则自动生成批次指令时的创建人，不占用真实账号。 */
export const AUTO_ACTOR = '自动生成'

/**
 * 当前操作人展示名。
 * 登录 mock 曾把 displayName 写成「username--admin」，会看起来像两个 admin；
 * 优先用真实姓名 / 账号，再兜底清洗 displayName。
 */
export function currentOperator() {
  const user = getUser()
  const real = String(user?.name || user?.realName || '').trim()
  if (real) return real
  const username = String(user?.username || '').trim()
  if (username) return username
  const display = String(user?.displayName || '').trim()
  if (!display) return 'admin'
  // 兼容旧值：admin--admin → admin
  if (display.includes('--')) return display.split('--').filter(Boolean)[0] || display
  return display
}

/** 展示侧清洗历史已落库的「账号--角色」执行人 */
export function formatOperatorLabel(value) {
  const text = String(value || '').trim()
  if (!text) return '—'
  if (text.includes('--')) return text.split('--').filter(Boolean)[0] || text
  return text
}

export function nowText() {
  return dayjs().format('YYYY-MM-DD HH:mm')
}

export function appendOperationLog(row, action, remark = '', operator) {
  if (!row) return row
  if (!Array.isArray(row.operationLogs)) row.operationLogs = []
  const who = operator || currentOperator()
  const at = nowText()
  row.operationLogs.unshift({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    operatedAt: at,
    action: String(action || '').trim() || '操作',
    operator: who,
    remark: String(remark || '').trim(),
  })
  row.updatedBy = who
  row.updatedAt = at
  return row
}
