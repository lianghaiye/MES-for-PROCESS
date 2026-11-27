<template>
  <div v-if="record" class="formula-detail-page">
    <div class="detail-sticky-bar">
      <div class="page-header">
        <div class="header-left">
          <a-button type="text" size="small" class="back-btn" @click="goBack">
            <ArrowLeftOutlined />
          </a-button>
          <span class="order-no">{{ record.name }}</span>
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
          <a-tag v-if="record.status === 'active' && record.isDefault" color="blue">默认</a-tag>
          <span class="sub-code">{{ record.formulaNo }} · {{ record.version }}</span>
        </div>
        <a-space class="header-actions" :size="8">
          <!-- 生效：走升版开新版本；待发布：直接编辑当前版本 -->
          <a-button v-if="record.status === 'active'" type="primary" size="small" @click="revise">
            升版
          </a-button>
          <a-button
            v-if="record.status === 'active' && !record.isDefault"
            size="small"
            @click="markDefault"
          >
            设为默认
          </a-button>
          <a-button v-if="record.status === 'pending'" size="small" @click="goEdit">编辑</a-button>
          <a-button
            v-if="record.status === 'pending' || record.status === 'archived'"
            type="primary"
            size="small"
            @click="publish"
          >
            审核发布
          </a-button>
          <a-button v-if="record.status !== 'archived'" size="small" @click="archive"
            >归档</a-button
          >
          <a-button size="small" @click="goBack">返回列表</a-button>
        </a-space>
      </div>

      <div class="detail-tabs-wrap">
        <a-tabs
          v-model:active-key="activeTab"
          class="detail-tabs detail-tabs-pill detail-tabs-pill--nav-only"
        >
          <a-tab-pane key="detail" tab="配方明细" />
          <a-tab-pane key="history" :tab="`历史版本 (${versionRows.length})`" />
          <a-tab-pane key="operationLog" :tab="`操作日志 (${operationLogs.length})`" />
        </a-tabs>
      </div>
    </div>

    <div class="tab-body">
      <template v-if="activeTab === 'detail'">
        <DetailSectionCard title="基本信息">
          <DetailInfoGrid :meta-items="basicMeta" :fields="basicFields" flush />
        </DetailSectionCard>

        <DetailSectionCard title="工艺阶段">
          <a-table
            :columns="stepColumns"
            :data-source="stepRows"
            :pagination="false"
            size="small"
            bordered
            row-key="stepNo"
            :locale="{ emptyText: '还没有工艺阶段' }"
            :scroll="{ x: 960 }"
          />
        </DetailSectionCard>

        <DetailSectionCard title="产出">
          <a-table
            class="formula-output-table"
            :columns="outputColumns"
            :data-source="outputRows"
            :pagination="false"
            size="small"
            bordered
            row-key="key"
            :locale="{ emptyText: '还没有产出' }"
            :scroll="{ x: 1440 }"
          />
        </DetailSectionCard>

        <DetailSectionCard title="投料明细">
          <p class="block-hint">{{ ratioHint }}</p>
          <a-table
            :columns="lineColumns"
            :data-source="lineRows"
            :pagination="false"
            size="small"
            bordered
            row-key="key"
            :locale="{ emptyText: '还没有投料行' }"
            :scroll="{ x: 1680 }"
          />
        </DetailSectionCard>
      </template>

      <template v-else-if="activeTab === 'history'">
        <DetailSectionCard title="历史版本">
          <div class="version-status-card">
            <div class="version-status-title">当前版本</div>
            <div class="version-status-meta">
              {{ record.formulaNo }} · {{ record.name }} · {{ record.version }}
              <span> · {{ statusLabel(record.status) }}</span>
              <span v-if="record.status === 'active' && record.isDefault"> · 默认</span>
            </div>
          </div>
          <div class="section-label">版本列表</div>
          <a-table
            v-if="versionRows.length"
            :columns="versionColumns"
            :data-source="versionRows"
            row-key="id"
            size="small"
            bordered
            :pagination="false"
            :scroll="{ x: 1100 }"
          >
            <template #bodyCell="{ column, record: row }">
              <template v-if="column.key === 'status'">
                <a-tag :color="statusColor(row.status)">{{ statusLabel(row.status) }}</a-tag>
                <a-tag v-if="row.status === 'active' && row.isDefault" color="blue">默认</a-tag>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button
                  v-if="row.id !== record.id"
                  type="link"
                  size="small"
                  @click="goVersion(row)"
                >
                  查看
                </a-button>
                <span v-else class="current-mark">当前</span>
              </template>
            </template>
          </a-table>
          <a-empty v-else description="暂无历史版本" />
        </DetailSectionCard>
      </template>

      <template v-else>
        <DetailSectionCard title="操作日志">
          <a-table
            :columns="logColumns"
            :data-source="operationLogs"
            row-key="id"
            size="small"
            bordered
            :pagination="operationLogs.length > 10 ? { pageSize: 10, size: 'small' } : false"
            :locale="{ emptyText: '暂无操作日志' }"
            :scroll="{ x: 720 }"
          />
        </DetailSectionCard>
      </template>
    </div>
  </div>
  <a-empty v-else description="未找到配方" />
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { ArrowLeftOutlined } from '@ant-design/icons-vue'
import DetailSectionCard from '@/components/DetailSectionCard.vue'
import DetailInfoGrid from '@/views/product-process/components/DetailInfoGrid.vue'
import { useFormCreatePage } from '@/composables/useFormCreatePage'
import { useTabs } from '@/composables/useTabs'
import {
  calcTheoreticalFeed,
  isRatioOnlyFormula,
  ratiosClosed,
  sumFeedRatios,
  theoreticalOutput,
} from '@/utils/processBatchMath'
import {
  FORMULA_STATUS_LABEL,
  FORMULA_TYPE_LABEL,
  OUTPUT_ROLE_LABEL,
  normalizeOutputAssayScopes,
  resolveFormulaStepAssaySchemes,
  archiveFormula,
  getFormula,
  itemLabel,
  itemMasterCard,
  itemMasterProfile,
  formatStepParams,
  listFormulaVersionsByLineage,
  publishFormula,
  reviseFormula,
  setDefaultFormula,
} from '@/store/processFormulaStore'
import { getProcessRouteById } from '@/store/processRouteStore'
import { qcBizScopeLabel } from '@/constants/qcBizScopeLabel'
import { formatProcessGate } from '@/mock/processConfigSeed'
import { assayTypeLabel, isFinishedAssayScheme } from '@/utils/qcProcessConfig'
import { getProcessById } from '@/store/processConfigStore'
import { deviceLabelById } from '@/store/equipmentStore'
import { formatDownstreamSpawnDetailText } from '@/utils/outputDownstreamSpawn'

const route = useRoute()
const router = useRouter()
const { openTab } = useTabs()
const { goBack } = useFormCreatePage('/product-process/bom')
const activeTab = ref('detail')
const record = computed(() => getFormula(route.params.id))

watch(
  () => route.params.id,
  () => {
    activeTab.value = 'detail'
  },
)

const ratioHint = computed(() => {
  const lines = record.value?.lines || []
  const percent = `${(sumFeedRatios(lines) * 100).toFixed(2)}%`
  if (isRatioOnlyFormula(lines)) {
    return ratiosClosed(lines)
      ? `配比合计 ${percent}，已到 100%。`
      : `配比合计 ${percent}，未到 100%。`
  }
  return `配比合计 ${percent}。投料量行不计入合计。`
})

const roleLabel = OUTPUT_ROLE_LABEL

function statusLabel(value) {
  return FORMULA_STATUS_LABEL[value] || '—'
}
function statusColor(value) {
  if (value === 'active') return 'success'
  if (value === 'archived') return 'default'
  return 'warning'
}

function routeText(row) {
  if (!row?.routeId) return '—'
  const item = getProcessRouteById(row.routeId)
  if (!item) return '—'
  return `${item.code || ''} ${item.name || ''}`.trim() || '—'
}

function defaultText(row) {
  if (row.status === 'active' && row.isDefault) return '是'
  if (row.status !== 'active' && row.isDefault) return '发布后设为默认'
  return '否'
}

function text(value) {
  return value == null || value === '' ? '—' : String(value)
}

const basicMeta = computed(() => {
  const row = record.value
  if (!row) return []
  return [
    { key: 'creator', label: '创建人', value: text(row.creator) },
    { key: 'createdAt', label: '创建时间', value: text(row.createdAt) },
    { key: 'updater', label: '更新人', value: text(row.updater) },
    { key: 'updatedAt', label: '更新时间', value: text(row.updatedAt) },
  ]
})

const basicFields = computed(() => {
  const row = record.value
  if (!row) return []
  const card = itemMasterCard(row.itemId)
  return [
    { key: 'formulaNo', label: '配方编号', value: text(row.formulaNo) },
    { key: 'name', label: '配方名称', value: text(row.name) },
    {
      key: 'formulaType',
      label: '配方类型',
      value: FORMULA_TYPE_LABEL[row.formulaType] || '标准配方',
    },
    { key: 'version', label: '配方版本', value: text(row.version) },
    { key: 'item', label: '主产品', value: card.name || itemLabel(row.itemId) },
    { key: 'itemCode', label: '产品编码', value: text(card.code) },
    { key: 'materialType', label: '产品类型', value: text(card.materialType) },
    { key: 'spec', label: '规格', value: text(card.specModel) },
    { key: 'baseBatchQty', label: '基准批量', value: `${row.baseBatchQty} kg` },
    { key: 'theoreticalYield', label: '理论得率', value: text(row.theoreticalYield) },
    {
      key: 'theoreticalOutput',
      label: '理论产出',
      value: `${theoreticalOutput(row.baseBatchQty, row.theoreticalYield)} kg`,
    },
    { key: 'route', label: '工艺路线', value: routeText(row) },
    { key: 'status', label: '配方状态', value: statusLabel(row.status) },
    { key: 'default', label: '默认配方', value: defaultText(row) },
    { key: 'remark', label: '产品备注', value: text(card.remark), fullRow: true },
  ]
})

// 列较多，靠横向滚动看全；序号固定在左侧
const outputColumns = [
  { title: '序号', dataIndex: 'index', width: 64, align: 'center', fixed: 'left' },
  { title: '角色', dataIndex: 'roleLabel', width: 100 },
  { title: '物料', dataIndex: 'item', width: 140, ellipsis: true },
  { title: '编码', dataIndex: 'code', width: 110 },
  { title: '类型', dataIndex: 'materialType', width: 80 },
  { title: '规格', dataIndex: 'specModel', width: 120, ellipsis: true },
  { title: '产出工序', dataIndex: 'stepText', width: 140, ellipsis: true },
  { title: '产出化验 / 门禁', dataIndex: 'assayText', width: 200, ellipsis: true },
  { title: '生成下游指令', dataIndex: 'downstreamText', width: 280, ellipsis: true },
  { title: '预期数量', dataIndex: 'expectedQty', align: 'right', width: 120 },
]
const lineColumns = [
  { title: '序号', dataIndex: 'index', width: 64, align: 'center' },
  { title: '物料', dataIndex: 'item', width: 140 },
  { title: '编码', dataIndex: 'code', width: 120 },
  { title: '类型', dataIndex: 'materialType', width: 90 },
  { title: '规格', dataIndex: 'specModel', width: 150 },
  { title: '顺序', dataIndex: 'feedSequence', width: 70 },
  { title: '所属阶段', dataIndex: 'stepText', width: 140 },
  { title: '投料量', dataIndex: 'feedQtyText', align: 'right', width: 110 },
  { title: '配比', dataIndex: 'ratioText', align: 'right', width: 90 },
  { title: '损耗', dataIndex: 'lossText', align: 'right', width: 90 },
  { title: '允差(±)', dataIndex: 'toleranceText', align: 'right', width: 100 },
  { title: '关键物料', dataIndex: 'keyText', width: 90 },
  { title: '辅料', dataIndex: 'auxText', width: 80 },
  { title: '按有效含量折算', dataIndex: 'contentText', width: 160 },
  { title: '理论投料', dataIndex: 'theoreticalQty', align: 'right', width: 110 },
]
const stepColumns = [
  { title: '阶段', dataIndex: 'stepNo', width: 70 },
  { title: '工序', dataIndex: 'processName', width: 140 },
  { title: '设备分类', dataIndex: 'equipmentCategoryText', width: 110 },
  { title: '候选设备', dataIndex: 'equipmentText', width: 240 },
  { title: '参数', dataIndex: 'paramText' },
]
const versionColumns = [
  { title: '状态', key: 'status', width: 140 },
  { title: '配方编号', dataIndex: 'formulaNo', width: 140 },
  { title: '配方名称', dataIndex: 'name', width: 180, ellipsis: true },
  { title: '版本', dataIndex: 'version', width: 90 },
  { title: '创建人', dataIndex: 'creator', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', width: 150 },
  { title: '更新时间', dataIndex: 'updatedAt', width: 150 },
  { title: '操作', key: 'action', width: 80, fixed: 'right' },
]
const logColumns = [
  { title: '操作时间', dataIndex: 'operatedAt', width: 170 },
  { title: '操作', dataIndex: 'action', width: 140 },
  { title: '操作人', dataIndex: 'operator', width: 100 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
]

function outputAssayText(row, step) {
  const proc = step?.processId ? getProcessById(step.processId) : null
  const schemes = resolveFormulaStepAssaySchemes(step, proc).filter(isFinishedAssayScheme)
  if (schemes.length) {
    return schemes
      .map((scheme) => {
        const type = assayTypeLabel(scheme.assayType, scheme.bizScope)
        const gate = formatProcessGate(scheme.gateMode)
        return `${type}（${gate}）`
      })
      .join('；')
  }
  const names = normalizeOutputAssayScopes(row?.assayScopes).map((scope) => qcBizScopeLabel(scope))
  return names.length ? names.join('、') : '—'
}

const outputRows = computed(() =>
  (record.value?.outputs || []).map((row, index) => {
    const card = itemMasterCard(row.itemId)
    const step =
      Number(row.stepNo) > 0
        ? (record.value?.steps || []).find((s) => Number(s.stepNo) === Number(row.stepNo))
        : null
    return {
      ...row,
      key: `${row.role}-${index}`,
      index: index + 1,
      roleLabel: roleLabel[row.role] || row.role,
      item: card.name || itemLabel(row.itemId),
      code: text(card.code),
      materialType: text(card.materialType),
      specModel: text(card.specModel),
      stepText: row.stepNo ? `${row.stepNo} ${row.stepName || step?.name || ''}`.trim() : '—',
      assayText: outputAssayText(row, step),
      // 下游多选 + 手动/自动开单方式
      downstreamText: formatDownstreamSpawnDetailText(row, getFormula),
    }
  }),
)

const lineRows = computed(() =>
  (record.value?.lines || []).map((line, index) => {
    const calc = calcTheoreticalFeed(line, record.value.baseBatchQty)
    const profile = itemMasterProfile(line.itemId)
    const card = itemMasterCard(line.itemId)
    const key = line.isKeyMaterial ?? profile.isKeyMaterial
    const aux = line.isAuxiliary ?? profile.isAuxiliary
    return {
      ...line,
      key: `${line.itemId}-${index}`,
      index: index + 1,
      item: card.name || itemLabel(line.itemId),
      code: text(card.code),
      materialType: text(card.materialType),
      specModel: text(card.specModel),
      stepText: stepLabel(line.stepNo),
      feedQtyText: line.feedQty == null || line.feedQty === '' ? '—' : `${line.feedQty} kg`,
      ratioText: percentText(line.ratio),
      lossText: percentText(line.lossRate),
      toleranceText: percentText(line.tolerance),
      keyText: key ? '是' : '否',
      auxText: aux ? '是' : '否',
      contentText: line.convertByContent
        ? `是（有效含量 ${line.content == null || line.content === '' ? '—' : percentText(line.content)}）`
        : '否',
      theoreticalQty: calc.ok ? calc.qty : '—',
    }
  }),
)

const stepRows = computed(() =>
  (record.value?.steps || []).map((step) => {
    const ids = Array.isArray(step.equipmentIds)
      ? step.equipmentIds
      : step.equipmentId
        ? [step.equipmentId]
        : []
    const labels = ids.map((id) => deviceLabelById(id) || id).filter(Boolean)
    const proc = step.processId ? getProcessById(step.processId) : null
    return {
      ...step,
      processName: proc?.name || step.name || '—',
      equipmentCategoryText: step.equipmentCategory || '—',
      equipmentText: labels.length ? labels.join('、') : '—',
      paramText: formatStepParams(step),
    }
  }),
)

const versionRows = computed(() => {
  const row = record.value
  if (!row) return []
  return listFormulaVersionsByLineage(row.lineageId || row.formulaNo || row.id).map((item) => ({
    ...item,
    creator: item.creator || '—',
    createdAt: item.createdAt || '—',
    updatedAt: item.updatedAt || '—',
  }))
})

const operationLogs = computed(() => {
  const logs = record.value?.operationLogs
  return Array.isArray(logs) ? logs : []
})

function percentText(value) {
  if (value == null || value === '') return '—'
  const number = Number(value)
  if (Number.isNaN(number)) return '—'
  return `${Number((number * 100).toFixed(2))}%`
}

function stepLabel(stepNo) {
  const step = (record.value?.steps || []).find((item) => item.stepNo === Number(stepNo))
  if (!step) return '—'
  return `${step.stepNo} ${step.name || ''}`.trim()
}

function goEdit() {
  const path = `/product-process/bom/${record.value.id}/edit`
  const query = {
    returnTo: route.fullPath,
    returnTitle: record.value.name || record.value.formulaNo || '配方详情',
  }
  const fullPath = router.resolve({ path, query }).fullPath
  openTab(fullPath, '编辑配方')
  router.push({ path, query })
}

function goVersion(row) {
  const path = `/product-process/bom/${row.id}`
  openTab(path, row.name)
  router.push(path)
}

function publish() {
  Modal.confirm({
    title: '审核发布',
    content: `确定发布「${record.value.name}」吗？同一配方的旧版本会归档，该产品的其他生效配方保持不变。`,
    onOk: () => {
      try {
        publishFormula(record.value.id)
        message.success('审核发布成功，当前版本已生效')
      } catch (error) {
        message.error(error.message)
      }
    },
  })
}

function markDefault() {
  try {
    setDefaultFormula(record.value.id)
    message.success('已设为默认配方')
  } catch (error) {
    message.error(error.message)
  }
}

function revise() {
  try {
    const copy = reviseFormula(record.value.id)
    message.success(`已生成待发布版本 ${copy.version}`)
    const path = `/product-process/bom/${copy.id}/edit`
    const detailPath = `/product-process/bom/${copy.id}`
    const query = {
      returnTo: detailPath,
      returnTitle: copy.name || copy.formulaNo || '配方详情',
    }
    const fullPath = router.resolve({ path, query }).fullPath
    openTab(fullPath, '编辑配方')
    router.push({ path, query })
  } catch (error) {
    message.error(error.message)
  }
}

function archive() {
  Modal.confirm({
    title: '归档',
    content: record.value.isDefault
      ? `确定归档「${record.value.name}」吗？归档后该产品没有默认配方，生成批次指令时需要手工选择。`
      : `确定归档「${record.value.name}」吗？`,
    onOk: () => {
      archiveFormula(record.value.id)
      message.success('已归档')
    },
  })
}
</script>

<style lang="less" scoped>
.formula-detail-page {
  margin: -12px;
  padding: 12px;
  background: var(--page-bg, #f0f2f5);
  min-height: calc(100% + 24px);
}

.detail-sticky-bar {
  margin-bottom: 8px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.back-btn {
  margin-left: -6px;
}

.order-no {
  font-size: 20px;
  font-weight: 600;
  color: #1f2329;
  line-height: 28px;
  white-space: nowrap;
}

.sub-code {
  color: #86909c;
  font-size: 13px;
  white-space: nowrap;
}

.header-actions {
  flex-shrink: 0;
}

.tab-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block-hint {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 22px;
  color: #4e5969;
}

.version-status-card {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}

.version-status-title {
  font-weight: 600;
  font-size: 13px;
  color: #1f2329;
}

.version-status-meta {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 1.4;
}

.section-label {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}

.current-mark {
  color: #86909c;
  font-size: 13px;
}

/* 保证产出表横向滚动条可见，下游列不被裁切 */
.formula-output-table {
  :deep(.ant-table-content) {
    overflow-x: auto !important;
  }
}
</style>
