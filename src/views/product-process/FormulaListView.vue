<template>
  <div class="product-bom-page">
    <div class="filter-card">
      <a-form layout="inline" class="filter-form horizontal-form">
        <ListFilterBar
          :field-count="listTab === 'all' ? 4 : 3"
          search-text="搜索"
          reset-text="清空"
          @search="handleSearch"
          @reset="handleReset"
        >
          <a-form-item label="配方编号">
            <a-input
              v-model:value="filters.formulaNo"
              allow-clear
              size="small"
              placeholder="请输入配方编号"
            />
          </a-form-item>
          <a-form-item label="配方名称">
            <a-input
              v-model:value="filters.name"
              allow-clear
              size="small"
              placeholder="请输入配方名称"
            />
          </a-form-item>
          <a-form-item label="主产品">
            <MasterItemSelect
              v-model="filters.itemId"
              modal-title="选择主产品"
              placeholder="请选择主产品"
            />
          </a-form-item>
          <a-form-item v-if="listTab === 'all'" label="配方状态">
            <a-select
              v-model:value="filters.status"
              allow-clear
              size="small"
              placeholder="请选择状态"
              :options="statusFilterOptions"
            />
          </a-form-item>
        </ListFilterBar>
      </a-form>
    </div>

    <div class="toolbar-row">
      <a-space wrap :size="8">
        <a-button type="primary" size="small" @click="goNew">
          <PlusOutlined />
          新增配方
        </a-button>
        <a-button size="small" @click="handleBatchPublish">
          <CheckOutlined />
          审核发布
        </a-button>
        <a-button size="small" @click="handleBatchArchive">
          <InboxOutlined />
          归档
        </a-button>
        <a-dropdown>
          <a-button size="small">
            <DownloadOutlined />
            导出配方
            <DownOutlined />
          </a-button>
          <template #overlay>
            <a-menu @click="onExportMenu">
              <a-menu-item key="selected">导出选中</a-menu-item>
              <a-menu-item key="all">导出全部</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </a-space>
      <a-space :size="4" class="toolbar-icons">
        <a-tooltip title="刷新">
          <a-button type="text" size="small" @click="handleSearch">
            <ReloadOutlined />
          </a-button>
        </a-tooltip>
        <TableColumnSettingButton @click="columnDrawerOpen = true" />
      </a-space>
    </div>

    <a-tabs v-model:activeKey="listTab" size="small" class="list-status-tabs" @change="onTabChange">
      <a-tab-pane key="all" tab="全部" />
      <a-tab-pane key="pending" tab="待发布" />
      <a-tab-pane key="archived" tab="已归档" />
    </a-tabs>

    <div class="table-card">
      <a-table
        :columns="displayColumns"
        :data-source="pagedList"
        row-key="id"
        size="small"
        bordered
        :pagination="false"
        :row-selection="rowSelection"
        :scroll="{ x: tableScrollX }"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">{{ rowIndex(index) }}</template>
          <template v-else-if="column.key === 'formulaNo'">
            <a class="link-name" @click.prevent="goDetail(record)">{{ record.formulaNo || '—' }}</a>
          </template>
          <template v-else-if="column.key === 'formulaType'">{{
            FORMULA_TYPE_LABEL[record.formulaType] || '标准配方'
          }}</template>
          <template v-else-if="column.key === 'item'">{{ itemLabel(record.itemId) }}</template>
          <template v-else-if="column.key === 'itemCode'">{{ itemCode(record.itemId) }}</template>
          <template v-else-if="column.key === 'route'">{{ routeLabel(record.routeId) }}</template>
          <template v-else-if="column.key === 'base'">{{ record.baseBatchQty }} kg</template>
          <template v-else-if="column.key === 'yield'">{{ record.theoreticalYield }}</template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'default'">
            <a-tag v-if="record.status === 'active' && record.isDefault" color="blue">默认</a-tag>
            <a-tag v-else-if="record.isDefault">发布后默认</a-tag>
            <span v-else>—</span>
          </template>
          <template v-else-if="column.key === 'creator'">{{ record.creator || '—' }}</template>
          <template v-else-if="column.key === 'createdAt'">{{ record.createdAt || '—' }}</template>
          <template v-else-if="column.key === 'updater'">{{ record.updater || '—' }}</template>
          <template v-else-if="column.key === 'action'">
            <a-space v-if="record.status === 'pending'" :size="0" wrap>
              <a-button type="link" size="small" @click="publishOne(record)">
                <CheckOutlined />
                启用
              </a-button>
              <a-button type="link" size="small" @click="goEdit(record)">
                <EditOutlined />
                编辑
              </a-button>
              <a-dropdown>
                <a-button type="link" size="small">
                  操作
                  <DownOutlined />
                </a-button>
                <template #overlay>
                  <a-menu @click="({ key }) => onPendingAction(key, record)">
                    <a-menu-item key="delete">
                      <DeleteOutlined />
                      删除
                    </a-menu-item>
                    <a-menu-item key="clone">
                      <CopyOutlined />
                      克隆
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </a-space>
            <a-space v-else-if="record.status === 'active'" :size="0" wrap>
              <a-button type="link" size="small" @click="reviseOne(record)">
                <RiseOutlined />
                升版
              </a-button>
              <a-dropdown>
                <a-button type="link" size="small">
                  操作
                  <DownOutlined />
                </a-button>
                <template #overlay>
                  <a-menu @click="({ key }) => onActiveAction(key, record)">
                    <a-menu-item v-if="!record.isDefault" key="default">设为默认</a-menu-item>
                    <a-menu-item key="archive">
                      <InboxOutlined />
                      归档
                    </a-menu-item>
                    <a-menu-item key="clone">
                      <CopyOutlined />
                      克隆
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </a-space>
            <a-space v-else :size="0" wrap>
              <a-button type="link" size="small" @click="publishOne(record)">
                <CheckOutlined />
                启用
              </a-button>
              <a-button type="link" size="small" @click="cloneOne(record)">
                <CopyOutlined />
                克隆
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
      <div class="table-pagination">
        <a-pagination
          v-model:current="pagination.current"
          v-model:page-size="pagination.pageSize"
          :total="filteredList.length"
          size="small"
          show-size-changer
          :page-size-options="['10', '20', '50', '100']"
          :show-total="(t) => `共 ${t} 条`"
          show-quick-jumper
        />
      </div>
    </div>

    <TableColumnSettingDrawer
      v-model:open="columnDrawerOpen"
      v-model:settings="columnSettings"
      :default-settings="defaultColumnSettings"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  EditOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  RiseOutlined,
} from '@ant-design/icons-vue'
import ListFilterBar from '@/components/ListFilterBar.vue'
import TableColumnSettingButton from '@/components/TableColumnSettingButton.vue'
import TableColumnSettingDrawer from '@/components/TableColumnSettingDrawer.vue'
import { useTableColumnSettings } from '@/composables/useTableColumnSettings'
import { useTabs } from '@/composables/useTabs'
import { buildExportFileName, exportRowsToExcel } from '@/utils/excelExport'
import MasterItemSelect from '@/views/product-process/components/MasterItemSelect.vue'
import {
  FORMULA_STATUS_LABEL,
  FORMULA_TYPE_LABEL,
  archiveFormula,
  cloneFormula,
  deleteFormula,
  formulaState,
  itemLabel,
  itemMasterCard,
  publishFormula,
  reviseFormula,
  setDefaultFormula,
} from '@/store/processFormulaStore'
import { getProcessRouteById } from '@/store/processRouteStore'

const router = useRouter()
const { openTab } = useTabs()

const filters = reactive({ formulaNo: '', name: '', itemId: undefined, status: undefined })
const applied = ref({ ...filters })
const listTab = ref('all')
const selectedRowKeys = ref([])
const pagination = reactive({ current: 1, pageSize: 10 })

const statusFilterOptions = [
  { value: 'pending', label: '待发布' },
  { value: 'active', label: '生效' },
]

const columns = [
  { title: '序号', key: 'index', width: 64, fixed: 'left' },
  { title: '状态', key: 'status', width: 90 },
  { title: '配方编号', key: 'formulaNo', dataIndex: 'formulaNo', width: 150 },
  { title: '配方名称', dataIndex: 'name', width: 180 },
  { title: '配方类型', key: 'formulaType', width: 100 },
  { title: '主产品', key: 'item', width: 160 },
  { title: '产品编码', key: 'itemCode', width: 120 },
  { title: '工艺路线', key: 'route', width: 160 },
  { title: '基准批量', key: 'base', width: 100, align: 'right' },
  { title: '理论得率', key: 'yield', width: 90, align: 'right' },
  { title: '版本', dataIndex: 'version', width: 80 },
  { title: '默认', key: 'default', width: 100 },
  { title: '创建人', key: 'creator', width: 100 },
  { title: '创建时间', key: 'createdAt', width: 150 },
  { title: '更新人', key: 'updater', width: 100 },
  { title: '更新时间', dataIndex: 'updatedAt', width: 150 },
  { title: '操作', key: 'action', width: 220, fixed: 'right' },
]

const { columnSettings, columnDrawerOpen, displayColumns, tableScrollX, defaultColumnSettings } =
  useTableColumnSettings('formula-list-v3', columns)

const filteredList = computed(() =>
  formulaState.formulas.filter((row) => {
    if (listTab.value === 'pending' && row.status !== 'pending') return false
    if (listTab.value === 'archived' && row.status !== 'archived') return false
    if (listTab.value === 'all' && row.status === 'archived') return false
    const q = applied.value
    if (q.formulaNo && !String(row.formulaNo).includes(q.formulaNo.trim())) return false
    if (q.name && !String(row.name).includes(q.name.trim())) return false
    if (q.itemId && row.itemId !== q.itemId) return false
    if (listTab.value === 'all' && q.status && row.status !== q.status) return false
    return true
  }),
)

const pagedList = computed(() => {
  const start = (pagination.current - 1) * pagination.pageSize
  return filteredList.value.slice(start, start + pagination.pageSize)
})

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys) => {
    selectedRowKeys.value = keys
  },
}))

function statusLabel(value) {
  return FORMULA_STATUS_LABEL[value] || '—'
}
function statusColor(value) {
  if (value === 'active') return 'success'
  if (value === 'archived') return 'default'
  return 'warning'
}
function itemCode(itemId) {
  return itemMasterCard(itemId)?.code || '—'
}
function routeLabel(routeId) {
  if (!routeId) return '—'
  const route = getProcessRouteById(routeId)
  if (!route) return '—'
  return `${route.code || ''} ${route.name || ''}`.trim() || '—'
}
function rowIndex(index) {
  return (pagination.current - 1) * pagination.pageSize + index + 1
}
function handleSearch() {
  applied.value = { ...filters }
  pagination.current = 1
}
function handleReset() {
  filters.formulaNo = ''
  filters.name = ''
  filters.itemId = undefined
  filters.status = undefined
  handleSearch()
}
function onTabChange() {
  filters.status = undefined
  selectedRowKeys.value = []
  pagination.current = 1
  handleSearch()
}

function goNew() {
  openTab('/product-process/bom/new', '新增配方')
  router.push('/product-process/bom/new')
}
function goDetail(record) {
  const path = `/product-process/bom/${record.id}`
  openTab(path, record.name)
  router.push(path)
}
function goEdit(record, options = {}) {
  const path = `/product-process/bom/${record.id}/edit`
  const query = {}
  if (options.returnTo) {
    query.returnTo = options.returnTo
    query.returnTitle = options.returnTitle || record.name || record.formulaNo || '配方详情'
  }
  const hasQuery = Object.keys(query).length > 0
  const fullPath = hasQuery ? router.resolve({ path, query }).fullPath : path
  openTab(fullPath, '编辑配方')
  router.push(hasQuery ? { path, query } : path)
}

function publishOne(record) {
  Modal.confirm({
    title: '审核发布',
    content: `确定发布「${record.name}」吗？同一配方的旧版本会归档，该产品的其他生效配方保持不变。`,
    onOk: () => {
      try {
        publishFormula(record.id)
        message.success('审核发布成功，当前版本已生效')
      } catch (error) {
        message.error(error.message)
      }
    },
  })
}
function archiveOne(record) {
  Modal.confirm({
    title: '归档',
    content: record.isDefault
      ? `确定归档「${record.name}」吗？归档后该产品没有默认配方，生成批次指令时需要手工选择。`
      : `确定归档「${record.name}」吗？`,
    onOk: () => {
      try {
        archiveFormula(record.id)
        message.success('已归档')
      } catch (error) {
        message.error(error.message)
      }
    },
  })
}
function cloneOne(record) {
  const copy = cloneFormula(record.id)
  message.success(`已克隆为待发布配方 ${copy.formulaNo}`)
}
function onPendingAction(key, record) {
  if (key === 'delete') {
    Modal.confirm({
      title: '删除',
      content: `确定删除待发布配方「${record.name}」吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: () => {
        deleteFormula(record.id)
        message.success('已删除')
      },
    })
    return
  }
  if (key === 'clone') cloneOne(record)
}
function reviseOne(record) {
  try {
    const copy = reviseFormula(record.id)
    message.success(`已生成待发布版本 ${copy.version}`)
    goEdit(copy, {
      returnTo: `/product-process/bom/${copy.id}`,
      returnTitle: copy.name || copy.formulaNo || '配方详情',
    })
  } catch (error) {
    message.error(error.message)
  }
}

function onActiveAction(key, record) {
  if (key === 'archive') archiveOne(record)
  if (key === 'clone') cloneOne(record)
  if (key === 'default') {
    try {
      setDefaultFormula(record.id)
      message.success('已设为默认配方')
    } catch (error) {
      message.error(error.message)
    }
  }
}

function handleBatchPublish() {
  const targets = formulaState.formulas.filter(
    (row) => selectedRowKeys.value.includes(row.id) && row.status === 'pending',
  )
  if (!selectedRowKeys.value.length) {
    message.warning('请先选择要启用的配方')
    return
  }
  if (!targets.length) {
    message.warning('所选记录中没有「待发布」状态的配方')
    return
  }
  Modal.confirm({
    title: '批量审核发布',
    content: `确定审核发布选中的 ${targets.length} 条待发布配方吗？同一配方只保留一个生效版本，不同配方可以同时生效。`,
    onOk: () => {
      let ok = 0
      targets.forEach((row) => {
        try {
          publishFormula(row.id)
          ok += 1
        } catch (error) {
          message.error(`${row.formulaNo}：${error.message}`)
        }
      })
      if (ok) message.success(`已成功发布 ${ok} 条`)
      selectedRowKeys.value = []
    },
  })
}

function handleBatchArchive() {
  const targets = formulaState.formulas.filter(
    (row) => selectedRowKeys.value.includes(row.id) && row.status !== 'archived',
  )
  if (!selectedRowKeys.value.length) {
    message.warning('请先选择要归档的配方')
    return
  }
  if (!targets.length) {
    message.warning('所选记录均已归档')
    return
  }
  Modal.confirm({
    title: '批量归档',
    content: `确定归档选中的 ${targets.length} 条配方吗？`,
    onOk: () => {
      targets.forEach((row) => archiveFormula(row.id))
      message.success(`已归档 ${targets.length} 条`)
      selectedRowKeys.value = []
    },
  })
}

const exportFields = [
  { title: '配方编号', getValue: (row) => row.formulaNo },
  { title: '配方名称', getValue: (row) => row.name },
  { title: '配方类型', getValue: (row) => FORMULA_TYPE_LABEL[row.formulaType] || '标准配方' },
  { title: '主产品', getValue: (row) => itemLabel(row.itemId) },
  { title: '产品编码', getValue: (row) => itemCode(row.itemId) },
  { title: '工艺路线', getValue: (row) => routeLabel(row.routeId) },
  { title: '基准批量', getValue: (row) => row.baseBatchQty },
  { title: '理论得率', getValue: (row) => row.theoreticalYield },
  { title: '版本', getValue: (row) => row.version },
  { title: '状态', getValue: (row) => statusLabel(row.status) },
  {
    title: '默认',
    getValue: (row) => {
      if (row.status === 'active' && row.isDefault) return '默认'
      if (row.isDefault) return '发布后默认'
      return '—'
    },
  },
  { title: '创建人', getValue: (row) => row.creator || '—' },
  { title: '创建时间', getValue: (row) => row.createdAt || '—' },
  { title: '更新人', getValue: (row) => row.updater || '—' },
  { title: '更新时间', getValue: (row) => row.updatedAt || '—' },
]

function onExportMenu({ key }) {
  const rows =
    key === 'selected'
      ? formulaState.formulas.filter((row) => selectedRowKeys.value.includes(row.id))
      : filteredList.value
  if (!rows.length) {
    message.warning(key === 'selected' ? '请先选择要导出的配方' : '没有可导出的配方')
    return
  }
  exportRowsToExcel({
    rows,
    fields: exportFields,
    fileName: buildExportFileName(key === 'selected' ? '配方管理_选中' : '配方管理_全部'),
    sheetName: '配方',
  })
  message.success(`已导出 ${rows.length} 条`)
}
</script>

<style lang="less" scoped>
.product-bom-page {
  margin: -12px;
  padding: 12px;
  background: var(--page-bg, #f0f2f5);
}

.filter-card,
.table-card {
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.filter-card {
  padding: 10px 12px 6px;
  margin-bottom: 8px;
}

.horizontal-form {
  width: 100%;

  :deep(.ant-form-item) {
    width: 100%;
    margin-bottom: 0;
  }

  :deep(.ant-form-item-row) {
    flex-wrap: nowrap;
    align-items: center;
  }

  :deep(.ant-form-item-label > label) {
    height: 24px;
    line-height: 24px;
    font-size: 13px;
    white-space: nowrap;
  }
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.list-status-tabs {
  margin-bottom: 0;
  background: #fff;
  border: 1px solid var(--divider, #e5e6eb);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  padding: 0 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

  :deep(.ant-tabs-nav) {
    margin: 0;
  }

  :deep(.ant-tabs-nav::before) {
    border-bottom-color: #f0f0f0;
  }
}

.list-status-tabs + .table-card {
  border-radius: 0 0 6px 6px;
}

.table-card {
  padding: 8px 12px;

  :deep(.ant-table-thead > tr > th) {
    background: #fafafa;
    font-weight: 500;
    padding: 8px;
    font-size: 13px;
  }

  :deep(.ant-table-tbody > tr > td) {
    padding: 6px 8px;
    font-size: 13px;
  }
}

.link-name {
  color: #307068;
  cursor: pointer;

  &:hover {
    color: #4e8a82;
  }
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
