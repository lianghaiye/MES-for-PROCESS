<template>
  <div v-if="plan" class="feed-plan-detail-page">
    <div class="detail-page-head">
      <div class="head-left">
        <a-button type="text" size="small" @click="goBack">
          <ArrowLeftOutlined />
        </a-button>
        <span class="order-no">{{ plan.planNo || plan.id }}</span>
        <span v-if="headerProduct" class="product-title">{{ headerProduct }}</span>
        <a-tag :color="periodTagColor[plan.periodType] || 'default'">
          {{ periodLabel[plan.periodType] || '—' }}
        </a-tag>
        <a-tag :color="statusColor[status] || 'default'">
          {{ statusLabel[status] || '—' }}
        </a-tag>
      </div>
      <a-space class="head-actions" :size="8">
        <a-button v-if="canGenerate" size="small" type="primary" @click="handleExecute">
          生成批次指令
        </a-button>
        <a-button v-if="canTerminate" size="small" danger @click="handleStop"> 终止计划 </a-button>
        <a-button size="small" @click="goBack">返回列表</a-button>
      </a-space>
    </div>

    <div class="detail-tabs-wrap plan-detail-tabs">
      <a-tabs
        v-model:active-key="detailTab"
        class="detail-tabs detail-tabs-pill detail-tabs-pill--nav-only"
      >
        <a-tab-pane key="overview" tab="计划详情" />
        <a-tab-pane key="compare" tab="指标对比" />
        <a-tab-pane key="log" :tab="`操作日志 (${operationLogs.length})`" />
      </a-tabs>
    </div>

    <div class="detail-body">
      <div v-show="detailTab === 'overview'" class="detail-overview">
        <DetailSectionCard title="计划概览">
          <div class="overview-cards">
            <div
              v-for="card in overviewCards"
              :key="card.key"
              class="overview-card"
              :class="`is-${card.tone}`"
            >
              <div class="overview-label">
                {{ card.label }}
                <a-tooltip v-if="card.tip" :title="card.tip">
                  <QuestionCircleOutlined class="overview-tip" />
                </a-tooltip>
              </div>
              <div class="overview-value">{{ card.value }}</div>
            </div>
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="过程指标">
          <div class="overview-cards overview-cards--kpi">
            <div
              v-for="card in processKpiCards"
              :key="card.key"
              class="overview-card"
              :class="`is-${card.tone}`"
            >
              <div class="overview-label">
                {{ card.label }}
                <a-tooltip v-if="card.tip" :title="card.tip">
                  <QuestionCircleOutlined class="overview-tip" />
                </a-tooltip>
              </div>
              <div class="overview-value">{{ card.value }}</div>
            </div>
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="基本信息">
          <div class="meta-bar">
            <span
              ><i>创建人</i><b>{{ plan.createdBy || '—' }}</b></span
            >
            <span
              ><i>创建时间</i><b>{{ plan.createdAt || '—' }}</b></span
            >
            <span
              ><i>执行开启时间</i><b>{{ plan.executedAt || '—' }}</b></span
            >
            <span
              ><i>预计开启时间</i><b>{{ expectedAt || '—' }}</b></span
            >
          </div>
          <div class="info-grid">
            <div v-for="field in basicFields" :key="field.label" class="info-item">
              <span class="field-label">{{ field.label }}：</span>
              <span class="field-value">{{ field.value }}</span>
            </div>
          </div>
        </DetailSectionCard>

        <DetailSectionCard v-if="children.length" :title="childSectionTitle">
          <a-form layout="inline" class="horizontal-form child-filter">
            <a-row :gutter="[12, 8]" style="width: 100%" align="middle">
              <a-col :xs="24" :sm="12" :md="6">
                <a-form-item label="计划号/批次号">
                  <a-input
                    v-model:value="childQuery.keyword"
                    size="small"
                    allow-clear
                    placeholder="请输入"
                    @press-enter="applyChildSearch"
                  />
                </a-form-item>
              </a-col>
              <a-col :xs="24" :sm="12" :md="6">
                <a-form-item label="状态">
                  <a-select
                    v-model:value="childQuery.status"
                    size="small"
                    allow-clear
                    placeholder="请选择"
                    :options="childStatusOptions"
                  />
                </a-form-item>
              </a-col>
              <a-col :xs="24" :sm="12" :md="6">
                <a-form-item label="期间">
                  <a-select
                    v-model:value="childQuery.period"
                    size="small"
                    allow-clear
                    placeholder="请选择"
                    :options="childPeriodOptions"
                  />
                </a-form-item>
              </a-col>
              <a-col :xs="24" :sm="12" :md="6" class="child-filter-actions">
                <a-button type="primary" size="small" @click="applyChildSearch">查询</a-button>
                <a-button size="small" @click="resetChildSearch">重置</a-button>
              </a-col>
            </a-row>
          </a-form>
          <a-table
            class="plan-tree-table"
            :columns="treeColumns"
            :data-source="filteredPlanTree"
            row-key="id"
            size="small"
            :pagination="false"
            :scroll="{ x: 1560 }"
            :expanded-row-keys="expandedRowKeys"
            :locale="{ emptyText: childFiltering ? '没有符合条件的子计划' : '还没有子计划' }"
            @expand="onExpandTree"
          >
            <template #headerCell="{ column }">
              <template v-if="column.key === 'execProgress'">
                <span class="th-with-tip">
                  执行情况
                  <a-tooltip :title="execProgressTip">
                    <QuestionCircleOutlined class="th-tip-icon" />
                  </a-tooltip>
                </span>
              </template>
              <template v-else>{{ column.title }}</template>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'seq'">{{ record.seqNo }}</template>
              <template v-else-if="column.key === 'status'">
                <a-tag
                  v-if="record.kind === 'plan'"
                  :color="statusColor[record.status] || 'default'"
                >
                  {{ statusLabel[record.status] || '—' }}
                </a-tag>
                <a-tag v-else :color="batchStatusColor(record.status)">
                  {{ ORDER_STATUS_LABEL[record.status] || record.status || '—' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'no'">
                <a v-if="record.kind === 'plan'" class="link" @click="goPlanDetail(record)">
                  {{ record.planNo || '—' }}
                </a>
                <a v-else class="link" @click="goBatchDetail(record)">{{
                  record.batchNo || '—'
                }}</a>
              </template>
              <template v-else-if="column.key === 'targetQty'">{{ record.targetText }}</template>
              <template v-else-if="column.key === 'actualQty'">{{ record.actualText }}</template>
              <template v-else-if="column.key === 'execProgress'">{{ record.execText }}</template>
              <template v-else-if="column.key === 'openedAt'">{{ record.openedAt }}</template>
              <template v-else-if="column.key === 'expectedAt'">{{ record.expectedAt }}</template>
              <template v-else-if="column.key === 'period'">{{
                record.periodText || '—'
              }}</template>
              <template v-else-if="column.key === 'action'">
                <template v-if="record.kind === 'plan'">
                  <a-button
                    v-if="canGenerateRow(record)"
                    type="link"
                    size="small"
                    @click="openGenerate(record.id)"
                  >
                    生成批次指令
                  </a-button>
                  <a-button
                    v-if="canEditRow(record)"
                    type="link"
                    size="small"
                    @click="openEdit(record)"
                  >
                    编辑
                  </a-button>
                  <a-button
                    v-if="canTerminateRow(record)"
                    type="link"
                    size="small"
                    danger
                    @click="handleTerminateRow(record)"
                  >
                    终止
                  </a-button>
                  <span v-if="!hasPlanAction(record)">—</span>
                </template>
                <span v-else>—</span>
              </template>
            </template>
          </a-table>
        </DetailSectionCard>

        <DetailSectionCard v-else :title="`批次指令 (${ownOrderRows.length})`">
          <a-table
            :columns="orderColumns"
            :data-source="ownOrderRows"
            row-key="id"
            size="small"
            :pagination="false"
            :scroll="{ x: 880 }"
            :locale="{ emptyText: '还没有批次指令' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'batchNo'">
                <a class="link" @click="goBatchDetail(record)">{{ record.batchNo || '—' }}</a>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="batchStatusColor(record.status)">
                  {{ ORDER_STATUS_LABEL[record.status] || record.status || '—' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'qty'">
                {{
                  record.qtyConfirmed === false || record.qty == null || record.qty === ''
                    ? '待确认'
                    : `${record.qty} ${record.unit || ''}`
                }}
              </template>
            </template>
          </a-table>
        </DetailSectionCard>
      </div>

      <div v-show="detailTab === 'compare'" class="compare-card">
        <div class="compare-hint">
          每个直接子计划一行。周计划再拆成日计划时，仍按这一周汇总，下级批次计入这一周。
        </div>
        <a-table
          class="compare-table"
          :columns="compareColumns"
          :data-source="compareRows"
          row-key="id"
          size="small"
          :pagination="false"
          :scroll="{ x: 1920 }"
          :locale="{ emptyText: '没有可对比的子计划' }"
        >
          <template #headerCell="{ column }">
            <template v-if="compareTips[column.key]">
              <span class="th-with-tip">
                {{ column.title }}
                <a-tooltip :title="compareTips[column.key]">
                  <QuestionCircleOutlined class="th-tip-icon" />
                </a-tooltip>
              </span>
            </template>
            <template v-else>{{ column.title }}</template>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'planNo'">
              <a class="link" @click="goPlanDetail(record)">{{ record.planNo || '—' }}</a>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColor[record.status] || 'default'">
                {{ statusLabel[record.status] || '—' }}
              </a-tag>
            </template>
            <template v-else>{{ record[column.dataIndex] ?? record[column.key] }}</template>
          </template>
        </a-table>
      </div>

      <div v-show="detailTab === 'log'">
        <DetailSectionCard title="操作日志">
          <a-table
            :columns="logColumns"
            :data-source="operationLogs"
            row-key="id"
            size="small"
            :pagination="operationLogs.length > 10 ? { pageSize: 10, size: 'small' } : false"
            :locale="{ emptyText: '还没有操作日志' }"
            :scroll="{ x: 720 }"
          />
        </DetailSectionCard>
      </div>
    </div>

    <GeneratePlanBatchModal
      :open="generateOpen"
      :plan-id="generatePlanId"
      @cancel="generateOpen = false"
      @done="generateOpen = false"
    />

    <a-modal
      :open="editOpen"
      title="编辑子计划"
      :width="720"
      :mask-closable="false"
      destroy-on-close
      @cancel="editOpen = false"
    >
      <div class="modal-basic-card">
        <div class="section-title">基本信息</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="12">
              <a-form-item label="计划号">
                <a-input :value="editForm.planNo" size="small" disabled />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="期间">
                <a-input :value="editForm.periodLabel" size="small" disabled />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="计划名称">
                <a-input v-model:value="editForm.planName" size="small" allow-clear />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="目标投料量" required>
                <a-input-number
                  v-model:value="editForm.targetQty"
                  size="small"
                  :min="0.001"
                  :precision="3"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="计划来源" required>
                <a-select v-model:value="editForm.source" size="small" :options="sourceOptions" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="来源单号">
                <a-input v-model:value="editForm.sourceRef" size="small" allow-clear />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="备注" class="remark-item">
                <a-textarea v-model:value="editForm.remark" :rows="2" size="small" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </div>
      <template #footer>
        <a-button @click="editOpen = false">取消</a-button>
        <a-button type="primary" @click="handleEditSave">保存</a-button>
      </template>
    </a-modal>
  </div>
  <a-empty v-else description="未找到生产计划" />
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { ArrowLeftOutlined, QuestionCircleOutlined } from '@ant-design/icons-vue'
import DetailSectionCard from '@/components/DetailSectionCard.vue'
import GeneratePlanBatchModal from '@/views/planning/components/GeneratePlanBatchModal.vue'
import { theoreticalOutput } from '@/utils/processBatchMath'
import { useFormCreatePage } from '@/composables/useFormCreatePage'
import { useTabs } from '@/composables/useTabs'
import { getFormula, itemLabel, itemUnit, OUTPUT_ROLE_LABEL } from '@/store/processFormulaStore'
import { formatPlanLineLabel } from '@/store/productionLineStore'
import {
  ORDER_STATUS_LABEL,
  batchInstructionState,
  listOrdersByFeedPlan,
} from '@/store/batchInstructionStore'
import {
  childPlans,
  canGenerateFeedPlan,
  estimateExpectedExecuteAt,
  feedPlanState,
  FEED_PLAN_STATUS,
  FEED_PLAN_STATUS_COLOR,
  FEED_PLAN_STATUS_LABEL,
  buildFeedPlanKpis,
  getFeedPlan,
  mainRawMaterialIds,
  resolveFeedPlanStatus,
  saveFeedPlan,
  stopFeedPlanOrders,
  sumActualFeed,
} from '@/store/feedPlanStore'
import { shiftEnergyReportState } from '@/store/shiftEnergyReportStore'
import {
  FEED_PLAN_PERIOD,
  FEED_PLAN_PERIOD_LABEL,
  FEED_PLAN_SOURCE_LABEL,
  FEED_PLAN_SOURCE_OPTIONS,
  FEED_PLAN_SPLIT,
  FEED_PLAN_SPLIT_LABEL,
} from '@/utils/feedPlanPeriod'
import { formatQty } from '@/utils/numberFormat'

const route = useRoute()
const router = useRouter()
const { openTab } = useTabs()
const { goBack } = useFormCreatePage('/planning/production-plan')

const periodLabel = FEED_PLAN_PERIOD_LABEL
const statusLabel = FEED_PLAN_STATUS_LABEL
const statusColor = FEED_PLAN_STATUS_COLOR
const periodTagColor = {
  [FEED_PLAN_PERIOD.MONTH]: 'green',
  [FEED_PLAN_PERIOD.WEEK]: 'cyan',
  [FEED_PLAN_PERIOD.DAY]: 'blue',
  [FEED_PLAN_PERIOD.CUSTOM]: 'purple',
}

const detailTab = ref('overview')
const logColumns = [
  { title: '操作时间', dataIndex: 'operatedAt', width: 170 },
  { title: '操作', dataIndex: 'action', width: 140 },
  { title: '操作人', dataIndex: 'operator', width: 120 },
  { title: '说明', dataIndex: 'remark' },
]
const plan = computed(() => getFeedPlan(route.params.id))
const operationLogs = computed(() =>
  (plan.value?.operationLogs || []).map((row) => ({
    ...row,
    remark: row.remark || '—',
  })),
)

watch(
  () => route.params.id,
  () => {
    detailTab.value = 'overview'
    resetChildSearch()
  },
)
const status = computed(() => (plan.value ? resolveFeedPlanStatus(plan.value.id) : ''))
const expectedAt = computed(() => (plan.value ? estimateExpectedExecuteAt(plan.value) : ''))
const formula = computed(() => (plan.value ? getFormula(plan.value.formulaId) : null))
const headerProduct = computed(() => {
  const itemId = plan.value?.itemId || formula.value?.itemId
  return itemId ? itemLabel(itemId) : ''
})
const materialIds = computed(() => mainRawMaterialIds(formula.value))
const unit = computed(() => (materialIds.value.length ? itemUnit(materialIds.value[0]) : 'kg'))
const actualQty = computed(() => (plan.value ? sumActualFeed(plan.value) : 0))
const rateText = computed(() => {
  if (!plan.value || !(Number(plan.value.targetQty) > 0)) return '—'
  return `${Math.round((actualQty.value / Number(plan.value.targetQty)) * 1000) / 10}%`
})
const parentPlan = computed(() => (plan.value?.parentId ? getFeedPlan(plan.value.parentId) : null))
const children = computed(() => (plan.value ? childPlans(plan.value.id) : []))

const canGenerate = computed(() => {
  if (!plan.value || children.value.length) return false
  void batchInstructionState.orders
  void plan.value.stopped
  void plan.value.targetQty
  return canGenerateFeedPlan(plan.value.id)
})
const canTerminate = computed(() => {
  if (!plan.value || plan.value.stopped) return false
  void batchInstructionState.orders
  return status.value !== FEED_PLAN_STATUS.DONE
})

const kpis = computed(() => {
  void shiftEnergyReportState.reports
  return plan.value ? buildFeedPlanKpis(plan.value) : null
})

function pctText(rate) {
  if (rate == null || !Number.isFinite(Number(rate))) return '—'
  return `${Math.round(Number(rate) * 1000) / 10}%`
}

function numText(val, decimals = 4) {
  if (val == null || !Number.isFinite(Number(val))) return '—'
  return formatQty(val, decimals)
}

const overviewCards = computed(() => {
  if (!plan.value || !kpis.value) return []
  const k = kpis.value
  return [
    {
      key: 'children',
      tone: 'teal',
      label: '子计划数',
      value: String(k.childCount),
      tip: '直接下级计划条数；无拆分时为 0。',
    },
    {
      key: 'exec',
      tone: 'amber',
      label: '执行中/已下达',
      value: `${k.runningCount}/${k.pendingCount}`,
      tip: '本计划及下级批次指令：执行中数 / 待下发数。',
    },
    {
      key: 'feed',
      tone: 'slate',
      label: '投料量',
      value: `${formatQty(k.feedQty)} / ${formatQty(k.targetQty)} ${unit.value}`,
      tip: '已投料量（主原料实投汇总）/ 计划投料量。',
    },
    {
      key: 'complete',
      tone: 'green',
      label: '计划完成率',
      value: pctText(k.completeRate),
      tip: '主原料实投 ÷ 计划投料量。',
    },
  ]
})

const processKpiCards = computed(() => {
  if (!plan.value || !kpis.value) return []
  const k = kpis.value
  return [
    {
      key: 'io',
      tone: 'teal',
      label: '投入产出比',
      value: numText(k.ioRatio, 4),
      tip: '主产出实收 ÷ 主原料实投。',
    },
    {
      key: 'output',
      tone: 'green',
      label: '主产出',
      value: `${formatQty(k.outputQty)} ${unit.value}`,
      tip: '批次指令主产品实收汇总。',
    },
    ...(k.sideOutputs || []).map((row) => ({
      key: `side-${row.role}-${row.itemId}`,
      tone: row.role === 'co' ? 'green' : 'slate',
      label: `${OUTPUT_ROLE_LABEL[row.role] || '联副产品'} · ${itemLabel(row.itemId)}`,
      value: `${formatQty(row.qty)} ${itemUnit(row.itemId)}`,
      tip:
        row.role === 'co'
          ? '联产品实收，按批次指令产出入库汇总。配方有定义但尚未入库时为 0。'
          : '副产品实收，按批次指令产出入库汇总。配方有定义但尚未入库时为 0。',
    })),
    {
      key: 'aux',
      tone: 'slate',
      label: '辅料实投',
      value: `${formatQty(k.auxQty)} ${unit.value}`,
      tip: '配方辅料及非主原料的实加量汇总。',
    },
    {
      key: 'auxUnit',
      tone: 'slate',
      label: '辅料单耗',
      value: numText(k.auxUnitConsume, 4),
      tip: '辅料实投 ÷ 主产出。尚无产出时为 —。',
    },
    {
      key: 'recovery',
      tone: 'teal',
      label: '主元素收率',
      value: pctText(k.recovery),
      tip: '（产出×含量）÷（投料×含量）。投料/产出缺含量时为 —。',
    },
    {
      key: 'yieldGap',
      tone: 'amber',
      label: '平均得率差',
      value: k.avgYieldGap == null ? '—' : `${formatQty(k.avgYieldGap)} ${unit.value}`,
      tip: '已完成批次：实际产出 − 理论产出，取平均。',
    },
    {
      key: 'wip',
      tone: 'amber',
      label: '在制批次',
      value: String(k.wipOrderCount),
      tip: '状态为执行中的批次指令数。',
    },
    {
      key: 'cycle',
      tone: 'slate',
      label: '平均完成周期',
      value: k.avgCycleHours == null ? '—' : `${k.avgCycleHours} h`,
      tip: '已完成批次从创建到完成的平均小时数。旧数据无完成时间时为 —。',
    },
    {
      key: 'energy',
      tone: 'teal',
      label: '能耗单耗',
      value:
        k.energyUnitConsume == null ? '—' : `${numText(k.energyUnitConsume, 4)} kWh/${unit.value}`,
      tip: '计划期间交班填报用电合计 ÷ 主原料实投。按班/车间汇总，不拆到批次。无填报或无投料时为 —。',
    },
    {
      key: 'grade',
      tone: 'green',
      label: '优级品率',
      value: '—',
      tip: '需产出批次等级/质检结果，一期未汇总到计划。',
    },
    {
      key: 'downtime',
      tone: 'rose',
      label: '故障停时',
      value: k.downtimeHours == null ? '—' : `${numText(k.downtimeHours, 2)} h`,
      tip: '计划期间交班填报的故障停时合计。无填报时为 —。',
    },
    {
      key: 'done',
      tone: 'green',
      label: '已完成批次',
      value: String(k.doneCount),
      tip: '本计划树下已完成的批次指令数。',
    },
  ]
})

function splitText(row) {
  if (row.periodType === FEED_PLAN_PERIOD.DAY || row.periodType === FEED_PLAN_PERIOD.CUSTOM) {
    return '不可再拆'
  }
  const key = row.splitTo || FEED_PLAN_SPLIT.NONE
  return FEED_PLAN_SPLIT_LABEL[key] || '不拆分'
}

function formatYieldRate(value) {
  const rate = Number(value)
  if (!Number.isFinite(rate) || rate < 0) return '—'
  return rate <= 1 ? `${Math.round(rate * 1000) / 10}%` : String(rate)
}

const compareColumns = [
  { title: '序号', dataIndex: 'seqNo', key: 'seq', width: 64, align: 'center' },
  { title: '计划号', dataIndex: 'planNo', key: 'planNo', width: 170 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '期间', dataIndex: 'periodText', key: 'period', width: 210 },
  { title: '执行情况', dataIndex: 'execText', key: 'exec', width: 130, align: 'center' },
  { title: '实投', dataIndex: 'feedText', key: 'feed', width: 130, align: 'right' },
  { title: '辅料实投', dataIndex: 'auxText', key: 'aux', width: 130, align: 'right' },
  { title: '辅料单耗', dataIndex: 'auxUnitText', key: 'auxUnit', width: 110, align: 'right' },
  { title: '完成率', dataIndex: 'rateText', key: 'rate', width: 100, align: 'right' },
  { title: '理论得率', dataIndex: 'yieldText', key: 'yield', width: 110, align: 'right' },
  { title: '理论产出', dataIndex: 'theoryText', key: 'theory', width: 140, align: 'right' },
  { title: '当前产出', dataIndex: 'outputText', key: 'output', width: 140, align: 'right' },
  { title: '平均完成周期', dataIndex: 'cycleText', key: 'cycle', width: 140, align: 'right' },
  { title: '主元素收率', dataIndex: 'recoveryText', key: 'recovery', width: 120, align: 'right' },
  { title: '平均得率差', dataIndex: 'gapText', key: 'gap', width: 130, align: 'right' },
]

const compareTips = {
  feed: '主原料实投。按该子计划期间统计；下级日计划的投料计入这一周。',
  aux: '配方辅料及非主原料的实加量。下级批次一并计入。',
  auxUnit: '辅料实投 ÷ 主产出。尚无产出时为 —。',
  rate: '主原料实投 ÷ 这张子计划自己的目标投料量。',
  yield: '配方理论得率。',
  theory: '这张子计划的目标投料量 × 理论得率。',
  output: '主产出实收。下级批次的产出计入这一周。',
  cycle: '已完成批次从创建到完成的平均小时数。下级已完成批次一并计入。',
  recovery: '（产出 × 含量）÷（投料 × 含量）。投料或产出缺含量时为 —。',
  gap: '已完成批次的实际产出减理论产出，取平均。下级已完成批次一并计入。',
}

function childOutputText(row, qty) {
  if (qty == null || !Number.isFinite(Number(qty))) return '—'
  const productUnit = row.itemId ? itemUnit(row.itemId) : unit.value
  return `${formatQty(qty)} ${productUnit}`
}

const compareRows = computed(() => {
  void feedPlanState.plans
  void batchInstructionState.orders
  void shiftEnergyReportState.reports
  return children.value
    .slice()
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
    .filter((row) => resolveFeedPlanStatus(row.id) !== FEED_PLAN_STATUS.OPEN)
    .map((row, index) => {
      const kpi = buildFeedPlanKpis(row)
      const formulaRow = getFormula(row.formulaId)
      const yieldRate = row.theoreticalYield ?? formulaRow?.theoreticalYield
      return {
        id: row.id,
        seqNo: String(index + 1),
        planNo: row.planNo,
        status: resolveFeedPlanStatus(row.id),
        periodText: row.periodLabel || '—',
        execText: execProgressText(row.id),
        feedText: `${formatQty(kpi?.feedQty || 0)} ${unit.value}`,
        auxText: `${formatQty(kpi?.auxQty || 0)} ${unit.value}`,
        auxUnitText: kpi?.auxUnitConsume == null ? '—' : numText(kpi.auxUnitConsume, 4),
        rateText: pctText(kpi?.completeRate),
        yieldText: formatYieldRate(yieldRate),
        theoryText: childOutputText(
          row,
          row.theoreticalOutput == null || row.theoreticalOutput === ''
            ? Number.isFinite(Number(yieldRate))
              ? theoreticalOutput(row.targetQty, yieldRate)
              : null
            : Number(row.theoreticalOutput),
        ),
        outputText: childOutputText(row, kpi?.outputQty || 0),
        cycleText: kpi?.avgCycleHours == null ? '—' : `${kpi.avgCycleHours} h`,
        recoveryText: pctText(kpi?.recovery),
        gapText: kpi?.avgYieldGap == null ? '—' : childOutputText(row, kpi.avgYieldGap),
      }
    })
})

function formatTheoreticalOutput(row) {
  if (!row || !(Number(row.targetQty) > 0)) return '—'
  const yieldRate = row.theoreticalYield ?? formula.value?.theoreticalYield
  if (!Number.isFinite(Number(yieldRate))) return '—'
  const qty =
    row.theoreticalOutput == null || row.theoreticalOutput === ''
      ? theoreticalOutput(row.targetQty, yieldRate)
      : Number(row.theoreticalOutput)
  if (!Number.isFinite(qty)) return '—'
  const productUnit = row.itemId ? itemUnit(row.itemId) : unit.value
  return `${formatQty(qty)} ${productUnit}`
}

const basicFields = computed(() => {
  if (!plan.value) return []
  return [
    { label: '计划名称', value: plan.value.planName || '—' },
    { label: '期间', value: plan.value.periodLabel || '—' },
    { label: '产线', value: formatPlanLineLabel(plan.value.productionLineId) },
    { label: '计划来源', value: FEED_PLAN_SOURCE_LABEL[plan.value.source] || '—' },
    { label: '来源单号', value: plan.value.sourceRef || '—' },
    { label: '主产品', value: itemLabel(plan.value.itemId) },
    {
      label: '配方',
      value: formula.value
        ? `${formula.value.formulaNo || ''} ${formula.value.name || ''}`.trim()
        : '—',
    },
    {
      label: '主原料',
      value: materialIds.value.map((id) => itemLabel(id)).join('、') || '—',
    },
    {
      label: '目标投料量',
      value: `${formatQty(plan.value.targetQty)} ${unit.value}`,
    },
    {
      label: '理论得率',
      value: formatYieldRate(plan.value.theoreticalYield ?? formula.value?.theoreticalYield),
    },
    {
      label: '理论产出',
      value: formatTheoreticalOutput(plan.value),
    },
    { label: '实投', value: `${formatQty(actualQty.value)} ${unit.value}` },
    { label: '完成率', value: rateText.value },
    { label: '拆分', value: splitText(plan.value) },
    {
      label: '上级计划',
      value: parentPlan.value
        ? `${parentPlan.value.planNo || ''} ${parentPlan.value.periodLabel || ''}`.trim()
        : '—',
    },
    { label: '备注', value: plan.value.remark || '—' },
  ]
})

const sourceOptions = FEED_PLAN_SOURCE_OPTIONS

const treeColumns = [
  { title: '序号', key: 'seq', width: 72, align: 'center' },
  { title: '状态', key: 'status', width: 100 },
  { title: '计划号 / 批次号', key: 'no', width: 220 },
  { title: '目标投料量', key: 'targetQty', width: 140, align: 'right' },
  { title: '实投', key: 'actualQty', width: 120, align: 'right' },
  { title: '执行情况', key: 'execProgress', width: 130, align: 'center' },
  { title: '计划开启时间', key: 'openedAt', width: 160 },
  { title: '预计开启时间', key: 'expectedAt', width: 160 },
  { title: '期间', key: 'period', width: 200 },
  { title: '操作', key: 'action', width: 240 },
]

const execProgressTip =
  '执行中的批次指令数 / 待下发的批次指令数 / 批次指令总数。已作废不计入。子计划还有下级时，按下级的批次指令合计。'
compareTips.exec = execProgressTip

const orderColumns = [
  { title: '批次号', key: 'batchNo', width: 180 },
  { title: '状态', key: 'status', width: 100 },
  { title: '计划投料量', key: 'qty', width: 140, align: 'right' },
  { title: '创建时间', dataIndex: 'createdAt', width: 160 },
]

function orderQtyText(order) {
  if (order.qtyConfirmed === false || order.qty == null || order.qty === '') return '待确认'
  return `${order.qty} ${order.unit || unit.value || ''}`.trim()
}

function orderActualText(order) {
  const ids = new Set(mainRawMaterialIds(getFormula(order.formulaId)))
  const sum = (order.feeds || []).reduce((total, feed) => {
    if (ids.size && !ids.has(feed.itemId)) return total
    return total + (Number(feed.qty) || 0)
  }, 0)
  return `${formatQty(sum)} ${order.unit || unit.value || ''}`.trim()
}

function execProgressText(planId) {
  const stats = { running: 0, pending: 0, total: 0 }
  const walk = (id) => {
    listOrdersByFeedPlan(id).forEach((order) => {
      if (order.status === 'cancelled') return
      stats.total += 1
      if (order.status === 'running') stats.running += 1
      else if (order.status === 'pending_release') stats.pending += 1
    })
    childPlans(id).forEach((row) => walk(row.id))
  }
  walk(planId)
  return `${stats.running}/${stats.pending}/${stats.total}`
}

function buildPlanNode(planRow, seqNo) {
  const nested = childPlans(planRow.id)
    .slice()
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
    .map((row, index) => buildPlanNode(row, `${seqNo}.${index + 1}`))
  const batches = listOrdersByFeedPlan(planRow.id)
    .slice()
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .map((order) => ({
      kind: 'batch',
      id: `batch-${order.id}`,
      orderId: order.id,
      batchNo: order.batchNo,
      status: order.status,
      seqNo: '—',
      targetText: orderQtyText(order),
      actualText: orderActualText(order),
      execText: '—',
      openedAt: '—',
      expectedAt: '—',
      periodText: '—',
    }))
  const childrenNodes = [...nested, ...batches]
  return {
    kind: 'plan',
    id: planRow.id,
    seqNo,
    planNo: planRow.planNo,
    periodType: planRow.periodType,
    periodLabel: planRow.periodLabel,
    start: planRow.start,
    end: planRow.end,
    formulaId: planRow.formulaId,
    productionLineId: planRow.productionLineId,
    parentId: planRow.parentId,
    splitTo: planRow.splitTo,
    source: planRow.source,
    sourceRef: planRow.sourceRef,
    planName: planRow.planName,
    remark: planRow.remark,
    targetQty: planRow.targetQty,
    stopped: planRow.stopped,
    status: resolveFeedPlanStatus(planRow.id),
    targetText: `${formatQty(planRow.targetQty)} ${unit.value}`,
    actualText: `${formatQty(sumActualFeed(planRow))} ${unit.value}`,
    execText: execProgressText(planRow.id),
    openedAt: planRow.executedAt || '—',
    expectedAt: estimateExpectedExecuteAt(planRow) || '—',
    periodText: planRow.periodLabel || '—',
    children: childrenNodes.length ? childrenNodes : undefined,
  }
}

const planTree = computed(() => {
  void feedPlanState.plans
  void batchInstructionState.orders
  return children.value
    .slice()
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
    .map((row, index) => buildPlanNode(row, String(index + 1)))
})

const childQuery = reactive({ keyword: '', status: undefined, period: undefined })
const appliedChild = reactive({ keyword: '', status: undefined, period: undefined })
const childFiltering = computed(() =>
  Boolean(appliedChild.keyword || appliedChild.status || appliedChild.period),
)

function nodeStatusValue(node) {
  return `${node.kind}:${node.status}`
}

function childNodeHit(node, parentPeriod, ignoreKeyword) {
  const keyword = appliedChild.keyword.trim().toLowerCase()
  const no = String(node.planNo || node.batchNo || '').toLowerCase()
  if (!ignoreKeyword && keyword && !no.includes(keyword)) return false
  if (appliedChild.status && nodeStatusValue(node) !== appliedChild.status) return false
  if (appliedChild.period) {
    const period = node.kind === 'plan' ? node.periodText : parentPeriod
    if (period !== appliedChild.period) return false
  }
  return true
}

function filterPlanNodes(nodes, parentPeriod, ignoreKeyword) {
  const result = []
  nodes.forEach((node) => {
    const period = node.kind === 'plan' ? node.periodText : parentPeriod
    const self = childNodeHit(node, parentPeriod, ignoreKeyword)
    const kids = filterPlanNodes(node.children || [], period, self || ignoreKeyword)
    if (!self && !kids.length) return
    result.push({ ...node, children: kids.length ? kids : undefined })
  })
  return result
}

const filteredPlanTree = computed(() => {
  if (!childFiltering.value) return planTree.value
  return filterPlanNodes(planTree.value, '', false)
})

const childSectionTitle = computed(() =>
  childFiltering.value
    ? `子计划 (${filteredPlanTree.value.length}/${planTree.value.length})`
    : `子计划 (${planTree.value.length})`,
)

const childStatusOptions = computed(() => {
  const seen = new Set()
  const options = []
  const walk = (nodes) => {
    nodes.forEach((node) => {
      const value = nodeStatusValue(node)
      if (!seen.has(value)) {
        seen.add(value)
        const label =
          node.kind === 'plan'
            ? statusLabel[node.status] || node.status
            : ORDER_STATUS_LABEL[node.status] || node.status
        options.push({
          value,
          label: node.kind === 'plan' ? `计划·${label}` : `批次·${label}`,
        })
      }
      walk(node.children || [])
    })
  }
  walk(planTree.value)
  return options
})

const childPeriodOptions = computed(() => {
  const seen = []
  const walk = (nodes) => {
    nodes.forEach((node) => {
      if (
        node.kind === 'plan' &&
        node.periodText &&
        node.periodText !== '—' &&
        !seen.includes(node.periodText)
      ) {
        seen.push(node.periodText)
      }
      walk(node.children || [])
    })
  }
  walk(planTree.value)
  return seen.map((value) => ({ value, label: value }))
})

function applyChildSearch() {
  appliedChild.keyword = childQuery.keyword.trim()
  appliedChild.status = childQuery.status
  appliedChild.period = childQuery.period
  expandedRowKeys.value = collectExpandableIds(filteredPlanTree.value)
}

function resetChildSearch() {
  childQuery.keyword = ''
  childQuery.status = undefined
  childQuery.period = undefined
  appliedChild.keyword = ''
  appliedChild.status = undefined
  appliedChild.period = undefined
}

const ownOrderRows = computed(() => {
  if (!plan.value) return []
  void batchInstructionState.orders
  return listOrdersByFeedPlan(plan.value.id)
    .slice()
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
})

const expandedRowKeys = ref([])
const seenTreeIds = new Set()
let treePlanId = ''

function collectExpandableIds(nodes, bag = []) {
  nodes.forEach((node) => {
    if (node.children?.length) {
      bag.push(node.id)
      collectExpandableIds(node.children, bag)
    }
  })
  return bag
}

watch(
  planTree,
  (rows) => {
    const currentId = String(route.params.id || '')
    if (treePlanId !== currentId) {
      treePlanId = currentId
      seenTreeIds.clear()
      expandedRowKeys.value = []
    }
    const ids = collectExpandableIds(rows)
    const next = new Set(expandedRowKeys.value)
    ids.forEach((id) => {
      if (!seenTreeIds.has(id)) next.add(id)
      seenTreeIds.add(id)
    })
    expandedRowKeys.value = [...next]
  },
  { immediate: true },
)

function onExpandTree(expanded, record) {
  if (expanded) {
    if (!expandedRowKeys.value.includes(record.id)) {
      expandedRowKeys.value = [...expandedRowKeys.value, record.id]
    }
    return
  }
  expandedRowKeys.value = expandedRowKeys.value.filter((key) => key !== record.id)
}

function canGenerateRow(record) {
  return record.kind === 'plan' && canGenerateFeedPlan(record.id)
}

function canEditRow(record) {
  return record.kind === 'plan' && record.status === FEED_PLAN_STATUS.OPEN
}

function canTerminateRow(record) {
  return record.kind === 'plan' && !record.stopped && record.status !== FEED_PLAN_STATUS.DONE
}

function hasPlanAction(record) {
  return canGenerateRow(record) || canEditRow(record) || canTerminateRow(record)
}

const generateOpen = ref(false)
const generatePlanId = ref('')
const editOpen = ref(false)
const editForm = reactive({
  id: '',
  planNo: '',
  periodLabel: '',
  planName: '',
  targetQty: undefined,
  source: undefined,
  sourceRef: '',
  remark: '',
})

function batchStatusColor(s) {
  if (s === 'done') return 'success'
  if (s === 'running') return 'processing'
  if (s === 'cancelled') return 'default'
  return 'warning'
}

function goPlanDetail(record) {
  const path = `/planning/production-plan/${record.id}`
  openTab(path, record.planNo || '生产计划详情')
  router.push(path)
}

function goBatchDetail(record) {
  const path = `/production/work-orders/${record.orderId || record.id}`
  openTab(path, record.batchNo || '批次指令')
  router.push(path)
}

function openGenerate(planId) {
  generatePlanId.value = planId
  generateOpen.value = true
}

function handleExecute() {
  openGenerate(plan.value.id)
}

function openEdit(record) {
  const row = getFeedPlan(record.id)
  if (!row) return
  editForm.id = row.id
  editForm.planNo = row.planNo || ''
  editForm.periodLabel = row.periodLabel || ''
  editForm.planName = row.planName || ''
  editForm.targetQty = row.targetQty
  editForm.source = row.source
  editForm.sourceRef = row.sourceRef || ''
  editForm.remark = row.remark || ''
  editOpen.value = true
}

function handleEditSave() {
  const row = getFeedPlan(editForm.id)
  if (!row) return
  try {
    saveFeedPlan(
      {
        periodType: row.periodType,
        date: row.start,
        range: [row.start, row.end],
        planNo: row.planNo,
        planName: editForm.planName,
        formulaId: row.formulaId,
        productionLineId: row.productionLineId,
        targetQty: editForm.targetQty,
        parentId: row.parentId,
        source: editForm.source,
        sourceRef: editForm.sourceRef,
        splitTo: row.splitTo,
        remark: editForm.remark,
      },
      row.id,
    )
  } catch (error) {
    message.warning(error.message || '保存失败')
    return
  }
  message.success('保存成功')
  editOpen.value = false
}

function handleTerminateRow(record) {
  const nested = record.children?.some((row) => row.kind === 'plan')
  Modal.confirm({
    title: '终止计划',
    content: nested
      ? `终止「${record.planNo || record.periodLabel}」？未完成的下级计划一并终止。待下发的批次指令会作废，执行中和已完成的批次保持不动。终止后状态为已终止。`
      : `终止「${record.planNo || record.periodLabel}」？待下发的批次指令会作废，执行中和已完成的批次保持不动。终止后状态为已终止。`,
    okText: '终止',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      const count = stopFeedPlanOrders(record.id)
      message.success(count ? `已终止，并作废 ${count} 张待下发批次` : '已终止')
    },
  })
}

function handleStop() {
  Modal.confirm({
    title: '终止计划',
    content: children.value.length
      ? `终止「${plan.value.periodLabel}」？未完成的下级计划一并终止。待下发的批次指令会作废，执行中和已完成的批次保持不动。终止后状态为已终止。`
      : `终止「${plan.value.periodLabel}」？待下发的批次指令会作废，执行中和已完成的批次保持不动。终止后状态为已终止。`,
    okText: '终止',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      const count = stopFeedPlanOrders(plan.value.id)
      message.success(count ? `已终止，并作废 ${count} 张待下发批次` : '已终止')
    },
  })
}
</script>

<style scoped>
.feed-plan-detail-page {
  margin: -12px;
  padding: 12px;
  background: var(--page-bg, #f0f2f5);
  min-height: calc(100% + 24px);
}

.detail-page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #fff;
  padding: 8px 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
}

.head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.order-no {
  font-size: 20px;
  font-weight: 600;
  color: #1f2329;
}

.product-title {
  font-size: 14px;
  line-height: 22px;
  color: #4e5969;
}

.head-actions {
  flex-shrink: 0;
}

.feed-plan-detail-page .plan-detail-tabs.detail-tabs-wrap {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  margin-bottom: 8px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.feed-plan-detail-page .plan-detail-tabs :deep(.ant-tabs) {
  width: 100%;
}

.feed-plan-detail-page .plan-detail-tabs :deep(.ant-tabs-nav) {
  margin: 0 !important;
}

.feed-plan-detail-page :deep(.detail-section-card) {
  margin-bottom: 0;
}

.detail-overview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compare-card {
  padding: 12px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.compare-hint {
  margin-bottom: 8px;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.overview-cards--kpi {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

@media (max-width: 1200px) {
  .overview-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .overview-cards--kpi {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .overview-cards--kpi {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.overview-card {
  padding: 12px 14px;
  background: #f7f8fa;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  min-height: 72px;
}

.overview-card.is-teal {
  background: #f3f8f7;
  border-color: #e1eeeb;
}

.overview-card.is-green {
  background: #f5faf3;
  border-color: #e4f0df;
}

.overview-card.is-amber {
  background: #fbf8f2;
  border-color: #f1eadc;
}

.overview-card.is-slate {
  background: #f5f7fa;
  border-color: #e6ebf0;
}

.overview-card.is-rose {
  background: #fbf6f5;
  border-color: #f1e6e4;
}

.overview-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

.overview-tip {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
  cursor: help;
}

.overview-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
  color: #1f2329;
  word-break: break-all;
}

.stage-name {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: #1f2329;
}

.stage-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 22px;
  color: #4e5969;
}

.stage-extra {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: #86909c;
}

.child-filter {
  margin-bottom: 8px;
}

.child-filter-actions {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.th-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.th-tip-icon {
  color: #86909c;
  font-size: 12px;
  cursor: help;
}

.meta-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #e8e8e8;
}

.meta-bar i {
  margin-right: 6px;
  font-style: normal;
  font-size: 13px;
  color: rgba(78, 89, 105, 0.55);
}

.meta-bar b {
  font-weight: 400;
  font-size: 14px;
  color: #1f2329;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  column-gap: 20px;
  row-gap: 10px;
}

@media (max-width: 1200px) {
  .info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.info-item {
  display: flex;
  min-width: 0;
}

.field-label {
  flex: 0 0 auto;
  color: #4e5969;
  font-size: 14px;
  line-height: 22px;
  white-space: nowrap;
}

.field-value {
  min-width: 0;
  color: #1f2329;
  font-size: 14px;
  line-height: 22px;
  word-break: break-all;
}

.link {
  color: var(--primary, #307068);
  cursor: pointer;
}

.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.split-hint {
  margin-top: 8px;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
}
</style>
