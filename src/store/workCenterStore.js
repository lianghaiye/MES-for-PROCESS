import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { persistJson } from '@/utils/safeStorage'

const STORAGE_KEY = 'i_doms_work_centers'
const SEED_VERSION_KEY = 'i_doms_work_centers_v'
/** v3：机构类型 + 上级机构 */
const SEED_VERSION = '3'

/** 机构类型（组织树节点） */
export const ORG_TYPE_OPTIONS = [
  { value: 'company', label: '公司' },
  { value: 'factory', label: '工厂' },
  { value: 'department', label: '部门' },
  { value: 'workshop', label: '车间' },
  { value: 'person', label: '人员' },
]

export const ORG_TYPE_LABEL = Object.fromEntries(ORG_TYPE_OPTIONS.map((o) => [o.value, o.label]))

function nowDate() {
  return dayjs().format('YYYY-MM-DD')
}

function createSeed() {
  const now = nowDate()
  return [
    {
      id: 'wc-co',
      code: 'ORG-CO',
      name: '示例公司',
      orgType: 'company',
      parentId: '',
      manager: '',
      status: '启用',
      remark: '根节点',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wc-default',
      code: 'WC-DEFAULT',
      name: '默认工厂',
      orgType: 'factory',
      parentId: 'wc-co',
      manager: 'admin1',
      status: '启用',
      remark: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wc-acid-1',
      code: 'WC-ACID-01',
      name: '酸浸一线',
      orgType: 'workshop',
      parentId: 'wc-default',
      manager: '',
      status: '启用',
      remark: '示例：对应产线 A / 1 组包线',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wc-acid-2',
      code: 'WC-ACID-02',
      name: '酸浸二线',
      orgType: 'workshop',
      parentId: 'wc-default',
      manager: '',
      status: '启用',
      remark: '示例：对应产线 B / 2 组包线',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wc-mvr',
      code: 'WC-MVR-01',
      name: '蒸发浓缩',
      orgType: 'workshop',
      parentId: 'wc-default',
      manager: '',
      status: '启用',
      remark: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wc-react',
      code: 'WC-REACT',
      name: '反应车间',
      orgType: 'workshop',
      parentId: 'wc-default',
      manager: '张三',
      status: '启用',
      remark: '兼容原下拉选项',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wc-paint',
      code: 'WC-PAINT',
      name: '配漆车间',
      orgType: 'workshop',
      parentId: 'wc-default',
      manager: '李四',
      status: '启用',
      remark: '兼容原下拉选项',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wc-pump',
      code: 'WC-PUMP',
      name: '机泵',
      orgType: 'workshop',
      parentId: 'wc-default',
      manager: '',
      status: '启用',
      remark: '兼容员工组别旧种子',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wc-assy',
      code: 'WC-ASSY',
      name: '组装中心',
      orgType: 'workshop',
      parentId: 'wc-default',
      manager: '',
      status: '启用',
      remark: '兼容员工组别旧种子',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeRow) : null
  } catch {
    return null
  }
}

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row
  return {
    ...row,
    orgType: ORG_TYPE_LABEL[row.orgType] ? row.orgType : 'workshop',
    parentId: String(row.parentId || '').trim(),
    manager: String(row.manager || ''),
    status: row.status === '禁用' ? '禁用' : '启用',
    remark: String(row.remark || ''),
  }
}

function ensure(list) {
  const versionOk = localStorage.getItem(SEED_VERSION_KEY) === SEED_VERSION
  if (versionOk && Array.isArray(list) && list.length) return list.map(normalizeRow)
  const seed = createSeed()
  persistJson(STORAGE_KEY, seed)
  localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION)
  return seed
}

export const workCenterState = reactive({
  centers: ensure(load()),
})

watch(
  () => workCenterState.centers,
  (list) => persistJson(STORAGE_KEY, list),
  { deep: true },
)

export function listWorkCenters({ keyword, status, orgType } = {}) {
  let rows = [...(workCenterState.centers || [])]
  if (status) rows = rows.filter((row) => row.status === status)
  if (orgType) rows = rows.filter((row) => row.orgType === orgType)
  const kw = String(keyword || '')
    .trim()
    .toLowerCase()
  if (kw) {
    rows = rows.filter((row) => {
      const parentName = getWorkCenterById(row.parentId)?.name || ''
      const blob = [
        row.code,
        row.name,
        ORG_TYPE_LABEL[row.orgType],
        parentName,
        row.manager,
        row.remark,
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(kw)
    })
  }
  return rows.sort((a, b) => String(a.code).localeCompare(String(b.code)))
}

export function listEnabledWorkCenters() {
  return listWorkCenters({ status: '启用' })
}

/** 兼容旧页面：名称数组。 */
export function listWorkCenterNames({ enabledOnly = true } = {}) {
  const rows = enabledOnly ? listEnabledWorkCenters() : listWorkCenters()
  return rows.map((row) => row.name)
}

export function getWorkCenterById(id) {
  if (!id) return null
  return (workCenterState.centers || []).find((row) => row.id === id) || null
}

export function getWorkCenterByName(name) {
  const n = String(name || '').trim()
  if (!n) return null
  return (workCenterState.centers || []).find((row) => row.name === n) || null
}

export function formatWorkCenterLabel(idOrName) {
  const byId = getWorkCenterById(idOrName)
  if (byId) return byId.name
  const byName = getWorkCenterByName(idOrName)
  return byName?.name || String(idOrName || '') || '—'
}

/** 可选上级：排除自身及子孙，避免成环。 */
export function listParentCandidateOptions(excludeId = '') {
  const blocked = new Set()
  if (excludeId) {
    blocked.add(excludeId)
    const queue = [excludeId]
    while (queue.length) {
      const cur = queue.shift()
      for (const row of workCenterState.centers || []) {
        if (row.parentId === cur && !blocked.has(row.id)) {
          blocked.add(row.id)
          queue.push(row.id)
        }
      }
    }
  }
  return listEnabledWorkCenters()
    .filter((row) => !blocked.has(row.id))
    .map((row) => ({
      value: row.id,
      label: `${row.name}（${ORG_TYPE_LABEL[row.orgType] || row.orgType}）`,
    }))
}

function assertPayload(payload, id) {
  const code = String(payload.code || '').trim()
  const name = String(payload.name || '').trim()
  const orgType = String(payload.orgType || '').trim()
  const parentId = String(payload.parentId || '').trim()
  if (!code) throw new Error('请填写编码')
  if (!name) throw new Error('请填写名称')
  if (!ORG_TYPE_LABEL[orgType]) throw new Error('请选择机构类型')

  const dupCode = (workCenterState.centers || []).find((row) => row.code === code && row.id !== id)
  if (dupCode) throw new Error('编码已存在')
  const dupName = (workCenterState.centers || []).find((row) => row.name === name && row.id !== id)
  if (dupName) throw new Error('名称已存在')

  if (parentId) {
    if (parentId === id) throw new Error('上级机构不能是自己')
    const parent = getWorkCenterById(parentId)
    if (!parent) throw new Error('上级机构不存在')
    // 禁止把上级设成自己的子孙
    let walk = parent
    const guard = new Set()
    while (walk) {
      if (walk.id === id) throw new Error('上级机构不能是当前节点的下级')
      if (guard.has(walk.id)) break
      guard.add(walk.id)
      walk = walk.parentId ? getWorkCenterById(walk.parentId) : null
    }
  }

  return {
    code,
    name,
    orgType,
    parentId,
    manager: String(payload.manager || '').trim(),
    status: payload.status === '禁用' ? '禁用' : '启用',
    remark: String(payload.remark || '').trim(),
  }
}

export function addWorkCenter(payload = {}) {
  const draft = assertPayload(payload)
  const now = nowDate()
  const row = {
    id: `wc-${Date.now().toString(36)}`,
    ...draft,
    createdAt: now,
    updatedAt: now,
  }
  workCenterState.centers.unshift(row)
  return row
}

export function updateWorkCenter(id, payload = {}) {
  const row = getWorkCenterById(id)
  if (!row) throw new Error('工作中心不存在')
  const draft = assertPayload(payload, id)
  Object.assign(row, draft, { updatedAt: nowDate() })
  return row
}

export function deleteWorkCenter(id) {
  const hasChild = (workCenterState.centers || []).some((row) => row.parentId === id)
  if (hasChild) throw new Error('仍有下级机构，请先删除或调整下级')

  // 延迟引用，避免与员工组别循环依赖
  // eslint-disable-next-line global-require
  const { employeeGroupState } = require('@/store/employeeGroupStore')
  const used = (employeeGroupState.groups || []).some(
    (g) => g.workCenterId === id || g.workCenter === getWorkCenterById(id)?.name,
  )
  if (used) throw new Error('仍有员工组别挂靠该工作中心，不能删除')
  const idx = workCenterState.centers.findIndex((row) => row.id === id)
  if (idx < 0) throw new Error('工作中心不存在')
  workCenterState.centers.splice(idx, 1)
}

export function resolveWorkCenterOwner(workCenterNameOrId) {
  const row = getWorkCenterById(workCenterNameOrId) || getWorkCenterByName(workCenterNameOrId)
  return row?.manager || ''
}
