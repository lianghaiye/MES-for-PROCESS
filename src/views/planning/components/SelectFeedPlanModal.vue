<template>
  <a-modal
    :open="open"
    :title="title"
    width="min(1480px, 94vw)"
    wrap-class-name="select-feed-plan-modal-wrap"
    :mask-closable="false"
    destroy-on-close
    class="select-feed-plan-modal"
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
          <a-form-item label="状态">
            <a-select
              v-model:value="filters.status"
              allow-clear
              size="small"
              placeholder="全部"
              :options="statusOptions"
            />
          </a-form-item>
          <a-form-item label="计划号">
            <a-input
              v-model:value="filters.planNo"
              allow-clear
              size="small"
              placeholder="请输入"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="计划名称">
            <a-input
              v-model:value="filters.planName"
              allow-clear
              size="small"
              placeholder="请输入"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="期间">
            <a-select
              v-model:value="filters.periodType"
              allow-clear
              size="small"
              placeholder="全部"
              :options="periodOptions"
            />
          </a-form-item>
          <a-form-item label="主产品">
            <a-input
              v-model:value="filters.product"
              allow-clear
              size="small"
              placeholder="编码 / 名称"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="创建时间">
            <a-range-picker v-model:value="filters.createdRange" size="small" style="width: 100%" />
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
            :scroll="{ x: 1100, y: tableScrollY }"
            :locale="{ emptyText: '没有可生成批次的生产计划' }"
          >
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'index'">
                {{ (page - 1) * pageSize + index + 1 }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="statusColor[record.status] || 'default'">
                  {{ statusLabel[record.status] || record.status || '—' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'periodType'">
                {{ periodLabel[record.periodType] || '—' }}
              </template>
              <template v-else-if="column.key === 'remaining'">
                {{ formatQty(record.remaining) }}
              </template>
              <template v-else-if="column.key === 'createdAt'">
                {{ record.createdAt || '—' }}
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
            :page-size-options="['10', '20', '50', '100']"
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
              <span class="selected-code">{{ item.planNo || item.id }}</span>
              <span class="selected-name" :title="item.planName">{{ item.planName || '—' }}</span>
            </div>
            <a-button type="text" size="small" class="remove-btn" @click="clearSelection">
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
        确定选择
      </a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import ListFilterBar from '@/components/ListFilterBar.vue'
import {
  FEED_PLAN_STATUS_COLOR,
  FEED_PLAN_STATUS_LABEL,
  canGenerateFeedPlan,
  feedPlanState,
  planFeedCoverage,
  resolveFeedPlanStatus,
} from '@/store/feedPlanStore'
import { getFormula, itemLabel } from '@/store/processFormulaStore'
import {
  FEED_PLAN_PERIOD_LABEL,
  FEED_PLAN_PERIOD_OPTIONS,
  defaultPlanName,
} from '@/utils/feedPlanPeriod'
import { round3 } from '@/utils/processBatchMath'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '选择生产计划' },
  /** 预选计划 id */
  initialSelectedId: { type: String, default: '' },
})

const emit = defineEmits(['update:open', 'selected'])

const statusLabel = FEED_PLAN_STATUS_LABEL
const statusColor = FEED_PLAN_STATUS_COLOR
const periodLabel = FEED_PLAN_PERIOD_LABEL
const periodOptions = FEED_PLAN_PERIOD_OPTIONS
const statusOptions = Object.entries(FEED_PLAN_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}))

const emptyFilters = () => ({
  status: undefined,
  planNo: '',
  planName: '',
  periodType: undefined,
  product: '',
  createdRange: null,
})

const filters = reactive(emptyFilters())
const applied = reactive(emptyFilters())
const page = ref(1)
const pageSize = ref(20)
const selectedRowKeys = ref([])
const selectedRows = ref([])
const tableWrapRef = ref(null)
const tableScrollY = ref(360)
let tableResizeObserver = null

const columns = [
  { title: '序号', key: 'index', width: 64, align: 'center', fixed: 'left' },
  { title: '状态', key: 'status', width: 90, fixed: 'left' },
  { title: '计划号', dataIndex: 'planNo', key: 'planNo', width: 160, ellipsis: true },
  { title: '名称', dataIndex: 'planName', key: 'planName', width: 180, ellipsis: true },
  { title: '期间类型', key: 'periodType', width: 100 },
  { title: '主产品', dataIndex: 'product', key: 'product', width: 160, ellipsis: true },
  {
    title: '剩余投料量',
    key: 'remaining',
    dataIndex: 'remaining',
    width: 120,
    align: 'right',
  },
  { title: '创建时间', key: 'createdAt', dataIndex: 'createdAt', width: 150 },
]

const allRows = computed(() => {
  void feedPlanState.plans
  return feedPlanState.plans
    .filter((row) => canGenerateFeedPlan(row.id))
    .map((row) => {
      const formula = getFormula(row.formulaId)
      const productId = row.itemId || formula?.itemId
      const coverage = planFeedCoverage(row.id)
      return {
        id: row.id,
        status: resolveFeedPlanStatus(row.id),
        planNo: row.planNo || '',
        planName:
          row.planName || defaultPlanName(row.periodType, row.start, [row.start, row.end]) || '—',
        periodType: row.periodType,
        periodLabel: row.periodLabel || '',
        product: productId ? itemLabel(productId) : '—',
        productId: productId || '',
        remaining: coverage.remaining,
        createdAt: row.createdAt || '',
      }
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
})

function includesText(value, keyword) {
  const needle = String(keyword || '')
    .trim()
    .toLowerCase()
  if (!needle) return true
  return String(value || '')
    .toLowerCase()
    .includes(needle)
}

const filteredRows = computed(() =>
  allRows.value.filter((row) => {
    if (applied.status && row.status !== applied.status) return false
    if (!includesText(row.planNo, applied.planNo)) return false
    if (!includesText(row.planName, applied.planName)) return false
    if (applied.periodType && row.periodType !== applied.periodType) return false
    if (!includesText(row.product, applied.product)) return false
    if (applied.createdRange?.[0] && applied.createdRange?.[1]) {
      const day = String(row.createdAt || '').slice(0, 10)
      if (!day) return false
      const start = dayjs(applied.createdRange[0]).format('YYYY-MM-DD')
      const end = dayjs(applied.createdRange[1]).format('YYYY-MM-DD')
      if (day < start || day > end) return false
    }
    return true
  }),
)

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

const rowSelection = computed(() => ({
  type: 'radio',
  selectedRowKeys: selectedRowKeys.value,
  columnWidth: 48,
  fixed: true,
  onChange: (keys, rows) => {
    selectedRowKeys.value = keys
    selectedRows.value = rows
  },
}))

function formatQty(value) {
  return `${round3(value) || 0}`
}

function handleSearch() {
  Object.assign(applied, {
    status: filters.status,
    planNo: filters.planNo,
    planName: filters.planName,
    periodType: filters.periodType,
    product: filters.product,
    createdRange: filters.createdRange,
  })
  page.value = 1
}

function handleClear() {
  Object.assign(filters, emptyFilters())
  Object.assign(applied, emptyFilters())
  page.value = 1
}

function clearSelection() {
  selectedRowKeys.value = []
  selectedRows.value = []
}

function customRow(record) {
  return {
    onClick: () => {
      selectedRowKeys.value = [record.id]
      selectedRows.value = [record]
    },
  }
}

function handleCancel() {
  emit('update:open', false)
}

function handleConfirm() {
  const row = selectedRows.value[0]
  if (!row) return
  emit('selected', row)
  emit('update:open', false)
}

function syncTableScrollY() {
  const el = tableWrapRef.value
  if (!el) return
  const height = el.clientHeight
  tableScrollY.value = Math.max(200, height - 40)
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
    handleClear()
    const id = props.initialSelectedId
    if (id) {
      const row = allRows.value.find((item) => item.id === id)
      selectedRowKeys.value = row ? [row.id] : []
      selectedRows.value = row ? [row] : []
    } else {
      clearSelection()
    }
    bindTableResize()
  },
)

watch(pageSize, () => {
  page.value = 1
})

onBeforeUnmount(() => {
  if (tableResizeObserver) tableResizeObserver.disconnect()
})
</script>

<style lang="less" scoped>
.select-feed-plan-modal {
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
      justify-content: flex-end;
      margin: 0;
    }

    :deep(.ant-pagination-options) {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
    }
  }

  .selected-panel {
    width: 260px;
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
.select-feed-plan-modal-wrap {
  .ant-modal {
    max-width: min(1480px, 94vw);
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
