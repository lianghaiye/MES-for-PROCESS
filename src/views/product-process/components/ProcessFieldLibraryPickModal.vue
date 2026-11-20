<template>
  <a-modal
    :open="open"
    title="从采集指标库添加"
    :width="modalWidth"
    :mask-closable="false"
    destroy-on-close
    @cancel="handleCancel"
  >
    <a-form :model="filters" layout="inline" class="filter-form horizontal-form">
      <a-row :gutter="[12, 8]" style="width: 100%">
        <a-col :span="10">
          <a-form-item label="关键词">
            <a-input
              v-model:value="filters.keyword"
              allow-clear
              size="small"
              placeholder="编码/名称"
              @press-enter="handleSearch"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="类型">
            <a-select
              v-model:value="filters.type"
              allow-clear
              size="small"
              placeholder="全部"
              :options="typeOpts"
            />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item>
            <a-space>
              <a-button type="primary" size="small" @click="handleSearch">搜索</a-button>
              <a-button size="small" @click="handleReset">清空</a-button>
            </a-space>
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>

    <a-table
      :columns="columns"
      :data-source="pagedList"
      row-key="id"
      size="small"
      bordered
      :pagination="false"
      :scroll="{ y: 360 }"
      :row-selection="rowSelection"
      children-column-name="__noTreeChildren__"
    >
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'index'">{{ rowIndex(index) }}</template>
        <template v-else-if="column.key === 'type'">
          <a-tag :color="fieldTypeTagColor(record.type)">{{ qcFieldTypeLabel(record.type) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'source'">
          <a-tag v-if="record.isSystem" color="blue">系统</a-tag>
          <span v-else>手工</span>
        </template>
        <template v-else-if="column.key === 'inTemplate'">
          <a-tag v-if="isInTemplate(record)" color="default">已在模板</a-tag>
          <span v-else class="muted">—</span>
        </template>
        <template v-else>{{ record[column.dataIndex] || '—' }}</template>
      </template>
    </a-table>
    <div class="pager">
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

    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" :disabled="!selectedRows.length" @click="handleConfirm">
        确定 ({{ selectedRows.length }})
      </a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  fieldTypeTagColor,
  processFieldLibraryTypeOptions,
  qcFieldTypeLabel,
} from '@/mock/processFieldLibrary'
import { listProcessLibraryFields } from '@/store/processFieldLibraryStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  existingFields: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:open', 'confirm'])

const modalWidth = 'min(960px, 90vw)'
const filters = reactive({ keyword: '', type: undefined })
const applied = ref({ keyword: '', type: undefined })
const selectedRowKeys = ref([])
const selectedRows = ref([])
const pagination = reactive({ current: 1, pageSize: 10 })
const typeOpts = processFieldLibraryTypeOptions

const columns = [
  { title: '#', key: 'index', width: 48, align: 'center' },
  { title: '编码', dataIndex: 'code', width: 140 },
  { title: '名称', dataIndex: 'name', width: 140 },
  { title: '类型', key: 'type', width: 100 },
  { title: '来源', key: 'source', width: 80 },
  { title: '状态', key: 'inTemplate', width: 90 },
]

const existingCodeSet = computed(() => {
  const set = new Set()
  ;(props.existingFields || []).forEach((f) => {
    const c = String(f.code || '')
      .trim()
      .toUpperCase()
    if (c) set.add(c)
  })
  return set
})

function isInTemplate(record) {
  return existingCodeSet.value.has(
    String(record.code || '')
      .trim()
      .toUpperCase(),
  )
}

const filteredList = computed(() =>
  listProcessLibraryFields({
    status: '启用',
    keyword: applied.value.keyword,
    type: applied.value.type,
  }),
)

const pagedList = computed(() => {
  const start = (pagination.current - 1) * pagination.pageSize
  return filteredList.value.slice(start, start + pagination.pageSize)
})

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  preserveSelectedRowKeys: true,
  onChange: (keys, rows) => {
    selectedRowKeys.value = keys
    const map = new Map(selectedRows.value.map((r) => [r.id, r]))
    rows.forEach((r) => {
      if (r?.id) map.set(r.id, r)
    })
    selectedRows.value = keys.map((key) => map.get(key)).filter(Boolean)
  },
  getCheckboxProps: (record) => ({ disabled: isInTemplate(record) }),
}))

function rowIndex(index) {
  return (pagination.current - 1) * pagination.pageSize + index + 1
}

function handleSearch() {
  applied.value = { keyword: filters.keyword, type: filters.type }
  pagination.current = 1
}

function handleReset() {
  filters.keyword = ''
  filters.type = undefined
  handleSearch()
}

function handleCancel() {
  emit('update:open', false)
}

function handleConfirm() {
  emit(
    'confirm',
    selectedRows.value.filter((r) => !isInTemplate(r)),
  )
  emit('update:open', false)
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    selectedRowKeys.value = []
    selectedRows.value = []
    handleReset()
  },
)
</script>

<style scoped>
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.muted {
  color: #86909c;
}
</style>
