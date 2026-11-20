<template>
  <div class="list-page shift-energy-page">
    <div class="filter-card">
      <a-form layout="inline" class="filter-form horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="日期">
              <a-range-picker v-model:value="filters.dateRange" size="small" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="车间">
              <a-select
                v-model:value="filters.workshop"
                allow-clear
                size="small"
                placeholder="全部"
                :options="workshopOptions"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="班次">
              <a-select
                v-model:value="filters.shift"
                allow-clear
                size="small"
                placeholder="全部"
                :options="shiftOptions"
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
      <a-space>
        <a-button type="primary" size="small" @click="openCreate">交班填报</a-button>
      </a-space>
    </div>

    <a-alert
      type="info"
      show-icon
      class="summary-bar"
      message="按天、班次、车间登记用电/蒸汽与故障停时，不拆到槽次；计划详情按期间汇总能耗单耗与故障停时。"
    />

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
        :scroll="{ x: 1180 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'workshop'">
            {{ workshopLabel[record.workshop] || '—' }}
          </template>
          <template v-else-if="column.key === 'shift'">
            <a-tag>{{ shiftLabel[record.shift] || '—' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'electricityKwh'">
            {{ formatNum(record.electricityKwh, 2) }}
          </template>
          <template v-else-if="column.key === 'steamTon'">
            {{ formatNum(record.steamTon, 3) }}
          </template>
          <template v-else-if="column.key === 'downtimeHours'">
            {{ formatNum(record.downtimeHours, 2) }}
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

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑交班填报' : '交班填报'"
      :width="720"
      :mask-closable="false"
      destroy-on-close
      @cancel="handleCancel"
    >
      <div class="modal-basic-card">
        <div class="section-title">基本信息</div>
        <a-form layout="inline" class="horizontal-form" :model="form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="8">
              <a-form-item label="日期" required>
                <a-date-picker v-model:value="form.date" size="small" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="班次" required>
                <a-select
                  v-model:value="form.shift"
                  size="small"
                  :options="shiftOptions"
                  placeholder="请选择"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="车间" required>
                <a-select
                  v-model:value="form.workshop"
                  size="small"
                  :options="workshopOptions"
                  placeholder="请选择"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="用电量">
                <a-input-number
                  v-model:value="form.electricityKwh"
                  size="small"
                  :min="0"
                  :precision="2"
                  style="width: 100%"
                  addon-after="kWh"
                  placeholder="本班表计"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="蒸汽">
                <a-input-number
                  v-model:value="form.steamTon"
                  size="small"
                  :min="0"
                  :precision="3"
                  style="width: 100%"
                  addon-after="t"
                  placeholder="选填"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="故障停时">
                <a-input-number
                  v-model:value="form.downtimeHours"
                  size="small"
                  :min="0"
                  :precision="2"
                  style="width: 100%"
                  addon-after="h"
                  placeholder="无故障填 0"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="停时说明" class="remark-item">
                <a-input
                  v-model:value="form.downtimeReason"
                  size="small"
                  placeholder="设备/原因，选填"
                  allow-clear
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="备注" class="remark-item">
                <a-textarea v-model:value="form.remark" :rows="2" size="small" placeholder="选填" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </div>
      <a-alert
        type="info"
        show-icon
        class="modal-tip"
        message="同一天、同一班次、同一车间只保留一条；再次填报会覆盖。能耗不按槽次拆分。"
      />
      <template #footer>
        <a-button @click="handleCancel">取消</a-button>
        <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
      </template>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { Modal, message } from 'ant-design-vue'
import {
  SHIFT_LABEL,
  SHIFT_OPTIONS,
  WORKSHOP_LABEL,
  WORKSHOP_OPTIONS,
  deleteShiftEnergyReport,
  listShiftEnergyReports,
  saveShiftEnergyReport,
  shiftEnergyReportState,
} from '@/store/shiftEnergyReportStore'

const shiftOptions = SHIFT_OPTIONS
const workshopOptions = WORKSHOP_OPTIONS
const shiftLabel = SHIFT_LABEL
const workshopLabel = WORKSHOP_LABEL

const filters = reactive({
  dateRange: null,
  workshop: undefined,
  shift: undefined,
})
const applied = reactive({
  dateFrom: '',
  dateTo: '',
  workshop: '',
  shift: '',
})

const modalOpen = ref(false)
const editingId = ref('')
const saving = ref(false)
const dirty = ref(false)
const form = reactive(emptyForm())

const columns = [
  { title: '日期', dataIndex: 'date', key: 'date', width: 110 },
  { title: '班次', key: 'shift', width: 80 },
  { title: '车间', key: 'workshop', width: 110 },
  { title: '用电 (kWh)', key: 'electricityKwh', width: 110, align: 'right' },
  { title: '蒸汽 (t)', key: 'steamTon', width: 100, align: 'right' },
  { title: '故障停时 (h)', key: 'downtimeHours', width: 120, align: 'right' },
  {
    title: '停时说明',
    dataIndex: 'downtimeReason',
    key: 'downtimeReason',
    width: 160,
    ellipsis: true,
  },
  { title: '填报人', dataIndex: 'reporter', key: 'reporter', width: 100 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 140 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' },
]

const rows = computed(() => {
  void shiftEnergyReportState.reports
  return listShiftEnergyReports({
    dateFrom: applied.dateFrom || undefined,
    dateTo: applied.dateTo || undefined,
    workshop: applied.workshop || undefined,
    shift: applied.shift || undefined,
  })
})

function emptyForm() {
  return {
    date: dayjs(),
    shift: 'day',
    workshop: 'acid_leach',
    electricityKwh: null,
    steamTon: null,
    downtimeHours: null,
    downtimeReason: '',
    remark: '',
  }
}

function formatNum(val, decimals) {
  const n = Number(val)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(decimals)
}

function applySearch() {
  const range = filters.dateRange
  applied.dateFrom = range?.[0] ? dayjs(range[0]).format('YYYY-MM-DD') : ''
  applied.dateTo = range?.[1] ? dayjs(range[1]).format('YYYY-MM-DD') : ''
  applied.workshop = filters.workshop || ''
  applied.shift = filters.shift || ''
}

function resetSearch() {
  filters.dateRange = null
  filters.workshop = undefined
  filters.shift = undefined
  applied.dateFrom = ''
  applied.dateTo = ''
  applied.workshop = ''
  applied.shift = ''
}

function openCreate() {
  editingId.value = ''
  Object.assign(form, emptyForm())
  modalOpen.value = true
  nextTick(() => {
    dirty.value = false
  })
}

function openEdit(record) {
  editingId.value = record.id
  Object.assign(form, {
    date: dayjs(record.date),
    shift: record.shift,
    workshop: record.workshop,
    electricityKwh: record.electricityKwh || null,
    steamTon: record.steamTon || null,
    downtimeHours: record.downtimeHours || null,
    downtimeReason: record.downtimeReason || '',
    remark: record.remark || '',
  })
  modalOpen.value = true
  nextTick(() => {
    dirty.value = false
  })
}

function handleCancel() {
  if (!dirty.value) {
    modalOpen.value = false
    return
  }
  Modal.confirm({
    title: '内容未保存，确认离开？',
    okText: '离开',
    cancelText: '继续编辑',
    onOk: () => {
      modalOpen.value = false
      dirty.value = false
    },
  })
}

async function handleSave() {
  saving.value = true
  try {
    saveShiftEnergyReport(
      {
        date: form.date,
        shift: form.shift,
        workshop: form.workshop,
        electricityKwh: form.electricityKwh,
        steamTon: form.steamTon,
        downtimeHours: form.downtimeHours,
        downtimeReason: form.downtimeReason,
        remark: form.remark,
        source: 'web',
      },
      editingId.value || undefined,
    )
    message.success('保存成功')
    dirty.value = false
    modalOpen.value = false
  } catch (err) {
    message.error(err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function handleDelete(record) {
  Modal.confirm({
    title: '确认删除该交班填报？',
    content: `${record.date} ${shiftLabel[record.shift] || ''} · ${workshopLabel[record.workshop] || ''}`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => {
      try {
        deleteShiftEnergyReport(record.id)
        message.success('已删除')
      } catch (err) {
        message.error(err?.message || '删除失败')
      }
    },
  })
}

watch(
  () => ({ ...form }),
  () => {
    if (modalOpen.value) dirty.value = true
  },
  { deep: true },
)
</script>

<style scoped lang="less">
.shift-energy-page {
  margin: -12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-card,
.toolbar-row,
.summary-bar,
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
  padding-top: 8px;
  padding-bottom: 8px;
}

.link {
  color: #1677ff;
  cursor: pointer;
  &.danger {
    color: #ff4d4f;
  }
}

.modal-tip {
  margin-top: 12px;
}

.modal-basic-card {
  margin-bottom: 0;
}
</style>
