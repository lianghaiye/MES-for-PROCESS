<template>
  <div class="list-page batch-instruction-page">
    <div class="filter-card">
      <a-form layout="inline" class="filter-form horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="批次号">
              <a-input
                v-model:value="filters.keyword"
                size="small"
                allow-clear
                placeholder="批次号 / 产品 / 配方"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="状态">
              <a-select
                v-model:value="filters.status"
                size="small"
                allow-clear
                placeholder="全部"
                :options="statusOptions"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-form-item label="产线">
              <a-select
                v-model:value="filters.productionLineId"
                size="small"
                allow-clear
                show-search
                option-filter-prop="label"
                placeholder="全部"
                :options="lineOptions"
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
        <a-button type="primary" size="small" @click="open = true">生成批次指令</a-button>
        <a-button size="small" :disabled="!releasableSelection.length" @click="handleBatchRelease">
          批量下发
        </a-button>
        <a-button
          size="small"
          danger
          :disabled="!terminableSelection.length"
          @click="handleTerminateSelected"
        >
          终止
        </a-button>
        <span class="selection-count">已选 {{ selectedRowKeys.length }} 项</span>
        <a-button
          type="link"
          size="small"
          :disabled="!selectedRowKeys.length"
          @click="clearSelection"
        >
          清空
        </a-button>
      </a-space>
      <a-space :size="4" class="toolbar-icons">
        <TableColumnSettingButton @click="columnDrawerOpen = true" />
      </a-space>
    </div>

    <a-alert type="info" show-icon class="summary-bar" :message="pageHint" />

    <div class="table-card">
      <a-table
        :columns="displayColumns"
        :data-source="rows"
        row-key="id"
        size="small"
        :pagination="{
          pageSize: 20,
          size: 'small',
          showSizeChanger: true,
          showTotal: (n) => `共 ${n} 条`,
        }"
        :row-selection="rowSelection"
        :scroll="{ x: tableScrollX }"
      >
        <template #headerCell="{ column }">
          <template v-if="column.key === 'seq'">
            <span class="th-with-tip">
              批序
              <a-tooltip :title="seqTip">
                <QuestionCircleOutlined class="th-tip-icon" />
              </a-tooltip>
            </span>
          </template>
          <template v-else>{{ column.title }}</template>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            <span class="seq-no">{{ record.seqNo }}</span>
          </template>
          <template v-else-if="column.key === 'batchNo'">
            <a class="plan-no-link" @click="openDetail(record)">{{ record.batchNo || '—' }}</a>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">
              {{ ORDER_STATUS_LABEL[record.status] || '—' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'stage'">{{ record.stageText }}</template>
          <template v-else-if="column.key === 'item'">{{ record.productText }}</template>
          <template v-else-if="column.key === 'formula'">{{ record.formulaText }}</template>
          <template v-else-if="column.key === 'productionLine'">{{ record.lineText }}</template>
          <template v-else-if="column.key === 'seq'">{{ record.seqText }}</template>
          <template v-else-if="column.key === 'qty'">{{ record.qtyText }}</template>
          <template v-else-if="column.key === 'feed'">{{ record.feedText }}</template>
          <template v-else-if="column.key === 'output'">{{ record.outputText }}</template>
          <template v-else-if="column.key === 'gap'">{{ record.gapText }}</template>
          <template v-else-if="column.key === 'source'">{{ record.sourceText }}</template>
          <template v-else-if="column.key === 'createdBy'">{{ record.createdBy || '—' }}</template>
          <template v-else-if="column.key === 'createdAt'">{{ record.createdAt || '—' }}</template>
          <template v-else-if="column.key === 'updatedBy'">{{ record.updatedBy || '—' }}</template>
          <template v-else-if="column.key === 'updatedAt'">{{ record.updatedAt || '—' }}</template>
          <template v-else-if="column.key === 'action'">
            <a-button
              v-if="record.status === 'pending_release'"
              type="link"
              size="small"
              @click="handleRelease(record)"
            >
              下发
            </a-button>
            <a-button
              v-if="record.status === 'running'"
              type="link"
              size="small"
              @click="handleComplete(record)"
            >
              完成
            </a-button>
            <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
          </template>
        </template>
      </a-table>
    </div>

    <TableColumnSettingDrawer
      v-model:open="columnDrawerOpen"
      v-model:settings="columnSettings"
      :default-settings="defaultColumnSettings"
    />
    <GenerateBatchInstructionModal v-model:open="open" />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { QuestionCircleOutlined } from '@ant-design/icons-vue'
import TableColumnSettingButton from '@/components/TableColumnSettingButton.vue'
import TableColumnSettingDrawer from '@/components/TableColumnSettingDrawer.vue'
import { useTableColumnSettings } from '@/composables/useTableColumnSettings'
import { useTabs } from '@/composables/useTabs'
import { getFormula, itemLabel } from '@/store/processFormulaStore'
import {
  ORDER_STATUS_LABEL,
  batchInstructionState,
  cancelBatchOrder,
  completeOrder,
  releaseOrder,
} from '@/store/batchInstructionStore'
import {
  formatProductionLineLabel,
  listEnabledProductionLineOptions,
  productionLineState,
} from '@/store/productionLineStore'
import { getFeedPlan } from '@/store/feedPlanStore'
import { currentProcessStep } from '@/utils/processRouteBoard'
import { formatQty } from '@/utils/numberFormat'
import GenerateBatchInstructionModal from '@/views/production/components/GenerateBatchInstructionModal.vue'

const router = useRouter()
const { openTab } = useTabs()
const open = ref(false)
const selectedRowKeys = ref([])

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  columnWidth: 48,
  fixed: true,
  preserveSelectedRowKeys: true,
  onChange: (keys) => {
    selectedRowKeys.value = Array.isArray(keys) ? keys : []
  },
}))

const releasableSelection = computed(() =>
  selectedRowKeys.value.filter((id) => {
    const order = batchInstructionState.orders.find((row) => row.id === id)
    return order?.status === 'pending_release'
  }),
)

const terminableSelection = computed(() =>
  selectedRowKeys.value.filter((id) => {
    const order = batchInstructionState.orders.find((row) => row.id === id)
    return order?.status === 'pending_release' || order?.status === 'running'
  }),
)

function clearSelection() {
  selectedRowKeys.value = []
}

const pageHint =
  '一张批次指令对应一个槽次。批序只在按基准批量把一次需求拆成多张指令时出现，例如 2/5 表示 5 张里的第 2 张；从生产计划开启的槽次不拆批，批序为 —。'

const seqTip =
  '一次需求按配方基准批量拆成多张指令时的序号 / 总张数。连续线槽次单独开启，不占用批序。'

const statusOptions = Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}))

const filters = reactive({
  keyword: '',
  status: undefined,
  productionLineId: undefined,
})
const applied = reactive({
  keyword: '',
  status: undefined,
  productionLineId: undefined,
})

const baseColumns = [
  { title: '序号', key: 'index', dataIndex: 'seqNo', width: 72, fixed: 'left' },
  { title: '状态', key: 'status', dataIndex: 'status', width: 90, fixed: 'left' },
  { title: '批次号', key: 'batchNo', dataIndex: 'batchNo', width: 160, fixed: 'left' },
  {
    title: '工艺阶段',
    key: 'stage',
    dataIndex: 'stageText',
    width: 180,
    fixed: 'left',
    ellipsis: true,
  },
  { title: '主产品', key: 'item', dataIndex: 'productText', width: 180, ellipsis: true },
  { title: '批序', key: 'seq', dataIndex: 'seqText', width: 88 },
  { title: '计划投料量', key: 'qty', dataIndex: 'qtyText', width: 120, align: 'right' },
  { title: '实投', key: 'feed', dataIndex: 'feedText', width: 110, align: 'right' },
  { title: '实际产出', key: 'output', dataIndex: 'outputText', width: 110, align: 'right' },
  { title: '得率差', key: 'gap', dataIndex: 'gapText', width: 90, align: 'right' },
  { title: '配方', key: 'formula', dataIndex: 'formulaText', width: 180, ellipsis: true },
  { title: '产线', key: 'productionLine', dataIndex: 'lineText', width: 140, ellipsis: true },
  { title: '来源计划', key: 'source', dataIndex: 'sourceText', width: 180, ellipsis: true },
  { title: '创建人', key: 'createdBy', dataIndex: 'createdBy', width: 110 },
  { title: '创建时间', key: 'createdAt', dataIndex: 'createdAt', width: 150 },
  { title: '最近操作人', key: 'updatedBy', dataIndex: 'updatedBy', width: 120 },
  { title: '操作时间', key: 'updatedAt', dataIndex: 'updatedAt', width: 150 },
  { title: '操作', key: 'action', dataIndex: 'action', width: 150, fixed: 'right' },
]

const { columnSettings, columnDrawerOpen, displayColumns, tableScrollX, defaultColumnSettings } =
  useTableColumnSettings('batch-instruction-list-v2', baseColumns, {
    minScrollX: 2200,
    excludeKeys: ['index', 'action'],
  })

const lineOptions = computed(() => {
  void productionLineState.lines
  return listEnabledProductionLineOptions()
})

function statusColor(status) {
  if (status === 'done') return 'success'
  if (status === 'running') return 'processing'
  if (status === 'cancelled') return 'default'
  return 'warning'
}

function qtyText(order) {
  if (order.qtyConfirmed === false || order.qty == null || order.qty === '') return '待确认'
  return `${formatQty(order.qty)} ${order.unit || ''}`.trim()
}

function sumFeed(order) {
  return (order.feeds || []).reduce((sum, row) => sum + (Number(row.qty) || 0), 0)
}

const rows = computed(() => {
  void batchInstructionState.orders
  const keyword = String(applied.keyword || '')
    .trim()
    .toLowerCase()
  return batchInstructionState.orders
    .filter((order) => {
      if (applied.status && order.status !== applied.status) return false
      if (applied.productionLineId && order.productionLineId !== applied.productionLineId) {
        return false
      }
      if (!keyword) return true
      const product = itemLabel(order.itemId)
      const text = `${order.batchNo || ''} ${product} ${order.formulaName || ''} ${order.sourceLabel || ''}`
      return text.toLowerCase().includes(keyword)
    })
    .map((order, index) => {
      const stage = currentProcessStep(order, getFormula)
      const plan = order.feedPlanId ? getFeedPlan(order.feedPlanId) : null
      const feed = sumFeed(order)
      const split = Number(order.batchCount) > 1
      return {
        ...order,
        seqNo: String(index + 1),
        productText: itemLabel(order.itemId) || '—',
        formulaText: `${order.formulaName || '—'} ${order.formulaVersion || ''}`.trim(),
        lineText: order.productionLineId
          ? formatProductionLineLabel(order.productionLineId) || '—'
          : order.executeBy === 'formula' || order.feedPlanId
            ? '按配方设备'
            : '—',
        stageText: stage?.text || '—',
        seqText: split ? `${order.seq}/${order.batchCount}` : '—',
        qtyText: qtyText(order),
        feedText: feed > 0 ? `${formatQty(feed)} ${order.unit || ''}`.trim() : '—',
        outputText:
          order.actualOutput == null || order.actualOutput === ''
            ? '—'
            : `${formatQty(order.actualOutput)} ${order.unit || ''}`.trim(),
        gapText: order.yieldGap == null || order.yieldGap === '' ? '—' : String(order.yieldGap),
        sourceText: plan?.planNo || order.sourceLabel || '—',
      }
    })
})

function applySearch() {
  applied.keyword = filters.keyword
  applied.status = filters.status
  applied.productionLineId = filters.productionLineId
}

function resetSearch() {
  filters.keyword = ''
  filters.status = undefined
  filters.productionLineId = undefined
  applySearch()
}

function openDetail(record) {
  const path = `/production/work-orders/${record.id}`
  openTab(path, record.batchNo || '批次指令')
  router.push(path)
}

function handleRelease(record) {
  try {
    releaseOrder(record.id)
    message.success('已下发')
  } catch (error) {
    message.error(error.message || '下发失败')
  }
}

function handleComplete(record) {
  try {
    completeOrder(record.id)
    message.success('批次指令已完成')
  } catch (error) {
    message.error(error.message || '完成失败')
  }
}

function handleBatchRelease() {
  const ids = releasableSelection.value
  if (!ids.length) return
  Modal.confirm({
    title: '批量下发',
    content: `下发选中的 ${ids.length} 张待下发指令？下发后进入执行中。`,
    okText: '下发',
    cancelText: '取消',
    onOk() {
      ids.forEach((id) => releaseOrder(id))
      message.success(`已下发 ${ids.length} 张`)
      clearSelection()
    },
  })
}

function handleTerminateSelected() {
  const ids = terminableSelection.value
  if (!ids.length) return
  Modal.confirm({
    title: '终止批次指令',
    content: `终止选中的 ${ids.length} 张指令？终止后状态为已作废，不能再下发或投料。`,
    okText: '终止',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      ids.forEach((id) => cancelBatchOrder(id))
      message.success(`已终止 ${ids.length} 张`)
      clearSelection()
    },
  })
}

watch(rows, (list) => {
  const visible = new Set(list.map((row) => row.id))
  selectedRowKeys.value = selectedRowKeys.value.filter((id) => visible.has(id))
})
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

.th-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.th-tip-icon {
  color: #86909c;
  font-size: 12px;
}

.selection-count {
  color: #4e5969;
  font-size: 14px;
}
</style>
