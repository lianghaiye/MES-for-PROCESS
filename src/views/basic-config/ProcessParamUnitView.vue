<template>
  <div class="param-unit-page">
    <div class="filter-card">
      <a-form layout="inline" class="filter-form horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="单位">
              <a-input
                v-model:value="filters.keyword"
                allow-clear
                size="small"
                placeholder="符号/编码"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="类别">
              <a-select
                v-model:value="filters.category"
                allow-clear
                size="small"
                placeholder="全部"
                :options="categoryOptions"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="状态">
              <a-select
                v-model:value="filters.status"
                allow-clear
                size="small"
                placeholder="全部"
                :options="statusOptions"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item class="filter-actions-item">
              <a-space>
                <a-button type="primary" size="small" @click="handleSearch">查询</a-button>
                <a-button size="small" @click="handleReset">清空</a-button>
              </a-space>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <div class="toolbar-row">
      <a-button type="primary" size="small" @click="openCreate">新增单位</a-button>
    </div>

    <div class="table-card">
      <a-table
        :columns="columns"
        :data-source="filteredList"
        row-key="id"
        size="small"
        :pagination="{ pageSize: 10, size: 'small', showSizeChanger: true }"
        :scroll="{ x: 880 }"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">{{ index + 1 }}</template>
          <template v-else-if="column.key === 'remark'">{{ record.remark || '—' }}</template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === '启用' ? 'success' : 'default'">{{
              record.status
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-button type="link" size="small" @click="toggleStatus(record)">
              {{ record.status === '启用' ? '停用' : '启用' }}
            </a-button>
            <a-button type="link" size="small" danger @click="handleDelete(record)">删除</a-button>
          </template>
        </template>
      </a-table>
    </div>

    <ProcessParamUnitFormModal v-model:open="modalOpen" :record="editRecord" />
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import ProcessParamUnitFormModal from './components/ProcessParamUnitFormModal.vue'
import {
  PARAM_UNIT_CATEGORIES,
  PARAM_UNIT_STATUS,
  deleteProcessParamUnit,
  listProcessParamUnits,
  processParamUnitState,
  setProcessParamUnitStatus,
} from '@/store/processParamUnitStore'

const filters = reactive({ keyword: '', category: undefined, status: undefined })
const applied = reactive({ keyword: '', category: undefined, status: undefined })
const modalOpen = ref(false)
const editRecord = ref(null)
const categoryOptions = PARAM_UNIT_CATEGORIES.map((item) => ({ label: item, value: item }))
const statusOptions = [
  { label: '启用', value: PARAM_UNIT_STATUS.ENABLED },
  { label: '停用', value: PARAM_UNIT_STATUS.DISABLED },
]
const columns = [
  { title: '序号', key: 'index', width: 64, align: 'center' },
  { title: '编码', dataIndex: 'code', width: 110 },
  { title: '单位', dataIndex: 'name', width: 120 },
  { title: '类别', dataIndex: 'category', width: 100 },
  { title: '备注', key: 'remark', dataIndex: 'remark' },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 180 },
]

const filteredList = computed(() => {
  void processParamUnitState.units
  const keyword = applied.keyword.trim().toLowerCase()
  return listProcessParamUnits().filter((row) => {
    if (keyword && !`${row.name} ${row.code}`.toLowerCase().includes(keyword)) return false
    if (applied.category && row.category !== applied.category) return false
    if (applied.status && row.status !== applied.status) return false
    return true
  })
})

function handleSearch() {
  applied.keyword = filters.keyword
  applied.category = filters.category
  applied.status = filters.status
}

function handleReset() {
  filters.keyword = ''
  filters.category = undefined
  filters.status = undefined
  handleSearch()
}

function openCreate() {
  editRecord.value = null
  modalOpen.value = true
}

function openEdit(record) {
  editRecord.value = record
  modalOpen.value = true
}

function toggleStatus(record) {
  const next =
    record.status === PARAM_UNIT_STATUS.ENABLED
      ? PARAM_UNIT_STATUS.DISABLED
      : PARAM_UNIT_STATUS.ENABLED
  const result = setProcessParamUnitStatus(record.id, next)
  if (!result.ok) {
    message.warning(result.message)
    return
  }
  message.success(`已${next}`)
}

function handleDelete(record) {
  Modal.confirm({
    title: '删除工艺参数单位',
    content: `删除「${record.name}」后，新的配方参数不能再选它。已经写在配方上的单位保持原样。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      const result = deleteProcessParamUnit(record.id)
      if (!result.ok) {
        message.warning(result.message)
        return
      }
      message.success('已删除')
    },
  })
}
</script>

<style scoped>
.param-unit-page .filter-card,
.param-unit-page .table-card {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}
.param-unit-page .toolbar-row {
  margin-bottom: 8px;
}
</style>
