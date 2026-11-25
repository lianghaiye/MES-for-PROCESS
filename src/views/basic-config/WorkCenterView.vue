<template>
  <div class="list-page work-center-page">
    <div class="filter-card">
      <a-form layout="inline" class="filter-form horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="关键词">
              <a-input
                v-model:value="filters.keyword"
                allow-clear
                size="small"
                placeholder="编码/名称"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="机构类型">
              <a-select
                v-model:value="filters.orgType"
                allow-clear
                size="small"
                placeholder="全部"
                :options="orgTypeOpts"
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
                :options="statusOpts"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item class="filter-actions-item">
              <a-space>
                <a-button type="primary" size="small" @click="applySearch">查询</a-button>
                <a-button size="small" @click="resetSearch">重置</a-button>
              </a-space>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <div class="toolbar-row">
      <a-button type="primary" size="small" @click="openCreate">新增工作中心</a-button>
      <span class="hint">支持公司→工厂→部门→车间等层级；班组挂靠到车间类节点</span>
    </div>

    <div class="table-card">
      <a-table
        :columns="columns"
        :data-source="rows"
        row-key="id"
        size="small"
        :pagination="{
          pageSize: 20,
          size: 'small',
          showSizeChanger: true,
          showTotal: (n) => `共 ${n} 条`,
        }"
        :scroll="{ x: 1280 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'orgType'">
            {{ orgTypeLabel[record.orgType] || record.orgType || '—' }}
          </template>
          <template v-else-if="column.key === 'parent'">
            {{ parentName(record.parentId) }}
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === '启用' ? 'success' : 'default'">
              {{ record.status }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'groupCount'">
            {{ groupCount(record) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="8">
              <a class="link" @click="openEdit(record)">编辑</a>
              <a class="link danger" @click="handleDelete(record)">删除</a>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <WorkCenterFormModal v-model:open="modalOpen" :record="editRecord" @saved="noop" />
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import {
  ORG_TYPE_LABEL,
  ORG_TYPE_OPTIONS,
  deleteWorkCenter,
  formatWorkCenterLabel,
  getWorkCenterById,
  listWorkCenters,
  workCenterState,
} from '@/store/workCenterStore'
import { listGroupsByWorkCenter } from '@/store/employeeGroupStore'
import WorkCenterFormModal from './components/WorkCenterFormModal.vue'

const filters = reactive({ keyword: '', orgType: undefined, status: undefined })
const applied = reactive({ keyword: '', orgType: '', status: '' })
const modalOpen = ref(false)
const editRecord = ref(null)

const orgTypeOpts = ORG_TYPE_OPTIONS
const orgTypeLabel = ORG_TYPE_LABEL
const statusOpts = [
  { value: '启用', label: '启用' },
  { value: '禁用', label: '禁用' },
]

const columns = [
  { title: '编码', dataIndex: 'code', key: 'code', width: 130 },
  { title: '名称', dataIndex: 'name', key: 'name', width: 140 },
  { title: '机构类型', key: 'orgType', width: 90 },
  { title: '上级机构', key: 'parent', width: 140 },
  { title: '负责人', dataIndex: 'manager', key: 'manager', width: 90 },
  { title: '挂靠班组', key: 'groupCount', width: 90, align: 'right' },
  { title: '状态', key: 'status', width: 80 },
  { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
  { title: '更新', dataIndex: 'updatedAt', key: 'updatedAt', width: 110 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' },
]

const rows = computed(() => {
  void workCenterState.centers
  return listWorkCenters({
    keyword: applied.keyword || undefined,
    orgType: applied.orgType || undefined,
    status: applied.status || undefined,
  })
})

function groupCount(record) {
  return listGroupsByWorkCenter(record.id).length
}

function parentName(parentId) {
  if (!parentId) return '—'
  return getWorkCenterById(parentId)?.name || formatWorkCenterLabel(parentId)
}

function applySearch() {
  applied.keyword = filters.keyword || ''
  applied.orgType = filters.orgType || ''
  applied.status = filters.status || ''
}

function resetSearch() {
  filters.keyword = ''
  filters.orgType = undefined
  filters.status = undefined
  applied.keyword = ''
  applied.orgType = ''
  applied.status = ''
}

function openCreate() {
  editRecord.value = null
  modalOpen.value = true
}

function openEdit(record) {
  editRecord.value = record
  modalOpen.value = true
}

function handleDelete(record) {
  Modal.confirm({
    title: '确认删除该工作中心？',
    content: record.name,
    okText: '删除',
    okType: 'danger',
    onOk: () => {
      try {
        deleteWorkCenter(record.id)
        message.success('已删除')
      } catch (err) {
        message.error(err?.message || '删除失败')
      }
    },
  })
}

function noop() {}
</script>

<style scoped lang="less">
.work-center-page {
  margin: -12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.filter-card,
.toolbar-row,
.table-card {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
}
.toolbar-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 48px;
}
.hint {
  font-size: 13px;
  color: #86909c;
}
.link {
  color: #1677ff;
  cursor: pointer;
  &.danger {
    color: #ff4d4f;
  }
}
</style>
