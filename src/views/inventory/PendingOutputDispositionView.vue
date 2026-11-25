<template>
  <div class="list-page pending-disposition-page">
    <div class="filter-card">
      <a-form :model="filters" layout="inline" class="filter-form horizontal-form">
        <ListFilterBar :field-count="6" @search="handleSearch" @reset="handleReset">
          <a-form-item label="状态">
            <a-select
              v-model:value="filters.status"
              allow-clear
              size="small"
              placeholder="全部"
              :options="statusFilterOptions"
            />
          </a-form-item>
          <a-form-item label="批次指令">
            <a-input
              v-model:value="filters.orderNo"
              allow-clear
              size="small"
              placeholder="请输入批次指令"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="产出批次">
            <a-input
              v-model:value="filters.batchNo"
              allow-clear
              size="small"
              placeholder="请输入产出批次"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="物料">
            <a-input
              v-model:value="filters.itemKeyword"
              allow-clear
              size="small"
              placeholder="编码 / 名称"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="处理方式">
            <a-select
              v-model:value="filters.disposition"
              allow-clear
              size="small"
              placeholder="全部"
              :options="OUTPUT_DISPOSITION_OPTIONS"
            />
          </a-form-item>
          <a-form-item label="位置">
            <a-select
              v-model:value="filters.locationId"
              allow-clear
              show-search
              option-filter-prop="label"
              size="small"
              placeholder="全部"
              :options="locationFilterOptions"
            />
          </a-form-item>
        </ListFilterBar>
      </a-form>
    </div>

    <div class="toolbar-row">
      <a-space>
        <a-button
          type="primary"
          size="small"
          :disabled="!selectedStagingKeys.length"
          @click="openMerge"
        >
          合并入库（{{ selectedStagingKeys.length }}）
        </a-button>
        <span class="selection-count">已选 {{ selectedStagingKeys.length }} 项暂存</span>
        <a-button
          type="link"
          size="small"
          :disabled="!selectedRowKeys.length"
          @click="clearSelection"
        >
          清空
        </a-button>
      </a-space>
    </div>

    <a-alert type="info" show-icon class="summary-bar" :message="pageHint" />

    <div class="table-card">
      <a-table
        :columns="columns"
        :data-source="rows"
        row-key="key"
        size="small"
        :row-selection="rowSelection"
        :pagination="{
          pageSize: 20,
          size: 'small',
          showSizeChanger: true,
          showTotal: (n) => `共 ${n} 条`,
        }"
        :scroll="{ x: 1400 }"
        :locale="{ emptyText: tableEmptyText }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            <span class="seq-no">{{ record.seqNo }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{
              BATCH_STATUS_LABEL[record.status] || record.status
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'orderNo'">
            <a class="plan-no-link" @click="goOrder(record)">{{ record.orderNo || '—' }}</a>
          </template>
          <template v-else-if="column.key === 'item'">{{
            itemLabel(record.itemId) || '—'
          }}</template>
          <template v-else-if="column.key === 'role'">{{
            OUTPUT_ROLE_LABEL[record.role] || record.role || '—'
          }}</template>
          <template v-else-if="column.key === 'disposition'">{{
            OUTPUT_DISPOSITION_LABEL[record.disposition] || '—'
          }}</template>
          <template v-else-if="column.key === 'location'">{{
            locationName(record.locationId)
          }}</template>
          <template v-else-if="column.key === 'content'">{{
            formatContentPctText(record.content)
          }}</template>
          <template v-else-if="column.key === 'qty'">{{
            formatQtyWithUnit(record.qty, record.unit)
          }}</template>
          <template v-else-if="column.key === 'action'">
            <a-button
              v-if="record.status === 'await_decide'"
              type="link"
              size="small"
              :disabled="record.decideDisabled"
              :title="record.decideDisabledReason"
              @click="openDecide(record)"
              >确认去向</a-button
            >
            <a-button
              v-if="record.status === 'await_reextract'"
              type="link"
              size="small"
              @click="doReextract(record)"
              >开再提指令</a-button
            >
          </template>
        </template>
      </a-table>
    </div>

    <a-modal
      :open="decideOpen"
      title="确认产出去向"
      :width="520"
      :mask-closable="false"
      destroy-on-close
      :confirm-loading="decideSaving"
      @cancel="closeDecide"
      @ok="saveDecide"
    >
      <div class="modal-basic-card">
        <div class="section-title">基本信息</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="24">
              <a-form-item label="产出">
                <span>{{ decideForm.itemLabel || '—' }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="批次号">
                <span>{{ decideForm.batchNo || '—' }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="检验结论">
                <a-tag
                  v-if="decideForm.inspectConclusion && decideForm.inspectConclusion !== '—'"
                  :color="inspectConclusionColor(decideForm.inspectConclusion)"
                  >{{ decideForm.inspectConclusion }}</a-tag
                >
                <span v-else>—</span>
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="最终去向" required>
                <a-select
                  v-model:value="decideForm.disposition"
                  size="small"
                  style="width: 100%"
                  :options="decideDispositionOptions"
                  placeholder="回用 / 再提 / 入库 / 进暂存 / 废弃"
                  @change="onDecideDispositionChange"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="去向位置" required>
                <a-select
                  v-model:value="decideForm.locationId"
                  size="small"
                  allow-clear
                  show-search
                  option-filter-prop="label"
                  style="width: 100%"
                  :options="locationOptionsFor(decideForm.disposition)"
                  :placeholder="locationPlaceholder(decideForm.disposition)"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <p class="section-hint">
          进暂存池不生成入库单，须在本页勾选后「合并入库」。入仓库、入储罐会立刻生成生产入库单。
        </p>
      </div>
    </a-modal>

    <a-modal
      :open="mergeOpen"
      title="合并入库"
      :width="560"
      :mask-closable="false"
      destroy-on-close
      :confirm-loading="mergeSaving"
      @cancel="closeMerge"
      @ok="saveMerge"
    >
      <div class="modal-basic-card">
        <div class="section-title">基本信息</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="24">
              <a-form-item label="物料">
                <span>{{ mergeSummary.itemLabel }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="有效含量">
                <span>{{ mergeSummary.contentText }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="合计数量">
                <span>{{ mergeSummary.qtyText }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="来源批令">
                <span>{{ mergeSummary.orderNos }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="位置类型" required>
                <a-select
                  v-model:value="mergeForm.locationKind"
                  size="small"
                  style="width: 100%"
                  :options="formalLocationKindOptions"
                  placeholder="先选仓库或储罐"
                  @change="onMergeLocationKindChange"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="正式入库位置" required>
                <a-select
                  v-model:value="mergeForm.locationId"
                  size="small"
                  show-search
                  option-filter-prop="label"
                  style="width: 100%"
                  :disabled="!mergeForm.locationKind"
                  :options="formalLocationOptions"
                  :placeholder="mergeForm.locationKind ? '选择位置' : '请先选择位置类型'"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <p class="section-hint">
          须同物料、含量相同；可跨批令与暂存位置。确认后生成待入库的生产入库单。
        </p>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useTabs } from '@/composables/useTabs'
import ListFilterBar from '@/components/ListFilterBar.vue'
import { formatQtyWithUnit } from '@/utils/numberFormat'
import { formatContentPctText } from '@/utils/batchContent'
import { displayInspectConclusion, inspectConclusionColor } from '@/utils/inspectConclusion'
import { resolveBatchInspectInfo } from '@/utils/resolveBatchInspect'
import {
  OUTPUT_DISPOSITION_LABEL,
  OUTPUT_DISPOSITION_OPTIONS,
  OUTPUT_ROLE_LABEL,
  itemLabel,
  locationKindForDisposition,
} from '@/store/processFormulaStore'
import {
  BATCH_STATUS_LABEL,
  getMaterialBatch,
  isProcessItemAllowWorkshopStaging,
  listMaterialBatches,
  listTanks,
  materialBatchState,
} from '@/store/materialBatchStore'
import { getQcTaskById } from '@/store/qcTaskStore'
import {
  confirmOutputDisposition,
  createReextract,
  getBatchOrder,
  isOutputAssayHardGate,
  listPendingDispositionOutputs,
  mergeStagingBatchesToInbound,
} from '@/store/batchInstructionStore'

const router = useRouter()
const { openTab } = useTabs()

/** 与批次指令列表同壳：提示条文案 */
const pageHint =
  '汇总待判定、车间暂存、待回用、待再提产出。待判定可确认去向（含进暂存池）；车间暂存可勾选「合并入库」生成生产入库单。硬门禁须化验合格后才能确认回用/再提/入仓入罐/进暂存。暂存批不可发货；仅物料允许回流时可回流投料。'

/** 列序对齐批次指令：序号 → 状态 → 业务列；状态不再叫「放行状态」 */
const columns = [
  { title: '序号', key: 'index', width: 72, fixed: 'left' },
  { title: '状态', key: 'status', width: 100, fixed: 'left' },
  { title: '批次指令', key: 'orderNo', dataIndex: 'orderNo', width: 150, fixed: 'left' },
  { title: '产出批次', dataIndex: 'batchNo', width: 160 },
  { title: '角色', key: 'role', width: 90 },
  { title: '物料', key: 'item', width: 160, ellipsis: true },
  { title: '处理方式', key: 'disposition', width: 90 },
  { title: '位置', key: 'location', width: 120 },
  { title: '有效含量', key: 'content', width: 90, align: 'right' },
  { title: '剩余', key: 'qty', width: 120, align: 'right' },
  { title: '登记时间', dataIndex: 'at', width: 150 },
  { title: '操作', key: 'action', width: 140, fixed: 'right' },
]

/** 本页会出现的批次状态，供状态下拉。 */
const statusFilterOptions = ['await_decide', 'await_staging', 'await_reuse', 'await_reextract'].map(
  (value) => ({ value, label: BATCH_STATUS_LABEL[value] }),
)

const emptyFilters = () => ({
  orderNo: '',
  batchNo: '',
  status: undefined,
  itemKeyword: '',
  disposition: undefined,
  locationId: undefined,
})

const filters = reactive(emptyFilters())
/** 点查询后才生效，避免输入过程中表格跟着跳。 */
const appliedFilters = ref(emptyFilters())

const locationFilterOptions = computed(() =>
  listTanks().map((row) => ({ value: row.id, label: row.name })),
)

function handleSearch() {
  appliedFilters.value = {
    orderNo: String(filters.orderNo || '').trim(),
    batchNo: String(filters.batchNo || '').trim(),
    status: filters.status,
    itemKeyword: String(filters.itemKeyword || '').trim(),
    disposition: filters.disposition,
    locationId: filters.locationId,
  }
}

function handleReset() {
  Object.assign(filters, emptyFilters())
  appliedFilters.value = emptyFilters()
}

function includesText(source, keyword) {
  const key = String(keyword || '')
    .trim()
    .toLowerCase()
  if (!key) return true
  return String(source || '')
    .toLowerCase()
    .includes(key)
}

/** 已生效条件是否命中这一行。空条件不参与。 */
function matchPendingRow(row, query) {
  if (!includesText(row.orderNo, query.orderNo)) return false
  if (!includesText(row.batchNo, query.batchNo)) return false
  if (query.status && row.status !== query.status) return false
  if (query.itemKeyword && !includesText(itemLabel(row.itemId), query.itemKeyword)) return false
  if (query.disposition && row.disposition !== query.disposition) return false
  if (query.locationId && row.locationId !== query.locationId) return false
  return true
}

const tableEmptyText = computed(() => {
  const query = appliedFilters.value
  const active = Boolean(
    query.orderNo ||
    query.batchNo ||
    query.status ||
    query.itemKeyword ||
    query.disposition ||
    query.locationId,
  )
  return active ? '无匹配产出' : '暂无待处置产出'
})

const selectedRowKeys = ref([])
const selectedStagingKeys = computed(() =>
  selectedRowKeys.value.filter((key) => {
    const row = rows.value.find((r) => r.key === key)
    return row?.status === 'await_staging'
  }),
)

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  columnWidth: 48,
  fixed: true,
  onChange: (keys) => {
    selectedRowKeys.value = keys
  },
  getCheckboxProps: (record) => ({
    // 仅车间暂存可勾选合并；其它行保留但不参与合并
    disabled: record.status !== 'await_staging',
  }),
}))

function clearSelection() {
  selectedRowKeys.value = []
}

const decideOpen = ref(false)
const decideSaving = ref(false)
const decideForm = reactive({
  orderId: '',
  outputId: '',
  batchId: '',
  itemLabel: '',
  batchNo: '',
  inspectConclusion: '—',
  disposition: undefined,
  locationId: '',
  itemId: '',
  role: '',
})

const decideDispositionOptions = computed(() =>
  OUTPUT_DISPOSITION_OPTIONS.filter((item) => {
    if (item.value === 'pending_decide') return false
    if (item.value === 'staging' && !isProcessItemAllowWorkshopStaging(decideForm.itemId)) {
      return false
    }
    return true
  }),
)

const rows = computed(() => {
  void materialBatchState.batches
  const query = appliedFilters.value
  return listPendingDispositionOutputs()
    .map((row) => ({ ...row, ...decideGate(row) }))
    .filter((row) => matchPendingRow(row, query))
    .map((row, index) => ({ ...row, seqNo: String(index + 1) }))
})

/** 筛选变化后清掉已不可见行的勾选 */
watch(rows, (list) => {
  const visible = new Set(list.map((row) => row.key))
  selectedRowKeys.value = selectedRowKeys.value.filter((key) => visible.has(key))
})

/** 与批次指令页一致：硬门禁且无合格/让步结论时，确认去向不可点。 */
function decideGate(row) {
  const order = getBatchOrder(row.orderId)
  const output = findOutput(order, row)
  const inspectConclusion = inspectConclusionOf(order, output, row)
  const assayPass = inspectConclusion === '合格' || inspectConclusion === '让步'
  const hardGate = output ? isOutputAssayHardGate(order, output) : Boolean(row.assayHardGate)
  const decideDisabled = hardGate && !assayPass
  return {
    inspectConclusion,
    decideDisabled,
    decideDisabledReason: decideDisabled
      ? '已挂产出化验硬门禁，须检验合格（或让步）后才能确认去向'
      : '',
  }
}

function findOutput(order, row) {
  const outputs = order?.outputs || []
  return (
    outputs.find((item) => item.id && item.id === row.outputId) ||
    outputs.find((item) => item.batchId && item.batchId === row.batchId) ||
    null
  )
}

function inspectConclusionOf(order, output, row) {
  const fromLink = (order?.outputQcRecords || [])
    .filter((qc) => {
      if (!output) return false
      if (qc.itemId !== output.itemId) return false
      if (output.role && qc.role && qc.role !== output.role) return false
      if (output.stepNo && qc.stepNo && Number(qc.stepNo) !== Number(output.stepNo)) return false
      return Boolean(qc.taskId || qc.qcNo)
    })
    .map((qc) => {
      const task = qc.taskId ? getQcTaskById(qc.taskId) : null
      return displayInspectConclusion(task?.qcResult || qc.qcResult)
    })
    .find((text) => text && text !== '—')
  if (fromLink) return fromLink
  const batch = getMaterialBatch(row.batchId)
  return resolveBatchInspectInfo(batch).qcResult || '—'
}

function locationName(id) {
  if (!id) return '—'
  return listTanks().find((t) => t.id === id)?.name || '—'
}

function locationOptionsFor(disposition) {
  const kind = locationKindForDisposition(disposition)
  return listTanks()
    .filter((row) => {
      if (!kind) return true
      const rowKind = row.kind === 'tank' ? 'tank' : 'silo'
      return rowKind === kind
    })
    .map((row) => ({ value: row.id, label: row.name }))
}

/** 正式入库先选类型：仓库=料仓 silo，储罐=tank。 */
const formalLocationKindOptions = [
  { value: 'silo', label: '仓库' },
  { value: 'tank', label: '储罐' },
]

const formalLocationOptions = computed(() => {
  const kind = mergeForm.locationKind
  if (!kind) return []
  return listTanks()
    .filter((row) => (row.kind === 'tank' ? 'tank' : 'silo') === kind)
    .map((row) => ({ value: row.id, label: row.name }))
})

function locationPlaceholder(disposition) {
  if (disposition === 'tank') return '选择储罐'
  if (disposition === 'warehouse') return '选择仓库'
  if (disposition === 'staging') return '选择暂存仓/罐'
  if (disposition === 'reuse') return '回流罐或仓'
  if (disposition === 'reextract') return '待再提位置'
  if (disposition === 'scrap') return '废弃位置'
  return '选择位置'
}

function defaultOutputLocation(itemId, role, disposition) {
  const kind = locationKindForDisposition(disposition)
  const tanks = listTanks().filter((row) => {
    if (!kind) return true
    const rowKind = row.kind === 'tank' ? 'tank' : 'silo'
    return rowKind === kind
  })
  const tankIds = new Set(tanks.map((tank) => tank.id))
  const counts = new Map()
  listMaterialBatches().forEach((batch) => {
    if (batch.itemId !== itemId || !batch.locationId || !tankIds.has(batch.locationId)) return
    counts.set(batch.locationId, (counts.get(batch.locationId) || 0) + 1)
  })
  let best = ''
  let bestCount = 0
  counts.forEach((count, id) => {
    if (count > bestCount) {
      best = id
      bestCount = count
    }
  })
  if (best) return best
  return tanks[0]?.id || ''
}

function statusColor(status) {
  if (status === 'await_decide') return 'default'
  if (status === 'await_staging') return 'cyan'
  if (status === 'await_reuse') return 'processing'
  if (status === 'await_reextract') return 'warning'
  return 'default'
}

/** 点批次指令号：新标签打开详情（与批次指令列表一致） */
function goOrder(record) {
  const path = `/production/work-orders/${record.orderId}`
  openTab(path, `批次指令 ${record.orderNo || ''}`.trim())
  router.push(path)
}

function openDecide(record) {
  if (record?.decideDisabled) {
    message.warning(record.decideDisabledReason || '硬门禁未合格，不能确认去向')
    return
  }
  decideForm.orderId = record.orderId || ''
  decideForm.outputId = record.outputId || ''
  decideForm.batchId = record.batchId || ''
  decideForm.itemLabel = itemLabel(record.itemId) || '—'
  decideForm.batchNo = record.batchNo || ''
  decideForm.inspectConclusion = record.inspectConclusion || '—'
  decideForm.itemId = record.itemId || ''
  decideForm.role = record.role || ''
  decideForm.disposition = undefined
  decideForm.locationId = record.locationId || ''
  decideOpen.value = true
}

function onDecideDispositionChange() {
  const options = locationOptionsFor(decideForm.disposition)
  if (decideForm.locationId && !options.some((opt) => opt.value === decideForm.locationId)) {
    decideForm.locationId = ''
  }
  if (!decideForm.locationId && decideForm.disposition) {
    decideForm.locationId = defaultOutputLocation(
      decideForm.itemId,
      decideForm.role,
      decideForm.disposition,
    )
  }
}

function closeDecide() {
  decideOpen.value = false
}

function saveDecide() {
  if (!decideForm.disposition) {
    message.warning('请选择最终去向')
    return
  }
  if (!decideForm.locationId) {
    message.warning(`请选择${locationPlaceholder(decideForm.disposition)}`)
    return
  }
  decideSaving.value = true
  try {
    const result = confirmOutputDisposition(decideForm.orderId, {
      outputId: decideForm.outputId,
      batchId: decideForm.batchId || decideForm.batchNo,
      disposition: decideForm.disposition,
      locationId: decideForm.locationId,
    })
    const inboundNo = result?.inbound?.docNo
    message.success(inboundNo ? `已确认产出去向，入库单 ${inboundNo}` : '已确认产出去向')
    decideOpen.value = false
  } catch (error) {
    message.error(error.message)
  } finally {
    decideSaving.value = false
  }
}

function doReextract(record) {
  try {
    const created = createReextract({ sourceBatchId: record.batchId, qty: record.qty })
    message.success(`已生成再提指令 ${created.batchNo}`)
    const path = `/production/work-orders/${created.id}`
    openTab(path, `批次指令 ${created.batchNo}`)
    router.push(path)
  } catch (error) {
    message.error(error.message)
  }
}

const mergeOpen = ref(false)
const mergeSaving = ref(false)
const mergeForm = reactive({ locationKind: undefined, locationId: undefined })

const mergeSelectedRows = computed(() =>
  rows.value.filter((row) => selectedStagingKeys.value.includes(row.key)),
)

const mergeSummary = computed(() => {
  const list = mergeSelectedRows.value
  if (!list.length) {
    return { itemLabel: '—', contentText: '—', qtyText: '—', orderNos: '—' }
  }
  const unit = list[0].unit || 'kg'
  const qty = list.reduce((sum, row) => sum + (Number(row.qty) || 0), 0)
  const orderNos = [...new Set(list.map((row) => row.orderNo).filter(Boolean))].join('、')
  return {
    itemLabel: itemLabel(list[0].itemId) || '—',
    contentText: formatContentPctText(list[0].content),
    qtyText: formatQtyWithUnit(qty, unit),
    orderNos: orderNos || '—',
  }
})

function openMerge() {
  const list = mergeSelectedRows.value
  if (!list.length) {
    message.warning('请勾选车间暂存产出')
    return
  }
  const itemId = list[0].itemId
  if (list.some((row) => row.itemId !== itemId)) {
    message.warning('只能合并同一物料的暂存批')
    return
  }
  const contentKey = (c) => {
    if (c == null || c === '') return ''
    const n = Number(c)
    return Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : String(c)
  }
  const ck = contentKey(list[0].content)
  if (list.some((row) => contentKey(row.content) !== ck)) {
    message.warning('有效含量不一致，不能合并')
    return
  }
  mergeForm.locationKind = undefined
  mergeForm.locationId = undefined
  mergeOpen.value = true
}

/** 换位置类型后，上一类型选过的位置不能留。 */
function onMergeLocationKindChange() {
  mergeForm.locationId = undefined
}

function closeMerge() {
  mergeOpen.value = false
}

function saveMerge() {
  if (!mergeForm.locationKind) {
    message.warning('请选择位置类型')
    return
  }
  if (!mergeForm.locationId) {
    message.warning(mergeForm.locationKind === 'tank' ? '请选择储罐' : '请选择仓库')
    return
  }
  mergeSaving.value = true
  try {
    const batchIds = mergeSelectedRows.value.map((row) => row.batchId)
    const result = mergeStagingBatchesToInbound({
      batchIds,
      locationId: mergeForm.locationId,
    })
    message.success(`已生成生产入库单 ${result.inbound?.docNo || ''}`)
    selectedRowKeys.value = []
    mergeOpen.value = false
  } catch (error) {
    message.error(error.message)
  } finally {
    mergeSaving.value = false
  }
}
</script>

<style scoped>
.seq-no {
  display: inline-block;
  white-space: nowrap;
}

.plan-no-link {
  color: var(--primary, #307068);
  cursor: pointer;
}

.selection-count {
  color: #4e5969;
  font-size: 14px;
}

.section-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 20px;
  color: #86909c;
}
</style>
