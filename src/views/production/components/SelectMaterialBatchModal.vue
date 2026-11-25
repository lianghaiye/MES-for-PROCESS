<template>
  <a-modal
    :open="open"
    :title="modalTitle"
    :width="modalWidth"
    wrap-class-name="select-material-batch-modal-wrap"
    class="select-material-batch-modal"
    :mask-closable="false"
    destroy-on-close
    @cancel="handleCancel"
  >
    <div class="filter-card">
      <a-form layout="inline" class="filter-form horizontal-form">
        <ListFilterBar
          :field-count="6"
          search-text="搜索"
          reset-text="清空"
          @search="handleSearch"
          @reset="handleClear"
        >
          <a-form-item label="批次号">
            <a-input
              v-model:value="filters.batchNo"
              allow-clear
              size="small"
              placeholder="请输入"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="位置类型">
            <a-select
              v-model:value="filters.locationKind"
              allow-clear
              size="small"
              placeholder="仓库 / 储罐"
              style="width: 100%"
              :options="locationKindOptions"
              @change="onLocationKindChange"
            />
          </a-form-item>
          <a-form-item label="所在位置">
            <a-select
              v-model:value="filters.locationId"
              allow-clear
              show-search
              option-filter-prop="label"
              size="small"
              placeholder="请选择"
              style="width: 100%"
              :options="locationOptions"
            />
          </a-form-item>
          <a-form-item label="有效含量">
            <a-input
              v-model:value="filters.content"
              allow-clear
              size="small"
              placeholder="如 0.9 或 90"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="供应商">
            <a-input
              v-model:value="filters.supplier"
              allow-clear
              size="small"
              placeholder="请输入"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="效期">
            <a-range-picker v-model:value="filters.expiryRange" size="small" style="width: 100%" />
          </a-form-item>
          <a-form-item label="入库时间">
            <a-range-picker
              v-model:value="filters.receivedRange"
              show-time
              size="small"
              style="width: 100%"
            />
          </a-form-item>
        </ListFilterBar>
      </a-form>
    </div>

    <div class="picker-body">
      <div class="table-panel">
        <div ref="tableWrapRef" class="table-wrap">
          <a-table
            :row-selection="rowSelection"
            :columns="columns"
            :data-source="pagedRows"
            :custom-row="customRow"
            row-key="id"
            size="small"
            bordered
            :pagination="false"
            :scroll="{ x: 980, y: tableScrollY }"
            :locale="{ emptyText: emptyText }"
          >
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'index'">
                {{ (page - 1) * pageSize + index + 1 }}
              </template>
              <template v-else-if="column.key === 'location'">
                <span>{{ record.locationName || '—' }}</span>
                <span v-if="record.locationKindLabel" class="loc-kind">{{
                  record.locationKindLabel
                }}</span>
              </template>
              <template v-else-if="column.key === 'qty'">
                {{ formatQty(record.qty) }} {{ record.unit || unitLabel }}
              </template>
              <template v-else-if="column.key === 'content'">
                {{ contentText(record.content) }}
              </template>
              <template v-else-if="column.key === 'qcResult'">
                <a
                  v-if="record.qcTaskId || (record.qcNo && record.qcNo !== '—')"
                  class="qc-link"
                  @click.stop="openQcDrawer(record)"
                >
                  <a-tag :color="inspectConclusionColor(record.qcResult)">{{
                    record.qcResult || '—'
                  }}</a-tag>
                </a>
                <a-tag v-else :color="inspectConclusionColor(record.qcResult)">{{
                  record.qcResult || '—'
                }}</a-tag>
              </template>
              <template v-else-if="column.key === 'expiryDate'">
                {{ record.expiryDate || '—' }}
              </template>
              <template v-else-if="column.key === 'supplier'">
                {{ record.supplierBatchNo || '—' }}
              </template>
              <template v-else-if="column.key === 'receivedAt'">
                {{ record.receivedAt || '—' }}
              </template>
            </template>
          </a-table>
        </div>
        <div class="table-pager">
          <a-pagination
            v-model:current="page"
            v-model:page-size="pageSize"
            size="small"
            :total="filteredRows.length"
            show-size-changer
            :page-size-options="['10', '20', '50']"
            :show-total="(total) => `共 ${total} 条`"
          />
        </div>
      </div>

      <div class="selected-panel">
        <div class="selected-head">
          <span class="selected-title">已选 {{ selectedRows.length }} 项</span>
          <a-button
            v-if="selectedRows.length"
            type="link"
            size="small"
            class="clear-btn"
            @click="clearSelection"
          >
            清空
          </a-button>
        </div>
        <div v-if="selectedRows.length" class="selected-list">
          <div v-for="item in selectedRows" :key="item.id" class="selected-item">
            <div class="selected-item-main">
              <span class="selected-code">{{ item.batchNo || item.id }}</span>
              <span class="selected-name">
                {{ selectedSummary(item) }}
              </span>
            </div>
            <a-button type="text" size="small" class="remove-btn" @click="removeSelected(item.id)">
              <CloseOutlined />
            </a-button>
          </div>
        </div>
        <a-empty v-else :image="false" description="请从左侧选择" class="selected-empty" />
      </div>
    </div>

    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" :disabled="!selectedRows.length" @click="handleConfirm">
        确定 ({{ selectedRows.length }})
      </a-button>
    </template>
  </a-modal>
  <QcTaskDetailDrawer v-model:open="qcDrawerOpen" :task="qcPreviewTask" />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { Modal } from 'ant-design-vue'
import dayjs from 'dayjs'
import ListFilterBar from '@/components/ListFilterBar.vue'
import { formatNumber } from '@/utils/numberFormat'
import { inspectConclusionColor } from '@/utils/inspectConclusion'
import { resolveBatchInspectInfo } from '@/utils/resolveBatchInspect'
import {
  findProcessItem,
  listFeedableBatches,
  listIssueableBatches,
  listProcessItems,
  listTanks,
  materialBatchState,
} from '@/store/materialBatchStore'
import { getQcTaskById, listQcTasks } from '@/store/qcTaskStore'
import QcTaskDetailDrawer from '@/views/quality/components/QcTaskDetailDrawer.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  itemId: { type: String, default: '' },
  unitLabel: { type: String, default: 'kg' },
  selectedIds: { type: Array, default: () => [] },
  /** 不限定物料，列出全部可领用的原料批次 */
  pickAnyRaw: { type: Boolean, default: false },
  /** 当前批次指令：投料时带入，便于选出待回用 / 本单待再提批次 */
  order: { type: Object, default: null },
  /** fresh 线边新料 | recycle 回流料 */
  feedSource: { type: String, default: 'fresh' },
})

const emit = defineEmits(['update:open', 'selected'])

const emptyFilters = () => ({
  batchNo: '',
  locationKind: undefined,
  locationId: undefined,
  content: '',
  supplier: '',
  expiryRange: null,
  receivedRange: null,
})

const filters = reactive(emptyFilters())
const applied = reactive(emptyFilters())
const page = ref(1)
const pageSize = ref(20)
const selectedRowKeys = ref([])
const selectedRows = ref([])
const tableWrapRef = ref(null)
const tableScrollY = ref(360)
const modalWidth = ref('90vw')
const qcDrawerOpen = ref(false)
const qcPreviewTask = ref(null)
let tableResizeObserver = null

const locationKindOptions = [
  { value: 'silo', label: '仓库' },
  { value: 'tank', label: '储罐' },
]

const modalTitle = computed(() => {
  if (props.order?.reextractOfBatchId) return '选择再提投料批次'
  if (props.feedSource === 'recycle') return '选择回流料批次'
  return '选择线边原料批次'
})

const emptyText = computed(() => {
  if (props.order?.reextractOfBatchId) return '没有本单对应的待再提批次'
  if (props.feedSource === 'recycle') return '没有可投的待回用批次'
  return '没有可投的线边已放行批次'
})

const locationOptions = computed(() => {
  const kind = filters.locationKind
  return listTanks()
    .filter((tank) => {
      if (!kind) return true
      const rowKind = tank.kind === 'tank' ? 'tank' : 'silo'
      return rowKind === kind
    })
    .map((tank) => ({
      value: tank.id,
      label: tank.name,
    }))
})

const columns = computed(() => {
  const materialCols = props.pickAnyRaw
    ? [
        { title: '物料编码', dataIndex: 'itemCode', width: 120, ellipsis: true },
        { title: '物料名称', dataIndex: 'itemName', width: 140, ellipsis: true },
      ]
    : []
  return [
    { title: '序号', key: 'index', width: 56, align: 'center', fixed: 'left' },
    ...materialCols,
    { title: '批次号', dataIndex: 'batchNo', width: 150, ellipsis: true },
    { title: '所在位置', key: 'location', width: 140, ellipsis: true },
    { title: '剩余', key: 'qty', width: 120, align: 'right' },
    { title: '有效含量', key: 'content', width: 90, align: 'right' },
    { title: '检验结论', key: 'qcResult', width: 100 },
    { title: '效期', key: 'expiryDate', width: 120 },
    { title: '供应商', key: 'supplier', width: 140, ellipsis: true },
    { title: '入库时间', key: 'receivedAt', width: 170 },
  ]
})

function syncModalWidth() {
  if (typeof window === 'undefined') return
  modalWidth.value = Math.min(1200, Math.max(960, Math.floor(window.innerWidth * 0.9)))
}

function resolveLocation(locationId) {
  if (!locationId) return null
  return listTanks().find((tank) => tank.id === locationId) || null
}

function locationNameOf(locationId) {
  return resolveLocation(locationId)?.name || ''
}

function locationKindOf(locationId) {
  const row = resolveLocation(locationId)
  if (!row) return ''
  return row.kind === 'tank' ? 'tank' : 'silo'
}

function enrichBatchRow(row) {
  const item = findProcessItem(row.itemId)
  const kind = locationKindOf(row.locationId)
  return {
    ...row,
    itemCode: row.itemCode || item?.code || '',
    itemName: row.itemName || item?.name || '',
    unit: row.unit || item?.unit || 'kg',
    locationName: locationNameOf(row.locationId),
    locationKind: kind,
    locationKindLabel: kind === 'tank' ? '储罐' : kind === 'silo' ? '仓库' : '',
    ...resolveQcInfo(row),
    receivedAt: row.receivedAt || row.productionDate || '',
  }
}

function onLocationKindChange() {
  filters.locationId = undefined
}

function selectedSummary(item) {
  const parts = [
    item.qcResult && item.qcResult !== '—' ? `检验${item.qcResult}` : '',
    item.locationName || '',
    `剩余 ${formatQty(item.qty)}${item.unit || props.unitLabel}`,
    contentText(item.content),
  ].filter(Boolean)
  return parts.join(' · ')
}

const allRows = computed(() => {
  void materialBatchState.batches
  if (props.pickAnyRaw) {
    const rawIds = new Set(
      listProcessItems()
        .filter((item) => item.kind === 'raw')
        .map((item) => item.id),
    )
    return listIssueableBatches()
      .filter((row) => rawIds.has(row.itemId))
      .map(enrichBatchRow)
  }
  if (!props.itemId) return []
  return listFeedableBatches(props.itemId, props.order, { source: props.feedSource }).map(
    enrichBatchRow,
  )
})

const filteredRows = computed(() =>
  allRows.value.filter((row) => {
    if (applied.batchNo && !includesText(row.batchNo, applied.batchNo)) return false
    if (applied.locationKind) {
      const kind = row.locationKind || locationKindOf(row.locationId)
      if (kind !== applied.locationKind) return false
    }
    if (applied.locationId && row.locationId !== applied.locationId) return false
    if (applied.supplier && !includesText(row.supplierBatchNo, applied.supplier)) return false
    if (applied.content && !matchContent(row.content, applied.content)) return false
    if (applied.expiryRange?.[0] && applied.expiryRange?.[1]) {
      const day = String(row.expiryDate || '').slice(0, 10)
      if (!day) return false
      const start = dayjs(applied.expiryRange[0]).format('YYYY-MM-DD')
      const end = dayjs(applied.expiryRange[1]).format('YYYY-MM-DD')
      if (day < start || day > end) return false
    }
    if (applied.receivedRange?.[0] && applied.receivedRange?.[1]) {
      const at = row.receivedAt || row.productionDate || ''
      if (!at) return false
      const time = dayjs(at)
      if (!time.isValid()) return false
      if (
        time.isBefore(dayjs(applied.receivedRange[0])) ||
        time.isAfter(dayjs(applied.receivedRange[1]))
      ) {
        return false
      }
    }
    return true
  }),
)

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

const rowSelection = computed(() => ({
  type: 'checkbox',
  selectedRowKeys: selectedRowKeys.value,
  columnWidth: 48,
  fixed: true,
  preserveSelectedRowKeys: true,
  onChange: (keys) => {
    selectedRowKeys.value = keys
    syncSelectedRows(keys)
  },
}))

function includesText(value, keyword) {
  const needle = String(keyword || '')
    .trim()
    .toLowerCase()
  if (!needle) return true
  return String(value || '')
    .toLowerCase()
    .includes(needle)
}

function matchContent(value, keyword) {
  const raw = String(keyword || '').trim()
  if (!raw) return true
  const n = Number(raw)
  if (!Number.isFinite(n) || value == null || value === '') return false
  const content = Number(value)
  if (!Number.isFinite(content)) return false
  if (Math.abs(n - content) < 1e-6) return true
  if (Math.abs(n - content * 100) < 1e-6) return true
  return String(content).includes(raw) || contentText(content).includes(raw)
}

function resolveQcInfo(batch) {
  return resolveBatchInspectInfo(batch)
}

function openQcDrawer(record) {
  if (!record) return
  let task = record.qcTaskId ? getQcTaskById(record.qcTaskId) : null
  if (!task && record.qcNo && record.qcNo !== '—') {
    task = listQcTasks().find((row) => String(row.qcNo || '').trim() === String(record.qcNo).trim())
  }
  if (!task) return
  qcPreviewTask.value = task
  qcDrawerOpen.value = true
}

function formatQty(value) {
  return formatNumber(value, 3, { empty: '0' })
}

function contentText(value) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const pct = Math.abs(n) <= 1 ? n * 100 : n
  return `${formatNumber(pct, 2)}%`
}

function syncSelectedRows(keys) {
  const map = new Map(allRows.value.map((row) => [row.id, row]))
  selectedRows.value.forEach((row) => map.set(row.id, row))
  selectedRows.value = (keys || []).map((id) => map.get(id)).filter(Boolean)
}

function removeSelected(id) {
  selectedRowKeys.value = selectedRowKeys.value.filter((key) => key !== id)
  selectedRows.value = selectedRows.value.filter((row) => row.id !== id)
}

function clearSelection() {
  selectedRowKeys.value = []
  selectedRows.value = []
}

function customRow(record) {
  return {
    onClick: () => {
      const has = selectedRowKeys.value.includes(record.id)
      const keys = has
        ? selectedRowKeys.value.filter((id) => id !== record.id)
        : [...selectedRowKeys.value, record.id]
      selectedRowKeys.value = keys
      syncSelectedRows(keys)
    },
  }
}

function handleSearch() {
  Object.assign(applied, {
    batchNo: filters.batchNo,
    content: filters.content,
    supplier: filters.supplier,
    expiryRange: filters.expiryRange,
    receivedRange: filters.receivedRange,
  })
  page.value = 1
}

function handleClear() {
  Object.assign(filters, emptyFilters())
  Object.assign(applied, emptyFilters())
  page.value = 1
}

function handleCancel() {
  const n = selectedRows.value.length
  if (!n) {
    emit('update:open', false)
    return
  }
  Modal.confirm({
    title: '确认离开？',
    content: `已选择 ${n} 项，确认放弃？`,
    okText: '确认离开',
    cancelText: '继续选择',
    onOk: () => emit('update:open', false),
  })
}

function handleConfirm() {
  if (!selectedRows.value.length) return
  emit(
    'selected',
    selectedRows.value.map((row) => ({ ...row })),
  )
  emit('update:open', false)
}

function syncTableScrollY() {
  const el = tableWrapRef.value
  if (!el) return
  tableScrollY.value = Math.max(200, el.clientHeight - 40)
}

function bindTableResize() {
  nextTick(() => {
    syncTableScrollY()
    if (tableResizeObserver) tableResizeObserver.disconnect()
    if (!tableWrapRef.value || typeof ResizeObserver === 'undefined') return
    tableResizeObserver = new ResizeObserver(() => syncTableScrollY())
    tableResizeObserver.observe(tableWrapRef.value)
  })
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    syncModalWidth()
    handleClear()
    const ids = Array.isArray(props.selectedIds) ? props.selectedIds.filter(Boolean) : []
    selectedRowKeys.value = ids.slice()
    syncSelectedRows(ids)
    bindTableResize()
  },
)

watch(pageSize, () => {
  page.value = 1
})

onMounted(() => {
  syncModalWidth()
  window.addEventListener('resize', syncModalWidth)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncModalWidth)
  if (tableResizeObserver) tableResizeObserver.disconnect()
})
</script>

<style lang="less" scoped>
.select-material-batch-modal {
  .filter-card {
    flex-shrink: 0;
    margin-bottom: 12px;
  }

  .picker-body {
    display: flex;
    gap: 12px;
    align-items: stretch;
    flex: 1;
    min-height: 480px;
    height: 560px;
    max-height: calc(90vh - 200px);
  }

  .table-panel {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .table-wrap {
    flex: 1;
    min-height: 0;
    overflow: hidden;

    :deep(.ant-table-wrapper),
    :deep(.ant-spin-nested-loading),
    :deep(.ant-spin-container),
    :deep(.ant-table),
    :deep(.ant-table-container) {
      height: 100%;
    }
  }

  .table-pager {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-shrink: 0;
    margin-top: 12px;
    padding-top: 4px;

    :deep(.ant-pagination) {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      margin: 0;
    }
  }

  .selected-panel {
    width: 280px;
    flex-shrink: 0;
    align-self: stretch;
    min-height: 0;
    overflow: hidden;
    border: 1px solid #f0f0f0;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    background: #fafafa;
  }

  .selected-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid #f0f0f0;
    background: #fff;
    flex-shrink: 0;
  }

  .selected-title {
    font-weight: 600;
    font-size: 13px;
    color: #333;
  }

  .clear-btn {
    padding: 0;
    height: auto;
  }

  .selected-list {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 8px;
  }

  .selected-item {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    padding: 6px 8px;
    margin-bottom: 6px;
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: 4px;
  }

  .selected-item-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .selected-code {
    font-size: 12px;
    color: #307068;
    font-weight: 500;
  }

  .selected-name {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.65);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loc-kind {
    margin-left: 6px;
    font-size: 12px;
    color: #86909c;
  }

  .qc-link {
    cursor: pointer;
  }

  .remove-btn {
    flex-shrink: 0;
    color: rgba(0, 0, 0, 0.45);

    &:hover {
      color: #ff4d4f;
    }
  }

  .selected-empty {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 0;
  }
}
</style>

<style lang="less">
.select-material-batch-modal-wrap {
  .ant-modal {
    max-width: min(1200px, 90vw);
    top: 24px;
    padding-bottom: 0;
  }

  .ant-modal-content {
    display: flex;
    flex-direction: column;
    max-height: 92vh;
  }

  .ant-modal-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
}
</style>
