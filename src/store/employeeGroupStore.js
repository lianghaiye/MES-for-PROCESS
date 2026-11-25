import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import {
  getWorkCenterById,
  getWorkCenterByName,
  listWorkCenterNames,
} from '@/store/workCenterStore'

const STORAGE_KEY = 'i_doms_employee_groups'
const GROUP_SEED_VERSION_KEY = 'i_doms_employee_groups_wc_v'
/** v4：组员带岗位；组长在列表勾选 */
const GROUP_SEED_VERSION = '4'
let codeSeq = 16

function resolveWorkCenterFields(payload = {}) {
  const byId = getWorkCenterById(payload.workCenterId)
  if (byId) return { workCenterId: byId.id, workCenter: byId.name }
  const byName = getWorkCenterByName(payload.workCenter)
  if (byName) return { workCenterId: byName.id, workCenter: byName.name }
  return {
    workCenterId: String(payload.workCenterId || '').trim(),
    workCenter: String(payload.workCenter || '').trim(),
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.groups)) {
        const seed = createSeedGroups()
        const ids = new Set(parsed.groups.map((g) => g.id))
        const names = new Set(parsed.groups.map((g) => g.name))
        seed.forEach((g) => {
          if (!ids.has(g.id) && !names.has(g.name)) parsed.groups.push(g)
        })
        return parsed.groups
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ groups: employeeGroupState.groups }))
}

function generateCode() {
  const code = `WG${dayjs().format('YYYYMMDD')}${String(codeSeq++).padStart(3, '0')}`
  return code
}

function createSeedGroups() {
  return [
    {
      id: 'eg-acid-1',
      code: 'WG20261124001',
      name: '酸浸1组',
      workCenterId: 'wc-acid-1',
      workCenter: '酸浸一线',
      position: '',
      allowTaskGen: true,
      leaderParticipates: true,
      multiExecutor: true,
      status: '启用',
      leaderId: 'emp-2',
      leaderName: '张三',
      workers: [
        { id: 'emp-2', name: '张三', position: '反应岗', isLeader: true },
        { id: 'emp-3', name: '李四', position: '配料岗', isLeader: false },
      ],
      remark: '包酸浸一线；组内再分早晚班',
      createdAt: '2026-11-24',
    },
    {
      id: 'eg-acid-2',
      code: 'WG20261124002',
      name: '酸浸2组',
      workCenterId: 'wc-acid-2',
      workCenter: '酸浸二线',
      position: '',
      allowTaskGen: true,
      leaderParticipates: true,
      multiExecutor: true,
      status: '启用',
      leaderId: 'emp-1',
      leaderName: '孙琴丽',
      workers: [
        { id: 'emp-1', name: '孙琴丽', position: '班组长', isLeader: true },
        { id: 'emp-4', name: '王五', position: '分离岗', isLeader: false },
      ],
      remark: '包酸浸二线；组内再分早晚班',
      createdAt: '2026-11-24',
    },
    {
      id: 'eg-1',
      code: 'WG20260310002',
      name: '加工小组',
      workCenterId: 'wc-pump',
      workCenter: '机泵',
      position: '',
      allowTaskGen: true,
      leaderParticipates: true,
      multiExecutor: true,
      status: '启用',
      leaderId: 'emp-2',
      leaderName: '张三',
      workers: [
        { id: 'emp-2', name: '张三', position: '反应岗', isLeader: true },
        { id: 'emp-3', name: '李四', position: '配料岗', isLeader: false },
        { id: 'emp-9', name: '赵六', position: '灌装岗', isLeader: false },
      ],
      remark: '',
      createdAt: '2026-03-10',
    },
    {
      id: 'eg-2',
      code: 'WG20260310003',
      name: '总装小组',
      workCenterId: 'wc-assy',
      workCenter: '组装中心',
      position: '',
      allowTaskGen: true,
      leaderParticipates: true,
      multiExecutor: true,
      status: '启用',
      leaderId: 'emp-1',
      leaderName: '孙琴丽',
      workers: [
        { id: 'emp-1', name: '孙琴丽', position: '班组长', isLeader: true },
        { id: 'emp-4', name: '王五', position: '分离岗', isLeader: false },
      ],
      remark: '',
      createdAt: '2026-03-10',
    },
  ]
}

function normalizeGroup(row) {
  if (!row || typeof row !== 'object') return row
  const linked = resolveWorkCenterFields(row)
  return {
    ...row,
    workCenterId: linked.workCenterId || row.workCenterId || '',
    workCenter: linked.workCenter || row.workCenter || '',
  }
}

function loadGroups() {
  const versionOk = localStorage.getItem(GROUP_SEED_VERSION_KEY) === GROUP_SEED_VERSION
  const stored = loadFromStorage()
  if (versionOk && stored?.length) return stored.map(normalizeGroup)
  const seed = createSeedGroups()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ groups: seed }))
  localStorage.setItem(GROUP_SEED_VERSION_KEY, GROUP_SEED_VERSION)
  return seed
}

export const employeeGroupState = reactive({
  groups: loadGroups(),
})

watch(
  () => employeeGroupState.groups,
  () => persist(),
  { deep: true },
)

export function getEmployeeGroupById(id) {
  return employeeGroupState.groups.find((g) => g.id === id) || null
}

export function getEmployeeGroupByName(name) {
  return employeeGroupState.groups.find((g) => g.name === name) || null
}

export function getEnabledEmployeeGroups() {
  return employeeGroupState.groups.filter((g) => g.status === '启用')
}

export function addEmployeeGroup(payload) {
  const linked = resolveWorkCenterFields(payload)
  if (!linked.workCenterId && !linked.workCenter) {
    throw new Error('请选择工作中心')
  }
  const row = {
    id: `eg-${Date.now()}`,
    code: payload.code?.trim() || generateCode(),
    name: payload.name?.trim() || '',
    workCenterId: linked.workCenterId,
    workCenter: linked.workCenter,
    position: payload.position || '',
    allowTaskGen: payload.allowTaskGen ?? true,
    leaderParticipates: payload.leaderParticipates ?? true,
    multiExecutor: payload.multiExecutor ?? true,
    status: payload.status || '启用',
    leaderId: payload.leaderId || '',
    leaderName: payload.leaderName || '',
    workers: payload.workers || [],
    remark: payload.remark || '',
    createdAt: dayjs().format('YYYY-MM-DD'),
  }
  employeeGroupState.groups.unshift(row)
  return row
}

export function updateEmployeeGroup(id, patch) {
  const idx = employeeGroupState.groups.findIndex((g) => g.id === id)
  if (idx === -1) return null
  const linked = resolveWorkCenterFields({ ...employeeGroupState.groups[idx], ...patch })
  Object.assign(employeeGroupState.groups[idx], patch, linked)
  return employeeGroupState.groups[idx]
}

/** 某工作中心下的启用班组 */
export function listGroupsByWorkCenter(workCenterIdOrName) {
  const key = String(workCenterIdOrName || '').trim()
  if (!key) return []
  return getEnabledEmployeeGroups().filter((g) => g.workCenterId === key || g.workCenter === key)
}

export function deleteEmployeeGroups(ids) {
  const set = new Set(ids)
  const before = employeeGroupState.groups.length
  employeeGroupState.groups = employeeGroupState.groups.filter((g) => !set.has(g.id))
  return before - employeeGroupState.groups.length
}

/** 兼容旧引用：启用中的工作中心名称 */
export function getWorkCenterOptions() {
  return listWorkCenterNames({ enabledOnly: true })
}

/** @deprecated 请用 getWorkCenterOptions() */
export const workCenterOptions = listWorkCenterNames({ enabledOnly: true })
/** 基础配置「岗位」主数据；工序「默认执行」从此取数 */
export const positionOptions = [
  '配料岗',
  '反应岗',
  '分离岗',
  '灌装岗',
  '储运岗',
  '质检岗',
  '泵装配调试',
  '质检',
  '车间工人',
  '班组长',
  '操作工',
]
