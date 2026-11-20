import dayjs from 'dayjs'
import { getUser } from '@/utils/auth'

/** 按规则自动生成批次指令时的创建人，不占用真实账号。 */
export const AUTO_ACTOR = '自动生成'

export function currentOperator() {
  const user = getUser()
  return String(user?.displayName || user?.username || user?.name || '').trim() || 'admin'
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
