import { mockEmployees } from '@/mock/workOrderMaster'
import { employeeGroupState } from '@/store/employeeGroupStore'
import { getUser } from '@/utils/auth'
import { currentOperator } from '@/utils/operationLog'

function matchNamesForUser(user) {
  const names = [user?.name, user?.realName, user?.displayName, user?.username, currentOperator()]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .flatMap((value) => {
      if (value.includes('--')) return [value, ...value.split('--').filter(Boolean)]
      return [value]
    })
  return [...new Set(names)]
}

function groupsForPersonName(name) {
  const key = String(name || '').trim()
  if (!key) return []
  return employeeGroupState.groups.filter(
    (g) =>
      g.status !== '停用' &&
      (g.leaderName === key || (g.workers || []).some((w) => w.name === key)),
  )
}

/** 按姓名解析所属工作中心（员工组别），多中心时保持组别顺序，去重。 */
export function resolveEmployeeWorkCenters(name = '') {
  void employeeGroupState.groups
  const seen = new Set()
  const rows = []
  groupsForPersonName(name).forEach((group) => {
    const id = String(group.workCenterId || '').trim()
    const label = String(group.workCenter || '').trim()
    const key = id || label
    if (!key || seen.has(key)) return
    seen.add(key)
    rows.push({ id, name: label || id })
  })
  return rows
}

/** 当前登录人所属工作中心；多人多组时按组别出现顺序，取第一个作默认。 */
export function resolveCurrentUserWorkCenters() {
  void employeeGroupState.groups
  const names = matchNamesForUser(getUser())
  const seen = new Set()
  const rows = []
  names.forEach((name) => {
    resolveEmployeeWorkCenters(name).forEach((row) => {
      const key = row.id || row.name
      if (!key || seen.has(key)) return
      seen.add(key)
      rows.push(row)
    })
  })
  return rows
}

export function resolveCurrentUserDefaultWorkCenterId() {
  const first = resolveCurrentUserWorkCenters()[0]
  return String(first?.id || '').trim()
}

/** 按姓名解析员工工号、岗位、工作中心（人员主数据 + 员工组别） */
export function resolveEmployeeProfile(name = '') {
  if (!name?.trim()) {
    return { employeeNo: '—', positions: '—', workCenter: '—' }
  }
  const emp = mockEmployees.find((e) => e.name === name)
  const centers = resolveEmployeeWorkCenters(name)
  const groups = groupsForPersonName(name)
  const positions = [...new Set(groups.map((g) => g.position).filter(Boolean))].join('、') || '—'
  return {
    employeeNo: emp?.employeeNo || '—',
    positions,
    workCenter: centers.length ? centers.map((row) => row.name || row.id).join('、') : '—',
  }
}

export function employeeNameOptions() {
  return mockEmployees.map((e) => ({
    label: e.employeeNo ? `${e.name}（${e.employeeNo}）` : e.name,
    value: e.name,
  }))
}
