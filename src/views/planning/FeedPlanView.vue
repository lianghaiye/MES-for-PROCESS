<template>
  <div class="list-page feed-plan-page">
    <ListPeriodStatsPanel
      v-model:period="statPeriod"
      :cards="planStatCards"
      :period-options="statPeriodOptions"
      storage-key="i_doms_feed_plan_stats_collapsed"
    />

    <div class="filter-card">
      <a-form layout="inline" class="filter-form horizontal-form">
        <ListFilterBar :field-count="9" @search="applySearch" @reset="resetSearch">
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
              placeholder="请输入计划号"
            />
          </a-form-item>
          <a-form-item label="主产品">
            <a-input
              v-model:value="filters.product"
              allow-clear
              size="small"
              placeholder="编码 / 名称"
            />
          </a-form-item>
          <a-form-item label="主原料">
            <a-input
              v-model:value="filters.material"
              allow-clear
              size="small"
              placeholder="编码 / 名称"
            />
          </a-form-item>
          <a-form-item label="批次">
            <a-select
              v-model:value="filters.batchStatus"
              allow-clear
              size="small"
              placeholder="全部"
              :options="batchStatusOptions"
            />
          </a-form-item>
          <a-form-item label="期间类型">
            <a-select
              v-model:value="filters.periodType"
              allow-clear
              size="small"
              placeholder="全部"
              :options="periodOptions"
            />
          </a-form-item>
          <a-form-item label="批次号">
            <a-input
              v-model:value="filters.batchNo"
              allow-clear
              size="small"
              placeholder="请输入批次号"
            />
          </a-form-item>
          <a-form-item label="创建人">
            <a-input
              v-model:value="filters.createdBy"
              allow-clear
              size="small"
              placeholder="请输入创建人"
            />
          </a-form-item>
          <a-form-item label="创建时间">
            <a-range-picker v-model:value="filters.createdRange" size="small" style="width: 100%" />
          </a-form-item>
        </ListFilterBar>
      </a-form>
    </div>

    <div class="toolbar-row">
      <a-space>
        <a-button type="primary" size="small" @click="openCreate">新增</a-button>
        <a-button
          size="small"
          danger
          :disabled="!terminableSelection.length"
          @click="handleTerminateSelected"
        >
          终止计划
        </a-button>
        <a-button size="small" @click="openAutoSettings">自动下发设置</a-button>
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

    <div class="table-card">
      <a-tabs v-model:activeKey="statusTab" size="small" class="plan-status-tabs">
        <a-tab-pane v-for="tab in statusTabs" :key="tab.value" :tab="tab.label" />
      </a-tabs>
      <a-table
        :columns="displayColumns"
        :data-source="treeRows"
        row-key="id"
        size="small"
        :pagination="{
          pageSize: 20,
          size: 'small',
          showSizeChanger: true,
          showTotal: (n) => `共 ${n} 条`,
        }"
        :scroll="{ x: tableScrollX + 48 }"
        :expanded-row-keys="expandedRowKeys"
        :row-selection="rowSelection"
        :row-class-name="rowClassName"
        @expand="onExpand"
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
          <template v-if="column.key === 'index'">
            <span class="seq-no">{{ record.seqNo }}</span>
          </template>
          <template v-else-if="column.key === 'planNo'">
            <a class="plan-no-link" @click="goDetail(record)">{{ record.planNo || '—' }}</a>
          </template>
          <template v-else-if="column.key === 'periodType'">
            <a-tag :color="periodTagColor[record.periodType] || 'default'">
              {{ periodLabel[record.periodType] || '—' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor[record.status] || 'default'">
              {{ statusLabel[record.status] || '—' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'execProgress'">{{
            record.execProgressText
          }}</template>
          <template v-else-if="column.key === 'source'">
            {{ sourceLabel[record.source] || '—' }}
          </template>
          <template v-else-if="column.key === 'workCenter'">
            {{ record.workCenterText || '—' }}
          </template>
          <template v-else-if="column.key === 'sourceRef'">{{ record.sourceRef || '—' }}</template>
          <template v-else-if="column.key === 'splitTo'">{{ splitText(record) }}</template>
          <template v-else-if="column.key === 'targetQty'">
            {{ formatQty(record.targetQty) }} {{ record.unit }}
          </template>
          <template v-else-if="column.key === 'actualQty'">
            {{ formatQty(record.actualQty) }} {{ record.unit }}
          </template>
          <template v-else-if="column.key === 'rate'">{{ record.rateText }}</template>
          <template v-else-if="column.key === 'orders'">{{ record.orderText }}</template>
          <template v-else-if="column.key === 'executedAt'">{{
            record.executedAt || '—'
          }}</template>
          <template v-else-if="column.key === 'expectedAt'">{{
            record.expectedAt || '—'
          }}</template>
          <template v-else-if="column.key === 'createdBy'">{{ record.createdBy || '—' }}</template>
          <template v-else-if="column.key === 'createdAt'">{{ record.createdAt || '—' }}</template>
          <template v-else-if="column.key === 'remark'">{{ record.remark || '—' }}</template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="canSplit(record)" type="link" size="small" @click="openSplit(record)">
              拆分子计划
            </a-button>
            <a-button
              v-if="canGenerate(record)"
              type="link"
              size="small"
              @click="handleExecute(record)"
            >
              生成批次指令
            </a-button>
            <a-dropdown v-if="hasRowMore(record)" :trigger="['click']">
              <a-button type="link" size="small">
                更多
                <DownOutlined />
              </a-button>
              <template #overlay>
                <a-menu @click="({ key }) => onRowMore(key, record)">
                  <a-menu-item v-if="canEdit(record)" key="edit">编辑</a-menu-item>
                  <a-menu-item v-if="record.deletable" key="delete" danger>删除</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </template>
        </template>
      </a-table>
    </div>

    <a-modal
      :open="modalOpen"
      :title="editingId ? '编辑生产计划' : '新增生产计划'"
      :width="1080"
      :mask-closable="false"
      destroy-on-close
      @cancel="closeModal"
    >
      <div class="modal-basic-card">
        <div class="section-title">基本信息</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="8">
              <a-form-item label="计划编号">
                <a-input
                  v-model:value="form.planNo"
                  size="small"
                  allow-clear
                  placeholder="不填则按系统规则生成"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="计划名称">
                <a-input
                  :value="form.planName"
                  size="small"
                  allow-clear
                  placeholder="默认：期间+期间类型+计划"
                  @update:value="onPlanNameInput"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="期间类型" required>
                <a-select
                  v-model:value="form.periodType"
                  size="small"
                  :options="periodOptions"
                  :disabled="Boolean(editingId)"
                  @change="onPeriodTypeChange"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="期间" required>
                <a-range-picker
                  v-if="form.periodType === 'custom'"
                  v-model:value="form.range"
                  size="small"
                  style="width: 100%"
                  @change="onPlanDateChange"
                />
                <a-date-picker
                  v-else
                  v-model:value="form.date"
                  size="small"
                  style="width: 100%"
                  :picker="pickerMode"
                  @change="onPlanDateChange"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="主产品" required>
                <MasterItemSelect
                  v-model="form.itemId"
                  modal-title="选择主产品"
                  placeholder="输入编码或名称"
                  @change="onProductChange"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="配方" required>
                <FeedPlanSearchSelect
                  v-model="form.formulaId"
                  title="选择配方"
                  :placeholder="form.itemId ? '输入编号或名称' : '先选主产品'"
                  :options="formulaOptions"
                  :disabled="!form.itemId"
                  @change="form.parentId = undefined"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="工作中心">
                <a-select
                  v-model:value="form.workCenterId"
                  size="small"
                  allow-clear
                  show-search
                  option-filter-prop="label"
                  placeholder="可不选"
                  :options="workCenterOptions"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="目标投料量" required>
                <a-input-number
                  v-model:value="form.targetQty"
                  size="small"
                  :min="0"
                  :precision="3"
                  style="width: 100%"
                  :placeholder="`手工填写，单位 ${feedUnit}`"
                />
              </a-form-item>
            </a-col>
            <a-col
              v-if="!editingId && form.periodType !== 'day' && form.periodType !== 'custom'"
              :span="8"
            >
              <a-form-item label="拆分子计划">
                <a-select
                  v-model:value="form.splitTo"
                  size="small"
                  :options="splitOptionsForCreate"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <div class="plan-metric-bar">
                <div class="plan-metric-item">
                  <div class="plan-metric-label">主原料</div>
                  <div class="plan-metric-value">{{ selectedMaterials }}</div>
                </div>
                <div class="plan-metric-item">
                  <div class="plan-metric-label">理论得率</div>
                  <div class="plan-metric-value">{{ theoreticalYieldText }}</div>
                </div>
                <div class="plan-metric-item">
                  <div class="plan-metric-label">理论产出</div>
                  <div class="plan-metric-value accent">{{ theoreticalOutputText }}</div>
                </div>
              </div>
            </a-col>
            <a-col :span="8">
              <a-form-item label="上级计划">
                <a-select
                  v-model:value="form.parentId"
                  size="small"
                  allow-clear
                  placeholder="可不选"
                  :options="parentOptions"
                  :disabled="!parentType"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="计划来源" required>
                <a-select
                  v-model:value="form.source"
                  size="small"
                  :options="sourceOptions"
                  placeholder="请选择"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="来源单号">
                <a-input
                  v-model:value="form.sourceRef"
                  size="small"
                  allow-clear
                  placeholder="订单号 / 补货单号等，可空"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="备注" class="remark-item">
                <a-textarea v-model:value="form.remark" :rows="2" size="small" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </div>
      <template #footer>
        <a-button @click="closeModal">取消</a-button>
        <a-button type="primary" @click="handleSave">保存</a-button>
      </template>
    </a-modal>

    <a-modal
      :open="splitOpen"
      title="拆分子计划"
      :width="520"
      :mask-closable="false"
      destroy-on-close
      @cancel="splitOpen = false"
    >
      <div class="modal-basic-card">
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="24">
              <a-form-item label="当前计划">
                <a-input :value="splitTargetLabel" size="small" disabled />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="拆成" required>
                <a-select v-model:value="splitTo" size="small" :options="splitOptionsForRow" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <div class="split-hint">目标量均分到下级，拆完可改。下级之和不必等于上级。</div>
      </div>
      <template #footer>
        <a-button @click="splitOpen = false">取消</a-button>
        <a-button type="primary" @click="handleSplit">确定</a-button>
      </template>
    </a-modal>

    <GeneratePlanBatchModal
      :open="generateOpen"
      :plan-id="generatePlanId"
      @cancel="generateOpen = false"
      @done="onPlanBatchesDone"
    />

    <a-modal
      :open="autoOpen"
      title="自动下发设置"
      :width="560"
      :mask-closable="false"
      destroy-on-close
      @cancel="autoOpen = false"
    >
      <div class="modal-basic-card">
        <div class="section-title">规则</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="12">
              <a-form-item label="启用">
                <a-switch v-model:checked="autoForm.enabled" size="small" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="执行时刻">
                <a-input-number
                  v-model:value="autoForm.runAtHour"
                  size="small"
                  :min="0"
                  :max="23"
                  style="width: 100%"
                  addon-after="点"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="下发方式" required>
                <a-select v-model:value="autoForm.mode" size="small" :options="autoModeOptions" />
              </a-form-item>
            </a-col>
            <a-col v-if="autoForm.mode !== 'next_day'" :span="12">
              <a-form-item label="天数" required>
                <a-input-number
                  v-model:value="autoForm.days"
                  size="small"
                  :min="1"
                  :max="31"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="向上取整">
                <a-switch v-model:checked="autoForm.ceilBatch" size="small" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <div class="split-hint">
          关闭时，不足一个基准批量的余数单独成一张。开启后，这张按基准批量补满。剩余 250
          kg、基准批量 100 kg 时，关闭为 100、100、50，开启为 100、100、100。
        </div>
      </div>
      <template #footer>
        <a-button @click="autoOpen = false">取消</a-button>
        <a-button @click="handleAutoRunNow">立即按规则补发</a-button>
        <a-button type="primary" @click="handleSaveAuto">保存</a-button>
      </template>
    </a-modal>

    <TableColumnSettingDrawer
      v-model:open="columnDrawerOpen"
      v-model:settings="columnSettings"
      :default-settings="defaultColumnSettings"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { DownOutlined, QuestionCircleOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { useRouter } from 'vue-router'
import FeedPlanSearchSelect from '@/views/planning/components/FeedPlanSearchSelect.vue'
import GeneratePlanBatchModal from '@/views/planning/components/GeneratePlanBatchModal.vue'
import MasterItemSelect from '@/views/product-process/components/MasterItemSelect.vue'
import ListFilterBar from '@/components/ListFilterBar.vue'
import ListPeriodStatsPanel from '@/components/ListPeriodStatsPanel.vue'
import TableColumnSettingDrawer from '@/components/TableColumnSettingDrawer.vue'
import TableColumnSettingButton from '@/components/TableColumnSettingButton.vue'
import { useTableColumnSettings } from '@/composables/useTableColumnSettings'
import { getFormula, itemLabel, itemUnit, listFormulas } from '@/store/processFormulaStore'
import { theoreticalOutput } from '@/utils/processBatchMath'
import {
  childPlans,
  canGenerateFeedPlan,
  deleteFeedPlan,
  estimateExpectedExecuteAt,
  FEED_PLAN_AUTO_MODE_OPTIONS,
  FEED_PLAN_STATUS,
  FEED_PLAN_STATUS_COLOR,
  FEED_PLAN_STATUS_LABEL,
  feedPlanState,
  mainRawMaterialIds,
  resolveFeedPlanStatus,
  runAutoReleaseFeedPlans,
  saveAutoReleaseSettings,
  saveFeedPlan,
  splitFeedPlan,
  stopFeedPlanOrders,
  sumActualFeed,
} from '@/store/feedPlanStore'
import {
  batchInstructionState,
  listOrdersByFeedPlan,
  ORDER_STATUS_LABEL,
} from '@/store/batchInstructionStore'
import {
  formatWorkCenterLabel,
  listEnabledWorkCenters,
  workCenterState,
} from '@/store/workCenterStore'
import {
  buildFeedPlanPeriod,
  FEED_PLAN_PERIOD,
  FEED_PLAN_PERIOD_LABEL,
  defaultPlanName,
  FEED_PLAN_PERIOD_OPTIONS,
  FEED_PLAN_SOURCE,
  FEED_PLAN_SOURCE_LABEL,
  FEED_PLAN_SOURCE_OPTIONS,
  FEED_PLAN_SPLIT,
  FEED_PLAN_SPLIT_LABEL,
  FEED_PLAN_SPLIT_OPTIONS,
  parentPeriodType,
  periodCovers,
} from '@/utils/feedPlanPeriod'
import { formatQty, formatQtyWithUnit } from '@/utils/numberFormat'
import { useTabs } from '@/composables/useTabs'

dayjs.extend(isoWeek)

const router = useRouter()
const { openTab } = useTabs()

const periodOptions = FEED_PLAN_PERIOD_OPTIONS
const periodLabel = FEED_PLAN_PERIOD_LABEL
const sourceOptions = FEED_PLAN_SOURCE_OPTIONS
const sourceLabel = FEED_PLAN_SOURCE_LABEL
const splitLabel = FEED_PLAN_SPLIT_LABEL
const statusLabel = FEED_PLAN_STATUS_LABEL
const statusColor = FEED_PLAN_STATUS_COLOR
const autoModeOptions = FEED_PLAN_AUTO_MODE_OPTIONS
const periodTagColor = {
  [FEED_PLAN_PERIOD.MONTH]: 'green',
  [FEED_PLAN_PERIOD.WEEK]: 'cyan',
  [FEED_PLAN_PERIOD.DAY]: 'blue',
  [FEED_PLAN_PERIOD.CUSTOM]: 'purple',
}

const baseColumns = [
  { title: '序号', key: 'index', dataIndex: 'seqNo', width: 72, fixed: 'left' },
  { title: '状态', key: 'status', dataIndex: 'status', width: 90, fixed: 'left' },
  { title: '计划号', key: 'planNo', dataIndex: 'planNo', width: 160, fixed: 'left' },
  { title: '计划名称', key: 'planName', dataIndex: 'planName', width: 180, ellipsis: true },
  { title: '期间类型', key: 'periodType', dataIndex: 'periodType', width: 100 },
  { title: '期间', key: 'periodLabel', dataIndex: 'periodLabel', width: 200 },
  { title: '执行情况', key: 'execProgress', dataIndex: 'execProgressText', width: 130 },
  {
    title: '工作中心',
    key: 'workCenter',
    dataIndex: 'workCenterText',
    width: 150,
    ellipsis: true,
  },
  { title: '主产品', key: 'product', dataIndex: 'product', width: 160, ellipsis: true },
  { title: '配方', key: 'formula', dataIndex: 'formula', width: 160, ellipsis: true },
  { title: '主原料', key: 'materials', dataIndex: 'materials', width: 160, ellipsis: true },
  { title: '拆分子计划', key: 'splitTo', dataIndex: 'splitTo', width: 120 },
  { title: '目标投料量', key: 'targetQty', dataIndex: 'targetQty', width: 120, align: 'right' },
  { title: '实投', key: 'actualQty', dataIndex: 'actualQty', width: 100, align: 'right' },
  { title: '完成率', key: 'rate', dataIndex: 'rate', width: 90, align: 'right' },
  { title: '批次号', key: 'orders', dataIndex: 'orders', width: 180, ellipsis: true },
  { title: '执行开启时间', key: 'executedAt', dataIndex: 'executedAt', width: 140 },
  { title: '预计开启时间', key: 'expectedAt', dataIndex: 'expectedAt', width: 140 },
  { title: '计划来源', key: 'source', dataIndex: 'source', width: 110 },
  { title: '来源单号', key: 'sourceRef', dataIndex: 'sourceRef', width: 140, ellipsis: true },
  { title: '创建人', key: 'createdBy', dataIndex: 'createdBy', width: 100 },
  { title: '创建时间', key: 'createdAt', dataIndex: 'createdAt', width: 140 },
  { title: '备注', key: 'remark', dataIndex: 'remark', width: 120, ellipsis: true },
  { title: '操作', key: 'action', dataIndex: 'action', width: 280, fixed: 'right' },
]

const { columnSettings, columnDrawerOpen, displayColumns, tableScrollX, defaultColumnSettings } =
  useTableColumnSettings('feed-plan-list-v9', baseColumns, {
    minScrollX: 1900,
    excludeKeys: ['index', 'action'],
  })

const execProgressTip =
  '格式：执行中子计划数 / 已完成子计划数 / 子计划数。仅有下级的主计划展示；无下级显示 —。'

const expandedRowKeys = ref([])
const selectedRowKeys = ref([])
let autoTimer = null

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  columnWidth: 48,
  fixed: true,
  checkStrictly: true,
  preserveSelectedRowKeys: true,
  onChange: (keys) => {
    selectedRowKeys.value = Array.isArray(keys) ? keys : keys?.checked || []
  },
}))

function clearSelection() {
  selectedRowKeys.value = []
}

function collectRowIds(nodes, ids = []) {
  nodes.forEach((node) => {
    ids.push(node.id)
    if (node.children?.length) collectRowIds(node.children, ids)
  })
  return ids
}

const emptyFilters = () => ({
  status: undefined,
  planNo: '',
  product: '',
  material: '',
  batchStatus: undefined,
  periodType: undefined,
  batchNo: '',
  createdBy: '',
  createdRange: null,
})
const filters = reactive(emptyFilters())
const applied = reactive(emptyFilters())

const statusOptions = Object.entries(FEED_PLAN_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}))
const batchStatusOptions = Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}))

const modalOpen = ref(false)
const editingId = ref('')
const nameTouched = ref(false)
const form = reactive({
  periodType: 'month',
  date: dayjs(),
  range: [dayjs(), dayjs()],
  planNo: '',
  planName: '',
  itemId: undefined,
  formulaId: undefined,
  workCenterId: undefined,
  targetQty: null,
  parentId: undefined,
  source: FEED_PLAN_SOURCE.MPS,
  sourceRef: '',
  splitTo: FEED_PLAN_SPLIT.NONE,
  remark: '',
})

const splitOpen = ref(false)
const splitPlanId = ref('')
const splitTo = ref(FEED_PLAN_SPLIT.DAY)
const generateOpen = ref(false)
const generatePlanId = ref('')
const statPeriod = ref('本月')
const statPeriodOptions = ['本月', '本周', '本日']
const statusTab = ref('all')
const statusTabs = [
  { value: 'all', label: '全部' },
  { value: FEED_PLAN_STATUS.RUNNING, label: '执行中' },
  { value: FEED_PLAN_STATUS.OPEN, label: '未开启' },
  { value: FEED_PLAN_STATUS.DONE, label: '已完成' },
  { value: FEED_PLAN_STATUS.STOPPED, label: '已终止' },
]

const autoOpen = ref(false)
const autoForm = reactive({
  enabled: false,
  mode: 'next_day',
  days: 1,
  runAtHour: 0,
  ceilBatch: false,
})

const formulaOptions = computed(() => {
  const rows = listFormulas().filter((row) => row.status === 'active' && row.itemId === form.itemId)
  if (form.formulaId && !rows.some((row) => row.id === form.formulaId)) {
    const current = getFormula(form.formulaId)
    if (current) rows.unshift(current)
  }
  return rows.map((row) => ({
    value: row.id,
    label: `${row.formulaNo || row.id} ${row.name || ''}`.trim(),
  }))
})

const workCenterOptions = computed(() => {
  void workCenterState.centers
  return listEnabledWorkCenters().map((row) => ({
    value: row.id,
    label: `${row.code || ''} ${row.name || ''}`.trim(),
  }))
})

const selectedFormula = computed(() => getFormula(form.formulaId))
const selectedMaterials = computed(() => {
  const ids = mainRawMaterialIds(selectedFormula.value)
  return ids.length ? ids.map((id) => itemLabel(id)).join('、') : '—'
})
const feedUnit = computed(() => {
  const ids = mainRawMaterialIds(selectedFormula.value)
  return ids.length ? itemUnit(ids[0]) : 'kg'
})
const outputUnit = computed(() =>
  selectedFormula.value?.itemId ? itemUnit(selectedFormula.value.itemId) : feedUnit.value,
)
const theoreticalYieldText = computed(() => {
  const rate = Number(selectedFormula.value?.theoreticalYield)
  if (!Number.isFinite(rate) || rate < 0) return '—'
  return rate <= 1 ? `${Math.round(rate * 1000) / 10}%` : String(rate)
})
const theoreticalOutputText = computed(() => {
  const formula = selectedFormula.value
  const qty = Number(form.targetQty)
  if (!formula || !(qty > 0) || !Number.isFinite(Number(formula.theoreticalYield))) return '—'
  return `${theoreticalOutput(qty, formula.theoreticalYield)} ${outputUnit.value}`
})
const pickerMode = computed(() => (form.periodType === 'day' ? 'date' : form.periodType))
const parentType = computed(() => parentPeriodType(form.periodType))
const draftPeriod = computed(() => buildFeedPlanPeriod(form.periodType, form.date))

const splitOptionsForCreate = computed(() => {
  if (form.periodType === FEED_PLAN_PERIOD.WEEK) {
    return FEED_PLAN_SPLIT_OPTIONS.filter((row) => row.value !== FEED_PLAN_SPLIT.WEEK)
  }
  return FEED_PLAN_SPLIT_OPTIONS
})

const splitPlan = computed(() => feedPlanState.plans.find((row) => row.id === splitPlanId.value))
const splitTargetLabel = computed(() => {
  const plan = splitPlan.value
  if (!plan) return '—'
  return `${periodLabel[plan.periodType]} ${plan.periodLabel}`
})
const splitOptionsForRow = computed(() => {
  if (splitPlan.value?.periodType === FEED_PLAN_PERIOD.WEEK) {
    return FEED_PLAN_SPLIT_OPTIONS.filter((row) => row.value === FEED_PLAN_SPLIT.DAY)
  }
  return FEED_PLAN_SPLIT_OPTIONS.filter((row) => row.value !== FEED_PLAN_SPLIT.NONE)
})

const parentOptions = computed(() => {
  const period = draftPeriod.value
  if (!parentType.value || !form.formulaId || !period) return []
  return feedPlanState.plans
    .filter(
      (row) =>
        row.id !== editingId.value &&
        row.formulaId === form.formulaId &&
        row.periodType === parentType.value &&
        periodCovers(row, period),
    )
    .map((row) => ({
      value: row.id,
      label: `${periodLabel[row.periodType]} ${row.periodLabel}`,
    }))
})

function countActiveOrdersDeep(planId) {
  let count = listOrdersByFeedPlan(planId).filter(
    (row) => row.status === 'pending_release' || row.status === 'running',
  ).length
  childPlans(planId).forEach((child) => {
    count += countActiveOrdersDeep(child.id)
  })
  return count
}

/** 执行中 / 已完成 / 子计划总数；无下级返回 — */
function buildExecProgressText(planId) {
  const kids = childPlans(planId)
  if (!kids.length) return '—'
  let running = 0
  let done = 0
  kids.forEach((kid) => {
    const status = resolveFeedPlanStatus(kid.id)
    if (status === FEED_PLAN_STATUS.RUNNING) running += 1
    else if (status === FEED_PLAN_STATUS.DONE) done += 1
  })
  return `${running}/${done}/${kids.length}`
}

function enrichPlan(plan) {
  const formula = getFormula(plan.formulaId)
  const materialIds = mainRawMaterialIds(formula)
  const actualQty = sumActualFeed(plan)
  const orders = listOrdersByFeedPlan(plan.id)
  const activeOrders = orders.filter((row) => row.status !== 'cancelled')
  const rateText =
    Number(plan.targetQty) > 0
      ? `${Math.round((actualQty / Number(plan.targetQty)) * 1000) / 10}%`
      : '—'
  const orderText = activeOrders.length
    ? activeOrders
        .map((row) => `${row.batchNo}（${ORDER_STATUS_LABEL[row.status] || row.status}）`)
        .join('、')
    : '—'
  void feedPlanState.autoRelease
  return {
    ...plan,
    workCenterText: formatWorkCenterLabel(plan.workCenterId),
    planName:
      plan.planName || defaultPlanName(plan.periodType, plan.start, [plan.start, plan.end]) || '—',
    product: itemLabel(plan.itemId),
    formula: formula ? `${formula.formulaNo || ''} ${formula.name || ''}`.trim() : '—',
    materials: materialIds.map((id) => itemLabel(id)).join('、') || '—',
    unit: materialIds.length ? itemUnit(materialIds[0]) : 'kg',
    actualQty,
    rateText,
    orderText,
    status: resolveFeedPlanStatus(plan.id),
    execProgressText: buildExecProgressText(plan.id),
    expectedAt: estimateExpectedExecuteAt(plan),
    activeOrderCount: countActiveOrdersDeep(plan.id),
    childCount: childPlans(plan.id).length,
    deletable: childPlans(plan.id).length === 0 && activeOrders.length === 0,
  }
}

function planOrders(planId) {
  return listOrdersByFeedPlan(planId)
}

function includesText(source, keyword) {
  const text = String(keyword || '').trim()
  if (!text) return true
  return String(source || '').includes(text)
}

function planSelfMatch(plan) {
  if (statusTab.value !== 'all' && resolveFeedPlanStatus(plan.id) !== statusTab.value) return false
  if (applied.status && resolveFeedPlanStatus(plan.id) !== applied.status) return false
  if (!includesText(plan.planNo, applied.planNo)) return false
  if (!includesText(itemLabel(plan.itemId), applied.product)) return false
  const materialText = mainRawMaterialIds(getFormula(plan.formulaId))
    .map((id) => itemLabel(id))
    .join('、')
  if (!includesText(materialText, applied.material)) return false
  if (applied.periodType && plan.periodType !== applied.periodType) return false
  if (!includesText(plan.createdBy, applied.createdBy)) return false
  if (applied.createdRange?.[0] && applied.createdRange?.[1]) {
    const day = String(plan.createdAt || '').slice(0, 10)
    const start = dayjs(applied.createdRange[0]).format('YYYY-MM-DD')
    const end = dayjs(applied.createdRange[1]).format('YYYY-MM-DD')
    if (!day || day < start || day > end) return false
  }
  const orders = planOrders(plan.id)
  if (applied.batchStatus && !orders.some((row) => row.status === applied.batchStatus)) return false
  const batchNo = String(applied.batchNo || '').trim()
  if (batchNo && !orders.some((row) => String(row.batchNo || '').includes(batchNo))) return false
  return true
}

function assignSeqNo(nodes, prefix = '') {
  nodes.forEach((node, index) => {
    node.seqNo = prefix ? `${prefix}.${index + 1}` : String(index + 1)
    if (node.children?.length) assignSeqNo(node.children, node.seqNo)
  })
}

function pruneTree(nodes) {
  const kept = []
  nodes.forEach((node) => {
    const children = node.children?.length ? pruneTree(node.children) : []
    const selfHit = planSelfMatch(node)
    if (selfHit || children.length) {
      const next = { ...node }
      if (children.length) next.children = children
      else delete next.children
      kept.push(next)
    }
  })
  return kept
}

const treeRows = computed(() => {
  void batchInstructionState.orders
  void feedPlanState.plans
  const enriched = feedPlanState.plans.map((plan) => enrichPlan(plan))
  const byId = new Map(enriched.map((row) => [row.id, { ...row, children: [] }]))
  const roots = []
  byId.forEach((row) => {
    if (row.parentId && byId.has(row.parentId)) {
      byId.get(row.parentId).children.push(row)
    } else {
      roots.push(row)
    }
  })
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => String(a.start).localeCompare(String(b.start)))
    nodes.forEach((node) => {
      if (node.children?.length) sortNodes(node.children)
    })
  }
  sortNodes(roots)
  const pruned = pruneTree(roots)
  assignSeqNo(pruned)
  return pruned
})

watch(treeRows, (rows) => {
  const visible = new Set(collectRowIds(rows))
  selectedRowKeys.value = selectedRowKeys.value.filter((id) => visible.has(id))
})

function statWindow(period) {
  const today = dayjs()
  if (period === '本日') {
    const day = today.format('YYYY-MM-DD')
    return { start: day, end: day }
  }
  if (period === '本周') {
    return {
      start: today.startOf('isoWeek').format('YYYY-MM-DD'),
      end: today.endOf('isoWeek').format('YYYY-MM-DD'),
    }
  }
  return {
    start: today.startOf('month').format('YYYY-MM-DD'),
    end: today.endOf('month').format('YYYY-MM-DD'),
  }
}

function planOverlapsWindow(plan, window) {
  if (!plan?.start || !plan?.end || !window) return false
  return plan.start <= window.end && plan.end >= window.start
}

const planStats = computed(() => {
  const window = statWindow(statPeriod.value)
  const leaves = feedPlanState.plans.filter(
    (plan) => !childPlans(plan.id).length && planOverlapsWindow(plan, window),
  )
  const units = [
    ...new Set(
      leaves
        .map((plan) => {
          const ids = mainRawMaterialIds(getFormula(plan.formulaId))
          return ids.length ? itemUnit(ids[0]) : ''
        })
        .filter(Boolean),
    ),
  ]
  const unit = units.length === 1 ? units[0] : ''
  const sumQty = (list, pick) => list.reduce((acc, plan) => acc + (Number(pick(plan)) || 0), 0)
  return {
    total: leaves.length,
    running: leaves.filter((plan) => resolveFeedPlanStatus(plan.id) === FEED_PLAN_STATUS.RUNNING)
      .length,
    open: leaves.filter((plan) => resolveFeedPlanStatus(plan.id) === FEED_PLAN_STATUS.OPEN).length,
    targetText: formatQtyWithUnit(
      sumQty(leaves, (plan) => plan.targetQty),
      unit,
    ),
    actualText: formatQtyWithUnit(
      sumQty(leaves, (plan) => sumActualFeed(plan)),
      unit,
    ),
  }
})

const planStatCards = computed(() => {
  const scope = `按${statPeriod.value}与计划期间有交集，且没有下级的计划统计。已拆分的主计划不计入。`
  return [
    {
      key: 'total',
      title: '总计划数',
      value: String(planStats.value.total),
      iconClass: 'icon-shop',
      tip: `${scope}`,
    },
    {
      key: 'running',
      title: '执行中的计划数',
      value: String(planStats.value.running),
      iconClass: 'icon-cyan',
      tip: '总计划数里，状态为执行中的张数。计划未终止，且挂有待下发或执行中的批次指令。',
    },
    {
      key: 'open',
      title: '未开启的计划数',
      value: String(planStats.value.open),
      iconClass: 'icon-orange',
      tip: '总计划数里，还没有批次指令的张数。',
    },
    {
      key: 'target',
      title: '目标投料量',
      value: planStats.value.targetText,
      iconClass: 'icon-purple',
      tip: '总计划数里各计划的目标投料量合计。主计划已拆分时不计主计划，避免和子计划重复相加。',
    },
    {
      key: 'actual',
      title: '实投量',
      value: planStats.value.actualText,
      iconClass: 'icon-green',
      tip: '总计划数里各计划已过账的实投合计。',
    },
  ]
})

function rowClassName(record) {
  return `feed-plan-row feed-plan-row--${record.periodType || 'day'}`
}

function onExpand(expanded, record) {
  const id = record.id
  if (expanded) {
    if (!expandedRowKeys.value.includes(id)) expandedRowKeys.value = [...expandedRowKeys.value, id]
  } else {
    expandedRowKeys.value = expandedRowKeys.value.filter((key) => key !== id)
  }
}

function splitText(record) {
  if (record.periodType === FEED_PLAN_PERIOD.DAY || record.periodType === FEED_PLAN_PERIOD.CUSTOM) {
    return '不可再拆'
  }
  const key = record.splitTo || FEED_PLAN_SPLIT.NONE
  return splitLabel[key] || '不拆分'
}

function canEdit(record) {
  return record.status === FEED_PLAN_STATUS.OPEN
}

function canSplit(record) {
  return (
    canEdit(record) &&
    record.periodType !== FEED_PLAN_PERIOD.DAY &&
    record.periodType !== FEED_PLAN_PERIOD.CUSTOM &&
    record.childCount === 0
  )
}

function canGenerate(record) {
  return record.childCount === 0 && canGenerateFeedPlan(record.id)
}

function hasRowMore(record) {
  return canEdit(record) || record.deletable
}

function canTerminatePlan(plan) {
  if (!plan || plan.stopped) return false
  return resolveFeedPlanStatus(plan.id) !== FEED_PLAN_STATUS.DONE
}

const terminableSelection = computed(() => {
  void feedPlanState.plans
  void batchInstructionState.orders
  const selected = new Set(selectedRowKeys.value)
  return selectedRowKeys.value.filter((id) => {
    const plan = feedPlanState.plans.find((row) => row.id === id)
    if (!canTerminatePlan(plan)) return false
    let parentId = plan.parentId
    while (parentId) {
      if (selected.has(parentId)) return false
      parentId = feedPlanState.plans.find((row) => row.id === parentId)?.parentId
    }
    return true
  })
})

function applySearch() {
  Object.assign(applied, {
    ...filters,
    createdRange: filters.createdRange ? [...filters.createdRange] : null,
  })
}

function resetSearch() {
  Object.assign(filters, emptyFilters())
  applySearch()
}

function syncDefaultPlanName() {
  if (nameTouched.value) return
  form.planName = defaultPlanName(form.periodType, form.date, form.range)
}

function onPlanNameInput(value) {
  nameTouched.value = true
  form.planName = value
}

function onPlanDateChange() {
  form.parentId = undefined
  syncDefaultPlanName()
}

function onPeriodTypeChange() {
  form.parentId = undefined
  if (form.periodType === FEED_PLAN_PERIOD.DAY) form.splitTo = FEED_PLAN_SPLIT.NONE
  if (form.periodType === FEED_PLAN_PERIOD.WEEK && form.splitTo === FEED_PLAN_SPLIT.WEEK) {
    form.splitTo = FEED_PLAN_SPLIT.NONE
  }
  if (form.periodType === FEED_PLAN_PERIOD.CUSTOM) {
    form.splitTo = FEED_PLAN_SPLIT.NONE
    if (!form.range?.[0] || !form.range?.[1]) form.range = [dayjs(), dayjs()]
  }
  syncDefaultPlanName()
}

function formulasOfProduct(itemId) {
  return listFormulas().filter((row) => row.status === 'active' && row.itemId === itemId)
}

function onProductChange() {
  form.parentId = undefined
  const rows = formulasOfProduct(form.itemId)
  const picked = rows.find((row) => row.isDefault) || (rows.length === 1 ? rows[0] : null)
  form.formulaId = picked?.id
}

function resetForm() {
  nameTouched.value = false
  form.periodType = 'month'
  form.date = dayjs()
  form.range = [dayjs(), dayjs()]
  form.planNo = ''
  form.planName = defaultPlanName('month', form.date)
  form.itemId = undefined
  form.formulaId = undefined
  form.workCenterId = undefined
  form.targetQty = null
  form.parentId = undefined
  form.source = FEED_PLAN_SOURCE.MPS
  form.sourceRef = ''
  form.splitTo = FEED_PLAN_SPLIT.NONE
  form.remark = ''
}

function openCreate() {
  editingId.value = ''
  resetForm()
  modalOpen.value = true
}

function openEdit(record) {
  editingId.value = record.id
  nameTouched.value = true
  form.periodType = record.periodType
  form.date = dayjs(record.start)
  form.range = [dayjs(record.start), dayjs(record.end)]
  form.planNo = record.planNo || ''
  form.planName =
    record.planName || defaultPlanName(record.periodType, record.start, [record.start, record.end])
  form.itemId = record.itemId || getFormula(record.formulaId)?.itemId
  form.formulaId = record.formulaId
  form.workCenterId = record.workCenterId || undefined
  form.targetQty = record.targetQty
  form.parentId = record.parentId || undefined
  form.source = record.source || FEED_PLAN_SOURCE.MPS
  form.sourceRef = record.sourceRef || ''
  form.splitTo = record.splitTo || FEED_PLAN_SPLIT.NONE
  form.remark = record.remark || ''
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

function handleSave() {
  try {
    saveFeedPlan(
      {
        periodType: form.periodType,
        date: form.date,
        range: form.range,
        planNo: form.planNo,
        planName: form.planName,
        formulaId: form.formulaId,
        workCenterId: form.workCenterId,
        targetQty: form.targetQty,
        parentId: form.parentId,
        source: form.source,
        sourceRef: form.sourceRef,
        splitTo: editingId.value
          ? feedPlanState.plans.find((row) => row.id === editingId.value)?.splitTo ||
            FEED_PLAN_SPLIT.NONE
          : form.splitTo,
        remark: form.remark,
      },
      editingId.value,
    )
  } catch (error) {
    message.warning(error.message || '保存失败')
    return
  }
  message.success('保存成功')
  modalOpen.value = false
}

function openSplit(record) {
  splitPlanId.value = record.id
  splitTo.value =
    record.periodType === FEED_PLAN_PERIOD.WEEK ? FEED_PLAN_SPLIT.DAY : FEED_PLAN_SPLIT.DAY
  splitOpen.value = true
}

function handleSplit() {
  try {
    const created = splitFeedPlan(splitPlanId.value, splitTo.value)
    message.success(`已拆出 ${created.length} 条下级计划`)
    splitOpen.value = false
  } catch (error) {
    message.warning(error.message || '拆分失败')
  }
}

function goBatchList() {
  openTab('/production/work-orders', '批次指令')
  router.push('/production/work-orders')
}

function goDetail(record) {
  const path = `/planning/production-plan/${record.id}`
  openTab(path, record.planNo || '生产计划详情')
  router.push(path)
}

function onRowMore(key, record) {
  if (key === 'edit') openEdit(record)
  else if (key === 'delete') handleDelete(record)
}

function handleExecute(record) {
  generatePlanId.value = record.id
  generateOpen.value = true
}

function onPlanBatchesDone() {
  generateOpen.value = false
}

function openAutoSettings() {
  const settings = feedPlanState.autoRelease
  autoForm.enabled = Boolean(settings.enabled)
  autoForm.mode = settings.mode || 'next_day'
  autoForm.days = Number(settings.days) || 1
  autoForm.runAtHour = Number(settings.runAtHour) || 0
  autoForm.ceilBatch = Boolean(settings.ceilBatch)
  autoOpen.value = true
}

function handleSaveAuto() {
  saveAutoReleaseSettings({
    enabled: autoForm.enabled,
    mode: autoForm.mode,
    days: autoForm.days,
    runAtHour: autoForm.runAtHour,
    ceilBatch: autoForm.ceilBatch,
  })
  message.success('自动下发设置已保存')
  autoOpen.value = false
  tryAutoRelease()
}

function handleAutoRunNow() {
  const result = runAutoReleaseFeedPlans({ force: true })
  if (!result.created?.length) {
    message.info('当前规则窗口内没有可补发的计划')
    return
  }
  message.success(`已补发 ${result.created.length} 张批次`)
  goBatchList()
}

function tryAutoRelease() {
  const result = runAutoReleaseFeedPlans()
  if (result.ok && result.created?.length) {
    message.success(`自动下发：已生成 ${result.created.length} 张批次`)
  }
}

onMounted(() => {
  tryAutoRelease()
  autoTimer = window.setInterval(() => tryAutoRelease(), 60 * 1000)
})

onUnmounted(() => {
  if (autoTimer) window.clearInterval(autoTimer)
  autoTimer = null
})

function handleTerminateSelected() {
  const ids = terminableSelection.value
  if (!ids.length) return
  const rows = ids.map((id) => feedPlanState.plans.find((row) => row.id === id)).filter(Boolean)
  const names = rows
    .slice(0, 3)
    .map((row) => row.planNo || row.periodLabel)
    .join('、')
  const suffix = rows.length > 3 ? `等 ${rows.length} 张` : ''
  Modal.confirm({
    title: '终止计划',
    content: `终止${names}${suffix}？未完成的下级计划一并终止。待下发的批次指令会作废，执行中和已完成的批次保持不动。终止后状态为已终止。`,
    okText: '终止',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      const count = ids.reduce((sum, id) => sum + stopFeedPlanOrders(id), 0)
      message.success(count ? `已终止，并作废 ${count} 张待下发批次` : '已终止')
      clearSelection()
    },
  })
}

function handleDelete(record) {
  Modal.confirm({
    title: '删除生产计划',
    content: `删除「${record.periodLabel}」？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      const result = deleteFeedPlan(record.id)
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
.selection-count {
  color: #4e5969;
  font-size: 14px;
}

.plan-status-tabs {
  margin: -8px -12px 0;
  padding: 0 16px;

  :deep(.ant-tabs-nav) {
    margin-bottom: 0;
  }

  :deep(.ant-tabs-content-holder) {
    display: none;
  }
}

.plan-metric-bar {
  display: flex;
  margin: 4px 0 8px;
  padding: 12px 4px;
  background: linear-gradient(180deg, #f7f9fc 0%, #f5f5f5 100%);
  border: 1px solid #ebedf0;
  border-radius: 8px;
}

.plan-metric-item {
  flex: 1;
  min-width: 0;
  padding: 0 16px;
  border-right: 1px solid #e8e8e8;

  &:last-child {
    border-right: none;
  }
}

.plan-metric-label {
  margin-bottom: 6px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1.4;
}

.plan-metric-value {
  color: rgba(0, 0, 0, 0.88);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-all;

  &.accent {
    color: #307068;
  }
}

.seq-no {
  display: inline-block;
  white-space: nowrap;
  word-break: keep-all;
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
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  cursor: help;
}

.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.split-hint {
  margin-top: 8px;
  font-size: 13px;
  color: #4e5969;
}

.feed-plan-page :deep(.feed-plan-row--month > td) {
  background: #e7f3f1 !important;
  font-weight: 500;
}

.feed-plan-page :deep(.feed-plan-row--week > td) {
  background: #f3f8f7 !important;
}

.feed-plan-page :deep(.feed-plan-row--day > td) {
  background: #fff !important;
}

.feed-plan-page :deep(.feed-plan-row:hover > td) {
  filter: brightness(0.98);
}
</style>
