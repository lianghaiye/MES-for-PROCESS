<template>
  <div class="list-page process-field-library-page">
    <div class="filter-card">
      <a-form :model="filters" layout="inline" class="filter-form horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="状态">
              <a-select
                v-model:value="filters.status"
                allow-clear
                size="small"
                placeholder="请选择"
                :options="statusOpts"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="字段类型">
              <a-select
                v-model:value="filters.type"
                allow-clear
                size="small"
                placeholder="请选择"
                :options="typeOpts"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="指标编码">
              <a-input v-model:value="filters.code" allow-clear size="small" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="名称">
              <a-input v-model:value="filters.name" allow-clear size="small" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item class="filter-actions-item">
              <a-space>
                <a-button type="primary" size="small" @click="handleSearch">
                  <SearchOutlined />
                  搜索
                </a-button>
                <a-button size="small" @click="handleReset">清空</a-button>
              </a-space>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <div class="toolbar-row">
      <a-space wrap :size="8">
        <a-button type="primary" size="small" @click="handleCreate">
          <PlusOutlined />
          新增采集指标
        </a-button>
      </a-space>
      <a-space :size="4" class="toolbar-icons">
        <a-tooltip title="刷新">
          <a-button type="text" size="small" @click="handleSearch">
            <ReloadOutlined />
          </a-button>
        </a-tooltip>
      </a-space>
    </div>

    <div class="table-card">
      <a-table
        :columns="columns"
        :data-source="pagedList"
        row-key="id"
        size="small"
        bordered
        :pagination="false"
        :scroll="{ x: 1100 }"
        children-column-name="__noTreeChildren__"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">
            {{ (pagination.current - 1) * pagination.pageSize + index + 1 }}
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === '启用' ? 'success' : 'default'">{{
              record.status || '—'
            }}</a-tag>
            <a-tag v-if="record.isSystem" color="blue" style="margin-left: 4px">系统</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'code'">
            <a class="link-code" @click.prevent="openDetail(record)">{{ record.code || '—' }}</a>
          </template>
          <template v-else-if="column.key === 'type'">
            <a-tag :color="fieldTypeTagColor(record.type)">{{
              qcFieldTypeLabel(record.type)
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'required'">
            <a-tag :color="record.required ? 'blue' : 'default'">{{
              record.required ? '必填' : '非必填'
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'unit'">
            {{ displayUnit(record) }}
          </template>
          <template v-else-if="column.key === 'source'">
            {{ record.valueSource === 'system' ? '系统带出' : '手工录入' }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="toggleStatus(record)">
                {{ record.status === '启用' ? '停用' : '启用' }}
              </a-button>
              <a-button v-if="!record.isSystem" type="link" size="small" @click="handleEdit(record)"
                >编辑</a-button
              >
              <a-button
                v-if="!record.isSystem"
                type="link"
                size="small"
                danger
                @click="handleRemove(record)"
              >
                删除
              </a-button>
            </a-space>
          </template>
          <template v-else>
            {{ displayCell(record, column) }}
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
          show-quick-jumper
          :page-size-options="['10', '20', '50', '100']"
          :show-total="(t) => `共 ${t} 条`"
        />
      </div>
    </div>

    <ProcessFieldLibraryDetailDrawer v-model:open="detailOpen" :record="detailRecord" />
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  fieldTypeTagColor,
  processFieldLibraryStatusOptions,
  processFieldLibraryTypeOptions,
  qcFieldTypeLabel,
} from '@/mock/processFieldLibrary'
import {
  listProcessLibraryFields,
  processFieldLibraryState,
  removeProcessLibraryField,
  updateProcessLibraryField,
} from '@/store/processFieldLibraryStore'
import { findCreatePageByListPath } from '@/config/createPages'
import { openCreateTab } from '@/utils/openCreateTab'
import { useTabs } from '@/composables/useTabs'
import ProcessFieldLibraryDetailDrawer from '@/views/product-process/components/ProcessFieldLibraryDetailDrawer.vue'
import '@/styles/list-page-layout.less'

defineOptions({ name: 'ProcessFieldLibraryView' })

const router = useRouter()
const { openTab } = useTabs()
const createPage = findCreatePageByListPath('/product-process/process-field-library')

const statusOpts = processFieldLibraryStatusOptions.map((v) => ({ label: v, value: v }))
const typeOpts = processFieldLibraryTypeOptions

const filters = reactive({
  status: undefined,
  type: undefined,
  code: '',
  name: '',
})
const appliedFilters = ref({ ...filters })
const pagination = reactive({ current: 1, pageSize: 10 })
const detailOpen = ref(false)
const detailRecord = ref(null)

const columns = [
  { title: '序号', key: 'index', width: 56, align: 'center', fixed: 'left' },
  { title: '状态', key: 'status', width: 110, fixed: 'left' },
  { title: '指标编码', dataIndex: 'code', width: 140, fixed: 'left' },
  { title: '名称', dataIndex: 'name', width: 140, ellipsis: true },
  { title: '字段类型', key: 'type', width: 120 },
  { title: '必填', key: 'required', width: 80, align: 'center' },
  { title: '单位', key: 'unit', width: 96 },
  { title: '取值来源', key: 'source', width: 100 },
  { title: '创建人', dataIndex: 'creator', width: 90 },
  { title: '创建时间', dataIndex: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' },
]

const filteredList = computed(() => {
  void processFieldLibraryState.fields.length
  return listProcessLibraryFields(appliedFilters.value)
})

const pagedList = computed(() => {
  const start = (pagination.current - 1) * pagination.pageSize
  return filteredList.value.slice(start, start + pagination.pageSize)
})

function displayCell(record, column) {
  const key = column.dataIndex || column.key
  const val = record[key]
  return val !== undefined && val !== null && String(val).trim() !== '' ? val : '—'
}

function displayUnit(record) {
  if (!record?.withUnit && !record?.unit) return '—'
  const unit = String(record.unit || '').trim()
  if (!unit) return '—'
  return record.unitPosition === 'prefix' ? `${unit}（前）` : `${unit}（后）`
}

function handleSearch() {
  appliedFilters.value = { ...filters }
  pagination.current = 1
}

function handleReset() {
  filters.status = undefined
  filters.type = undefined
  filters.code = ''
  filters.name = ''
  handleSearch()
}

function handleCreate() {
  if (!createPage) {
    message.warning('未配置新增页')
    return
  }
  openCreateTab(router, openTab, {
    path: createPage.newPath,
    title: createPage.title,
  })
}

function handleEdit(record) {
  if (!createPage || !record?.id) return
  openCreateTab(router, openTab, {
    path: createPage.newPath,
    title: `编辑采集指标 ${record.code || record.name || ''}`.trim(),
    query: { id: record.id },
  })
}

function openDetail(record) {
  detailRecord.value = record
  detailOpen.value = true
}

function toggleStatus(record) {
  const next = record.status === '启用' ? '停用' : '启用'
  Modal.confirm({
    title: '操作确认',
    content: `确定要${next}采集指标「${record.name}」吗？`,
    onOk: () => {
      const res = updateProcessLibraryField(record.id, { status: next })
      if (!res.ok) {
        message.warning(res.message || '操作失败')
        return
      }
      message.success(`已${next}`)
    },
  })
}

function handleRemove(record) {
  Modal.confirm({
    title: '删除确认',
    content: `确定删除采集指标「${record.name}」吗？已被过程记录模板引用的项无法删除。`,
    okType: 'danger',
    okText: '删除',
    onOk: () => {
      const res = removeProcessLibraryField(record.id)
      if (!res.ok) {
        message.warning(res.message || '删除失败')
        return
      }
      message.success('已删除')
    },
  })
}
</script>

<style scoped lang="less">
.toolbar-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: #fff;
  border: 1px solid var(--divider, #e5e6eb);
  border-radius: 6px;
}

.filter-actions-item :deep(.ant-form-item-control-input-content) {
  display: flex;
}
</style>
