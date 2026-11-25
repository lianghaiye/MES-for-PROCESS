<template>
  <div class="list-page shift-energy-page">
    <a-tabs v-model:active-key="activeTab" class="page-tabs">
      <a-tab-pane key="reports" tab="交班记录" />
      <a-tab-pane key="templates" tab="交班模板" />
    </a-tabs>

    <ShiftReportTemplatePanel v-if="activeTab === 'templates'" />

    <template v-else>
      <div class="filter-card">
        <a-form layout="inline" class="filter-form horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-form-item label="日期">
                <a-range-picker
                  v-model:value="filters.dateRange"
                  size="small"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-form-item label="工作中心">
                <a-select
                  v-model:value="filters.workCenterId"
                  allow-clear
                  size="small"
                  placeholder="全部"
                  show-search
                  option-filter-prop="label"
                  :options="workCenterOptions"
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
        <a-button type="primary" size="small" @click="openCreate">交班填报</a-button>
        <span class="toolbar-hint"
          >一期：按工作中心 + 班次时段汇总投料/产出/化验，并填能耗停时</span
        >
      </div>

      <a-alert
        type="info"
        show-icon
        class="summary-bar"
        message="投料、产出按工作中心与班次时段从批次过账自动汇总；化验按本班时段拉取；能耗与停时由班长填写。保存后可复制发群。"
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
          :scroll="{ x: 1280 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'workCenter'">
              {{ record.workCenterName || '—' }}
            </template>
            <template v-else-if="column.key === 'shift'">
              <a-tag>{{ shiftLabel[record.shift] || '—' }}</a-tag>
            </template>
            <template v-else-if="column.key === 'attendance'">
              {{ formatAttendance(record) }}
            </template>
            <template v-else-if="column.key === 'feedTotal'">
              {{ formatNum(record.feedTotalTon, 1) }}
            </template>
            <template v-else-if="column.key === 'outputTotal'">
              {{ formatNum(record.outputTotalTon, 1) }}
            </template>
            <template v-else-if="column.key === 'assayCount'">
              {{ (record.assayRows || []).length || '—' }}
            </template>
            <template v-else-if="column.key === 'electricityKwh'">
              {{ formatNum(record.electricityKwh, 2) }}
            </template>
            <template v-else-if="column.key === 'downtimeHours'">
              {{ formatNum(record.downtimeHours, 2) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space :size="8">
                <a class="link" @click="openShare(record)">发群</a>
                <a class="link" @click="openEdit(record)">编辑</a>
                <a class="link danger" @click="handleDelete(record)">删除</a>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </template>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑交班填报' : '交班填报'"
      :width="modalWidth"
      :style="{ top: '3vh' }"
      :body-style="{ maxHeight: '78vh', overflowY: 'auto', padding: '16px 24px' }"
      :mask-closable="false"
      destroy-on-close
      @cancel="handleCancel"
    >
      <div class="modal-basic-card">
        <div class="section-title">基本信息</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="8">
              <a-form-item label="日期" required>
                <a-date-picker v-model:value="form.date" size="small" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="班次" required>
                <a-select v-model:value="form.shift" size="small" :options="shiftOptions" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="工作中心" required>
                <a-select
                  v-model:value="form.workCenterId"
                  size="small"
                  show-search
                  option-filter-prop="label"
                  :options="workCenterOptions"
                  @change="onWorkCenterChange"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="应到">
                <a-input-number
                  v-model:value="form.plannedCount"
                  size="small"
                  :min="0"
                  :precision="0"
                  style="width: 100%"
                  addon-after="人"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="实到">
                <a-input-number
                  v-model:value="form.actualCount"
                  size="small"
                  :min="0"
                  :precision="0"
                  style="width: 100%"
                  addon-after="人"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <span class="tpl-hint">{{ shiftWindowHint }}</span>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <div class="sync-bar">
        <a-button type="primary" size="small" @click="syncAll">一键同步本班数据</a-button>
        <span class="tpl-hint">按工作中心 + 班次时段拉取投料、产出、化验；可再改数</span>
      </div>

      <div class="block-section">
        <div class="block-title-row">
          <div class="block-title">投料汇总（合计 {{ feedTotalDisplay }} 吨）</div>
          <a-space>
            <a-button size="small" @click="syncFeeds">同步投料</a-button>
            <a-button size="small" @click="addManualFeed">补一行</a-button>
          </a-space>
        </div>
        <div v-if="form.feedAutoSyncedAt" class="sync-hint">
          最近同步：{{ form.feedAutoSyncedAt }}
        </div>
        <a-table
          :columns="qtyColumns"
          :data-source="form.feedRows"
          :pagination="false"
          size="small"
          row-key="rowKey"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'name'">
              <a-input v-model:value="record.name" size="small" />
            </template>
            <template v-else-if="column.key === 'qty'">
              <a-input-number
                v-model:value="record.qty"
                size="small"
                :min="0"
                :precision="3"
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'source'">
              <a-tag :color="record.source === 'auto' ? 'blue' : 'default'">
                {{ record.source === 'auto' ? '自动' : '手工' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a class="link danger" @click="form.feedRows.splice(index, 1)">移除</a>
            </template>
          </template>
        </a-table>
      </div>

      <div class="block-section">
        <div class="block-title-row">
          <div class="block-title">产出汇总（合计 {{ outputTotalDisplay }}）</div>
          <a-space>
            <a-button size="small" @click="syncOutputs">同步产出</a-button>
            <a-button size="small" @click="addManualOutput">补一行</a-button>
          </a-space>
        </div>
        <div v-if="form.outputAutoSyncedAt" class="sync-hint">
          最近同步：{{ form.outputAutoSyncedAt }}
        </div>
        <a-table
          :columns="outputColumns"
          :data-source="form.outputRows"
          :pagination="false"
          size="small"
          row-key="rowKey"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'name'">
              <a-input v-model:value="record.name" size="small" />
            </template>
            <template v-else-if="column.key === 'qty'">
              <a-input-number
                v-model:value="record.qty"
                size="small"
                :min="0"
                :precision="3"
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'source'">
              <a-tag :color="record.source === 'auto' ? 'blue' : 'default'">
                {{ record.source === 'auto' ? '自动' : '手工' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a class="link danger" @click="form.outputRows.splice(index, 1)">移除</a>
            </template>
          </template>
        </a-table>
      </div>

      <div class="block-section">
        <div class="block-title-row">
          <div class="block-title">本班化验（{{ form.assayRows.length }} 单）</div>
          <a-button size="small" @click="syncAssays">同步化验</a-button>
        </div>
        <div v-if="form.assayAutoSyncedAt" class="sync-hint">
          最近同步：{{ form.assayAutoSyncedAt }}
        </div>
        <a-table
          :columns="assayColumns"
          :data-source="form.assayRows"
          :pagination="false"
          size="small"
          row-key="id"
          :locale="{ emptyText: '本班暂无化验单，点同步拉取' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'result'">
              <a-tag v-if="record.qcResult" :color="resultColor(record.qcResult)">
                {{ record.qcResult }}
              </a-tag>
              <span v-else>{{ record.qcStatus || '—' }}</span>
            </template>
          </template>
        </a-table>
      </div>

      <div class="modal-basic-card">
        <div class="section-title">能耗与停时</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="8">
              <a-form-item label="用电量">
                <a-input-number
                  v-model:value="form.electricityKwh"
                  size="small"
                  :min="0"
                  :precision="2"
                  style="width: 100%"
                  addon-after="kWh"
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
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="停时说明" class="remark-item">
                <a-input
                  v-model:value="form.downtimeReason"
                  size="small"
                  placeholder="选填"
                  allow-clear
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <div class="modal-basic-card">
        <div class="section-title">异常与备注</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="24">
              <a-form-item label="异常情况" class="remark-item">
                <a-textarea
                  v-model:value="form.textValues.abnormalities"
                  :rows="2"
                  size="small"
                  placeholder="选填"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="备注" class="remark-item">
                <a-textarea
                  v-model:value="form.textValues.remark"
                  :rows="2"
                  size="small"
                  placeholder="选填"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <template #footer>
        <a-button @click="handleCancel">取消</a-button>
        <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
      </template>
    </a-modal>

    <a-drawer
      v-model:open="shareOpen"
      title="发群预览"
      placement="right"
      :width="520"
      destroy-on-close
    >
      <ShiftReportSharePanel :record="shareRecord" />
    </a-drawer>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { Modal, message } from 'ant-design-vue'
import {
  SHIFT_LABEL,
  SHIFT_OPTIONS,
  aggregateAssaysForShift,
  aggregateFeedsForShift,
  aggregateOutputsForShift,
  buildEmptyReportForm,
  deleteShiftEnergyReport,
  listShiftEnergyReports,
  resolveShiftRange,
  saveShiftEnergyReport,
  shiftEnergyReportState,
} from '@/store/shiftEnergyReportStore'
import {
  getShiftReportTemplate,
  resolveShiftReportTemplate,
} from '@/store/shiftReportTemplateStore'
import { listEnabledWorkCenters, workCenterState } from '@/store/workCenterStore'
import ShiftReportTemplatePanel from './components/ShiftReportTemplatePanel.vue'
import ShiftReportSharePanel from './components/ShiftReportSharePanel.vue'

const shiftOptions = SHIFT_OPTIONS
const shiftLabel = SHIFT_LABEL
const modalWidth = typeof window !== 'undefined' ? Math.min(960, window.innerWidth * 0.9) : 900
const DEFAULT_WORK_CENTER_ID = 'wc-acid-1'

const activeTab = ref('reports')
const filters = reactive({ dateRange: null, workCenterId: undefined, shift: undefined })
const applied = reactive({ dateFrom: '', dateTo: '', workCenterId: '', shift: '' })

const modalOpen = ref(false)
const shareOpen = ref(false)
const shareRecord = ref(null)
const editingId = ref('')
const saving = ref(false)
const dirty = ref(false)
const form = reactive(buildEmptyReportForm(DEFAULT_WORK_CENTER_ID))

const workCenterOptions = computed(() => {
  void workCenterState.centers
  return listEnabledWorkCenters()
    .filter((row) => row.orgType === 'workshop')
    .map((row) => ({ value: row.id, label: `${row.name}（${row.code}）` }))
})

const columns = [
  { title: '日期', dataIndex: 'date', key: 'date', width: 110 },
  { title: '班次', key: 'shift', width: 80 },
  { title: '工作中心', key: 'workCenter', width: 140 },
  { title: '出勤', key: 'attendance', width: 100 },
  { title: '投料(t)', key: 'feedTotal', width: 90, align: 'right' },
  { title: '产出', key: 'outputTotal', width: 90, align: 'right' },
  { title: '化验单', key: 'assayCount', width: 80, align: 'right' },
  { title: '用电(kWh)', key: 'electricityKwh', width: 100, align: 'right' },
  { title: '停时(h)', key: 'downtimeHours', width: 90, align: 'right' },
  { title: '填报人', dataIndex: 'reporter', key: 'reporter', width: 90 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 140 },
  { title: '操作', key: 'action', width: 150, fixed: 'right' },
]

const qtyColumns = [
  { title: '物料', key: 'name', width: 180 },
  { title: '数量', key: 'qty', width: 120 },
  { title: '单位', dataIndex: 'unit', key: 'unit', width: 70 },
  { title: '来源', key: 'source', width: 80 },
  { title: '操作', key: 'action', width: 70 },
]

const outputColumns = [
  { title: '物料', key: 'name', width: 160 },
  { title: '数量', key: 'qty', width: 120 },
  { title: '单位', dataIndex: 'unit', key: 'unit', width: 70 },
  { title: '来源', key: 'source', width: 80 },
  { title: '操作', key: 'action', width: 70 },
]

const assayColumns = [
  { title: '化验单号', dataIndex: 'qcNo', key: 'qcNo', width: 130 },
  { title: '物料', dataIndex: 'itemName', key: 'itemName', width: 120 },
  { title: '类型', dataIndex: 'assayType', key: 'assayType', width: 110 },
  { title: '结论', key: 'result', width: 90 },
  { title: '检验人', dataIndex: 'inspector', key: 'inspector', width: 90 },
  { title: '时间', dataIndex: 'at', key: 'at', width: 130 },
]

const rows = computed(() => {
  void shiftEnergyReportState.reports
  return listShiftEnergyReports({
    dateFrom: applied.dateFrom || undefined,
    dateTo: applied.dateTo || undefined,
    workCenterId: applied.workCenterId || undefined,
    shift: applied.shift || undefined,
  })
})

const currentTemplate = computed(
  () => getShiftReportTemplate(form.templateId) || resolveShiftReportTemplate(null),
)

const shiftWindowHint = computed(() => {
  const tpl = currentTemplate.value
  if (!tpl || !form.date || !form.shift) return ''
  const range = resolveShiftRange(form.date, form.shift, tpl)
  return `本班时段 ${range.startText} ~ ${range.endText}`
})

const feedTotalDisplay = computed(() =>
  (form.feedRows || []).reduce((acc, row) => acc + (Number(row.qty) || 0), 0).toFixed(1),
)
const outputTotalDisplay = computed(() =>
  (form.outputRows || []).reduce((acc, row) => acc + (Number(row.qty) || 0), 0).toFixed(1),
)

function formatNum(val, decimals) {
  const n = Number(val)
  if (!Number.isFinite(n) || n === 0) return '—'
  return n.toFixed(decimals)
}

function formatAttendance(record) {
  if (record.plannedCount == null && record.actualCount == null) return '—'
  return `应${record.plannedCount ?? '—'} / 实${record.actualCount ?? '—'}`
}

function resultColor(result) {
  if (String(result).includes('不') || String(result).includes('FAIL')) return 'error'
  if (String(result).includes('合') || String(result).includes('PASS')) return 'success'
  return 'default'
}

function applySearch() {
  const range = filters.dateRange
  applied.dateFrom = range?.[0] ? dayjs(range[0]).format('YYYY-MM-DD') : ''
  applied.dateTo = range?.[1] ? dayjs(range[1]).format('YYYY-MM-DD') : ''
  applied.workCenterId = filters.workCenterId || ''
  applied.shift = filters.shift || ''
}

function resetSearch() {
  filters.dateRange = null
  filters.workCenterId = undefined
  filters.shift = undefined
  applied.dateFrom = ''
  applied.dateTo = ''
  applied.workCenterId = ''
  applied.shift = ''
}

function decorateRows() {
  form.feedRows = (form.feedRows || []).map((row, i) => ({
    ...row,
    rowKey: row.rowKey || `feed-${i}-${row.itemId || row.name}`,
  }))
  form.outputRows = (form.outputRows || []).map((row, i) => ({
    ...row,
    rowKey: row.rowKey || `out-${i}-${row.itemId || row.name}`,
  }))
}

function resetFormByWorkCenter(workCenterId) {
  const next = buildEmptyReportForm(workCenterId || DEFAULT_WORK_CENTER_ID)
  Object.keys(form).forEach((k) => delete form[k])
  Object.assign(form, next)
  if (!form.textValues) form.textValues = { abnormalities: '', remark: '' }
  decorateRows()
}

function onWorkCenterChange(workCenterId) {
  const keepDate = form.date
  const keepShift = form.shift
  resetFormByWorkCenter(workCenterId)
  form.date = keepDate
  form.shift = keepShift
  nextTick(() => {
    dirty.value = false
    syncAll(false)
  })
}

function openCreate() {
  editingId.value = ''
  resetFormByWorkCenter(DEFAULT_WORK_CENTER_ID)
  modalOpen.value = true
  nextTick(() => {
    dirty.value = false
    syncAll(false)
  })
}

function openEdit(record) {
  editingId.value = record.id
  const tpl = getShiftReportTemplate(record.templateId) || resolveShiftReportTemplate(null)
  const base = buildEmptyReportForm(record.workCenterId || DEFAULT_WORK_CENTER_ID, tpl)
  Object.keys(form).forEach((k) => delete form[k])
  Object.assign(form, base, {
    date: dayjs(record.date),
    shift: record.shift,
    workCenterId: record.workCenterId || DEFAULT_WORK_CENTER_ID,
    workshop: record.workshop || '',
    templateId: tpl?.id || record.templateId,
    plannedCount: record.plannedCount ?? null,
    actualCount: record.actualCount ?? null,
    feedRows: JSON.parse(JSON.stringify(record.feedRows || [])),
    outputRows: JSON.parse(JSON.stringify(record.outputRows || [])),
    assayRows: JSON.parse(JSON.stringify(record.assayRows || [])),
    feedAutoSyncedAt: record.feedAutoSyncedAt || '',
    outputAutoSyncedAt: record.outputAutoSyncedAt || '',
    assayAutoSyncedAt: record.assayAutoSyncedAt || '',
    electricityKwh: record.electricityKwh || null,
    steamTon: record.steamTon || null,
    downtimeHours: record.downtimeHours || null,
    downtimeReason: record.downtimeReason || '',
    textValues: {
      abnormalities: record.textValues?.abnormalities ?? record.abnormalities ?? '',
      remark: record.textValues?.remark ?? record.remark ?? '',
    },
  })
  decorateRows()
  modalOpen.value = true
  nextTick(() => {
    dirty.value = false
  })
}

function openShare(record) {
  shareRecord.value = record
  shareOpen.value = true
}

function syncOpts() {
  return {
    templateId: form.templateId,
    workCenterId: form.workCenterId,
  }
}

function syncFeeds(showMsg = true) {
  if (!form.workCenterId) {
    if (showMsg) message.warning('请先选择工作中心')
    return
  }
  const autoRows = aggregateFeedsForShift(form.date, form.shift, syncOpts())
  const manualKeep = (form.feedRows || []).filter((row) => row.source === 'manual')
  const autoKeys = new Set(autoRows.map((r) => r.itemId || r.name))
  form.feedRows = [...autoRows, ...manualKeep.filter((r) => !autoKeys.has(r.itemId || r.name))].map(
    (row, i) => ({ ...row, rowKey: `feed-${i}-${row.itemId || row.name}` }),
  )
  form.feedAutoSyncedAt = dayjs().format('YYYY-MM-DD HH:mm')
  if (showMsg) {
    message.success(autoRows.length ? `投料已同步 ${autoRows.length} 种` : '本班暂无投料过账')
  }
}

function syncOutputs(showMsg = true) {
  if (!form.workCenterId) {
    if (showMsg) message.warning('请先选择工作中心')
    return
  }
  const autoRows = aggregateOutputsForShift(form.date, form.shift, syncOpts())
  const manualKeep = (form.outputRows || []).filter((row) => row.source === 'manual')
  const autoKeys = new Set(autoRows.map((r) => `${r.itemId || r.name}::${r.role || ''}`))
  form.outputRows = [
    ...autoRows,
    ...manualKeep.filter((r) => !autoKeys.has(`${r.itemId || r.name}::${r.role || ''}`)),
  ].map((row, i) => ({ ...row, rowKey: `out-${i}-${row.itemId || row.name}` }))
  form.outputAutoSyncedAt = dayjs().format('YYYY-MM-DD HH:mm')
  if (showMsg) {
    message.success(autoRows.length ? `产出已同步 ${autoRows.length} 种` : '本班暂无产出过账')
  }
}

function syncAssays(showMsg = true) {
  if (!form.workCenterId) {
    if (showMsg) message.warning('请先选择工作中心')
    return
  }
  form.assayRows = aggregateAssaysForShift(form.date, form.shift, syncOpts())
  form.assayAutoSyncedAt = dayjs().format('YYYY-MM-DD HH:mm')
  if (showMsg) {
    message.success(
      form.assayRows.length ? `化验已同步 ${form.assayRows.length} 单` : '本班暂无化验单',
    )
  }
}

function syncAll(showMsg = true) {
  syncFeeds(false)
  syncOutputs(false)
  syncAssays(false)
  if (showMsg) message.success('已同步本班投料、产出、化验')
}

function addManualFeed() {
  form.feedRows.push({
    itemId: '',
    name: '',
    qty: 0,
    unit: 't',
    source: 'manual',
    rowKey: `feed-m-${Date.now()}`,
  })
}

function addManualOutput() {
  form.outputRows.push({
    itemId: '',
    name: '',
    role: '',
    qty: 0,
    unit: 't',
    source: 'manual',
    rowKey: `out-m-${Date.now()}`,
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
    const saved = saveShiftEnergyReport(
      { ...form, date: form.date, source: 'web' },
      editingId.value || undefined,
    )
    message.success('保存成功')
    dirty.value = false
    modalOpen.value = false
    shareRecord.value = saved
    shareOpen.value = true
  } catch (err) {
    message.error(err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function handleDelete(record) {
  Modal.confirm({
    title: '确认删除该交班填报？',
    content: `${record.date} ${shiftLabel[record.shift] || ''} · ${record.workCenterName || '—'}`,
    okText: '删除',
    okType: 'danger',
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
.page-tabs {
  background: #fff;
  border-radius: 8px;
  padding: 0 12px;
  :deep(.ant-tabs-nav) {
    margin-bottom: 0;
  }
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
}
.toolbar-hint,
.tpl-hint,
.sync-hint {
  font-size: 13px;
  color: #86909c;
}
.sync-hint {
  margin-bottom: 8px;
}
.sync-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.link {
  color: #1677ff;
  cursor: pointer;
  &.danger {
    color: #ff4d4f;
  }
}
.modal-basic-card {
  margin-bottom: 12px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid var(--divider, #e5e6eb);
  border-radius: 8px;
}
.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.block-section {
  margin-bottom: 12px;
}
.block-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.block-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
</style>
