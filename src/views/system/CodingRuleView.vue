<template>
  <div class="coding-rule-page">
    <div class="filter-card">
      <a-form layout="inline" :model="filters" class="filter-form horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="规则名称">
              <a-input
                v-model:value="filters.name"
                allow-clear
                size="small"
                placeholder="名称 / 编码"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="所属业务">
              <a-select
                v-model:value="filters.business"
                allow-clear
                size="small"
                placeholder="全部"
                :options="BUSINESS_OPTIONS"
                show-search
                option-filter-prop="label"
              />
            </a-form-item>
          </a-col>
          <a-col v-if="filterExpanded" :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="状态">
              <a-select
                v-model:value="filters.status"
                allow-clear
                size="small"
                placeholder="全部"
                :options="statusOpts"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item class="filter-actions-item">
              <a-space>
                <a-button type="primary" size="small" @click="handleSearch">
                  <SearchOutlined />
                  搜索
                </a-button>
                <a-button size="small" @click="handleReset">重置</a-button>
                <a-button type="link" size="small" @click="filterExpanded = !filterExpanded">
                  {{ filterExpanded ? '收起' : '展开' }}
                </a-button>
              </a-space>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <div class="toolbar-row">
      <a-space wrap :size="8">
        <a-button type="primary" size="small" @click="openCreate">
          <PlusOutlined />
          新增
        </a-button>
        <a-button
          size="small"
          danger
          :disabled="!selectedRowKeys.length"
          @click="handleBatchDelete"
        >
          删除
        </a-button>
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

    <div class="table-card">
      <a-table
        :columns="displayColumns"
        :data-source="pagedList"
        row-key="id"
        size="small"
        bordered
        :row-selection="rowSelection"
        :scroll="{ x: tableScrollX }"
        :pagination="false"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">
            {{ (pagination.current - 1) * pagination.pageSize + index + 1 }}
          </template>
          <template v-else-if="column.key === 'business'">
            {{ BUSINESS_LABEL[record.business] || record.business || '—' }}
          </template>
          <template v-else-if="column.key === 'separator'">
            {{ record.separator === '' ? '无' : record.separator || '—' }}
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === '启用' ? 'success' : 'default'">{{
              record.status
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-space :size="8">
              <a @click="openView(record)">
                <EyeOutlined />
                查看
              </a>
              <a @click="openEdit(record)">
                <EditOutlined />
                编辑
              </a>
              <a class="danger-link" @click="handleDelete(record)">
                <DeleteOutlined />
                删除
              </a>
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
          :page-size-options="['10', '20', '50']"
          :show-total="(t) => `共 ${t} 条`"
        />
      </div>
    </div>

    <CodingRuleFormModal
      v-model:open="modalOpen"
      :record="editRecord"
      :mode="modalMode"
      @saved="handleSearch"
    />

    <TableColumnSettingDrawer
      v-model:open="columnDrawerOpen"
      v-model:settings="columnSettings"
      :default-settings="defaultColumnSettings"
    />
  </div>
</template>

<script>
export default { name: 'CodingRuleView' }
</script>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import {
  BUSINESS_LABEL,
  BUSINESS_OPTIONS,
  RULE_STATUS,
  codingRuleState,
  deleteCodingRule,
  deleteCodingRules,
  listCodingRules,
} from '@/store/codingRuleStore'
import CodingRuleFormModal from './components/CodingRuleFormModal.vue'
import TableColumnSettingDrawer from '@/components/TableColumnSettingDrawer.vue'
import TableColumnSettingButton from '@/components/TableColumnSettingButton.vue'
import { useTableColumnSettings } from '@/composables/useTableColumnSettings'

const filters = reactive({
  name: '',
  business: undefined,
  status: undefined,
})
const applied = ref({
  name: '',
  business: undefined,
  status: undefined,
})
const filterExpanded = ref(false)
const pagination = reactive({ current: 1, pageSize: 10 })
const selectedRowKeys = ref([])
const modalOpen = ref(false)
const modalMode = ref('create')
const editRecord = ref(null)

const statusOpts = [
  { label: RULE_STATUS.ENABLED, value: RULE_STATUS.ENABLED },
  { label: RULE_STATUS.DISABLED, value: RULE_STATUS.DISABLED },
]

const filteredList = computed(() => {
  void codingRuleState.rules
  return listCodingRules(applied.value)
})

const pagedList = computed(() => {
  const start = (pagination.current - 1) * pagination.pageSize
  return filteredList.value.slice(start, start + pagination.pageSize)
})

watch(filteredList, () => {
  const maxPage = Math.max(1, Math.ceil(filteredList.value.length / pagination.pageSize) || 1)
  if (pagination.current > maxPage) pagination.current = 1
})

const baseColumns = [
  { title: '#', key: 'index', width: 56, align: 'center' },
  { title: '规则名称', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
  { title: '规则编码', dataIndex: 'code', key: 'code', width: 160, ellipsis: true },
  { title: '所属业务', key: 'business', width: 200, ellipsis: true },
  { title: '段落数', dataIndex: 'segmentCount', key: 'segmentCount', width: 80, align: 'right' },
  { title: '段落分隔符', key: 'separator', width: 100, align: 'center' },
  { title: '状态', key: 'status', width: 88, align: 'center' },
  { title: '操作', key: 'actions', width: 200, fixed: 'right' },
]

const { columnSettings, columnDrawerOpen, displayColumns, tableScrollX, defaultColumnSettings } =
  useTableColumnSettings('system-coding-rule-v2', baseColumns)

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys) => {
    selectedRowKeys.value = keys
  },
}))

function handleSearch() {
  applied.value = {
    name: filters.name,
    business: filters.business,
    status: filters.status,
  }
  pagination.current = 1
  selectedRowKeys.value = []
}

function handleReset() {
  filters.name = ''
  filters.business = undefined
  filters.status = undefined
  handleSearch()
}

function openCreate() {
  editRecord.value = null
  modalMode.value = 'create'
  modalOpen.value = true
}

function openEdit(record) {
  editRecord.value = record
  modalMode.value = 'edit'
  modalOpen.value = true
}

function openView(record) {
  editRecord.value = record
  modalMode.value = 'view'
  modalOpen.value = true
}

function handleDelete(record) {
  Modal.confirm({
    title: `确定删除编码规则「${record.name}」？`,
    content: '删除后，对应单据将回退到系统内置编号逻辑（若有）。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      const res = deleteCodingRule(record.id)
      if (!res.ok) {
        message.warning(res.message)
        return
      }
      message.success('已删除')
      selectedRowKeys.value = selectedRowKeys.value.filter((k) => k !== record.id)
    },
  })
}

function handleBatchDelete() {
  if (!selectedRowKeys.value.length) return
  Modal.confirm({
    title: `确定删除选中的 ${selectedRowKeys.value.length} 条规则？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      const res = deleteCodingRules(selectedRowKeys.value)
      if (!res.ok) {
        message.warning(res.message)
        return
      }
      message.success(`已删除 ${res.deleted} 条`)
      selectedRowKeys.value = []
    },
  })
}
</script>

<style lang="less" scoped>
.coding-rule-page {
  padding: 0;
}
.filter-card {
  padding: 10px 12px 6px;
  margin-bottom: 8px;
  background: #fff;
}
.horizontal-form {
  width: 100%;
  :deep(.ant-form-item) {
    width: 100%;
    margin-bottom: 0;
  }
  .filter-actions-item {
    :deep(.ant-form-item-label) {
      display: none;
    }
  }
}
.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}
.toolbar-icons {
  margin-left: auto;
}
.table-card {
  background: #fff;
  padding: 8px 12px 12px;
  border-radius: 4px;
}
.table-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.danger-link {
  color: #ff4d4f;
}
</style>
