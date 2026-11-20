<template>
  <div class="list-page process-form-template-page">
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
            <a-form-item label="模板编码">
              <a-input v-model:value="filters.code" allow-clear size="small" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="模板名称">
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
          新增模板
        </a-button>
        <a-button size="small" @click="goFieldLibrary">去采集指标库</a-button>
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
          </template>
          <template v-else-if="column.dataIndex === 'code'">
            <a class="link-code" @click.prevent="handleEdit(record)">{{ record.code || '—' }}</a>
          </template>
          <template v-else-if="column.key === 'fieldCount'">
            {{ record.fields?.length || 0 }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
              <a-button type="link" size="small" @click="toggleStatus(record)">
                {{ record.status === '启用' ? '停用' : '启用' }}
              </a-button>
              <a-button type="link" size="small" danger @click="handleRemove(record)"
                >删除</a-button
              >
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
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import {
  listProcessFormTemplates,
  processFormTemplateState,
  removeProcessFormTemplate,
  setProcessFormTemplateStatus,
} from '@/store/processFormTemplateStore'
import { findCreatePageByListPath } from '@/config/createPages'
import { openCreateTab } from '@/utils/openCreateTab'
import { useTabs } from '@/composables/useTabs'
import '@/styles/list-page-layout.less'

defineOptions({ name: 'ProcessFormTemplateView' })

const router = useRouter()
const { openTab } = useTabs()
const createPage = findCreatePageByListPath('/product-process/process-form')

const statusOpts = [
  { value: '启用', label: '启用' },
  { value: '停用', label: '停用' },
]

const filters = reactive({
  status: undefined,
  code: '',
  name: '',
})
const appliedFilters = ref({ ...filters })
const pagination = reactive({ current: 1, pageSize: 10 })

const columns = [
  { title: '序号', key: 'index', width: 56, align: 'center', fixed: 'left' },
  { title: '状态', key: 'status', width: 88, fixed: 'left' },
  { title: '模板编码', dataIndex: 'code', width: 140, fixed: 'left' },
  { title: '模板名称', dataIndex: 'name', width: 160, ellipsis: true },
  { title: '指标数', key: 'fieldCount', width: 80, align: 'center' },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
  { title: '更新人', dataIndex: 'updater', width: 90 },
  { title: '更新时间', dataIndex: 'updatedAt', width: 160 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' },
]

const filteredList = computed(() => {
  void processFormTemplateState.templates.length
  return listProcessFormTemplates(appliedFilters.value)
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

function handleSearch() {
  appliedFilters.value = { ...filters }
  pagination.current = 1
}

function handleReset() {
  filters.status = undefined
  filters.code = ''
  filters.name = ''
  handleSearch()
}

function goFieldLibrary() {
  router.push('/product-process/process-field-library')
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
    title: `编辑过程记录模板 ${record.code || record.name || ''}`.trim(),
    query: { id: record.id },
  })
}

function toggleStatus(record) {
  const next = record.status === '启用' ? '停用' : '启用'
  Modal.confirm({
    title: '操作确认',
    content: `确定要${next}过程记录模板「${record.name}」吗？`,
    onOk: () => {
      const res = setProcessFormTemplateStatus(record.id, next)
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
    content: `确定删除过程记录模板「${record.name}」吗？`,
    okType: 'danger',
    okText: '删除',
    onOk: () => {
      const res = removeProcessFormTemplate(record.id)
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
