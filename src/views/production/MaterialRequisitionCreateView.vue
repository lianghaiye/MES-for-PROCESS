<template>
  <div class="mr-create-page">
    <div class="page-header">
      <div class="header-left">
        <span class="page-title">申请领料</span>
      </div>
      <a-space :size="12">
        <a-button size="small" @click="goBack">取消</a-button>
        <a-button type="primary" size="small" :loading="submitting" @click="onSubmit">
          提交领料申请
        </a-button>
        <a-button size="small" @click="goBack">返回列表</a-button>
      </a-space>
    </div>

    <div class="page-body">
      <div class="section-card">
        <div class="section-title">领料方式</div>
        <a-radio-group v-model:value="mode" button-style="solid" class="mode-tabs">
          <a-radio-button value="quick">快速领料</a-radio-button>
          <a-radio-button value="batch">批次领料</a-radio-button>
        </a-radio-group>
        <div class="mode-hint">
          <template v-if="mode === 'batch'">
            选择批次指令后按计划投料带出物料，数量可改。不指定原料批次，仓库出库时确定实际批次。
          </template>
          <template v-else>
            不关联批次指令，手工添加物料和数量。不指定原料批次，仓库出库时确定实际批次。
          </template>
        </div>
      </div>

      <div v-if="mode === 'batch'" class="section-card">
        <div class="section-title">选择批次指令</div>
        <a-table
          :columns="batchRowColumns"
          :data-source="batchRows"
          row-key="key"
          size="small"
          bordered
          :pagination="false"
          class="batch-pick-table"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'batch'">
              <BatchInstructionSearchSelect
                :value="record.batchId"
                :orders="openBatchOrders"
                :exclude-ids="excludeBatchIds(record.batchId)"
                @change="(id) => onBatchRowChange(index, id)"
              />
            </template>
            <template v-else-if="column.key === 'product'">
              <span v-if="batchOf(record.batchId)">{{ batchProductText(record.batchId) }}</span>
              <span v-else class="cell-placeholder">选择批次指令后自动带出</span>
            </template>
            <template v-else-if="column.key === 'qty'">
              {{ batchQtyText(record.batchId) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button
                type="link"
                size="small"
                danger
                :disabled="batchRows.length <= 1"
                @click="removeBatchRow(index)"
              >
                删除
              </a-button>
            </template>
          </template>
        </a-table>
        <a-button type="dashed" block class="add-batch-btn" @click="addBatchRow">
          + 添加批次指令
        </a-button>
        <div v-if="selectedBatches.length" class="selected-tip">
          已选 {{ selectedBatches.length }} 张批次指令
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">申请信息</div>
        <a-form layout="inline" class="head-form horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="8">
              <a-form-item label="申请车间" required>
                <a-select
                  v-model:value="form.workshop"
                  :options="workshopOpts"
                  show-search
                  allow-clear
                  size="small"
                  placeholder="请选择"
                  @change="onWorkshopChange"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="领入仓库">
                <a-select
                  v-model:value="form.receiveWarehouse"
                  :options="receiveWarehouseOpts"
                  show-search
                  allow-clear
                  size="small"
                  placeholder="线边仓（可选）"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="备注" class="remark-item">
                <a-input v-model:value="form.remark" allow-clear size="small" placeholder="选填" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <div class="section-card">
        <div class="section-head">
          <div class="section-title">
            领料明细（{{ lines.length }} 项 / 合计 {{ totalQtyText }}）
          </div>
          <a-button type="primary" size="small" @click="pickerOpen = true">添加物料</a-button>
        </div>
        <a-table
          :columns="lineColumns"
          :data-source="lines"
          row-key="id"
          size="small"
          bordered
          :pagination="false"
          :scroll="{ x: 1480 }"
          :locale="{ emptyText: mode === 'batch' ? '请选择批次指令，或添加物料' : '请添加物料' }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'seq'">{{ index + 1 }}</template>
            <template v-else-if="column.key === 'specModel'">{{
              record.specModel || '—'
            }}</template>
            <template v-else-if="column.key === 'suggestedQty'">
              {{ qtyWithUnit(record.suggestedQty, record.unit) }}
            </template>
            <template v-else-if="column.key === 'shipQty'">
              <div class="qty-with-unit">
                <a-input-number
                  v-model:value="record.shipQty"
                  :min="0"
                  :precision="3"
                  size="small"
                  class="qty-input"
                />
                <span class="qty-unit">{{ record.unit || '' }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'shipWarehouse'">
              <a-select
                v-model:value="record.shipWarehouse"
                :options="pickWarehouseOpts"
                size="small"
                show-search
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'warehouseStockQty'">
              {{ qtyWithUnit(warehouseQty(record), record.unit) }}
            </template>
            <template v-else-if="column.key === 'source'">{{ sourceText(record) }}</template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" danger @click="removeLine(index)">删除</a-button>
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <SelectBomMaterialModal
      v-model:open="pickerOpen"
      title="添加物料"
      hide-add-material
      hide-material-drawing
      picker-default-item-type="物料"
      :initial-selected-ids="selectedItemIds"
      @selected="onMaterialsPicked"
    />
  </div>
</template>

<script>
export default { name: 'MaterialRequisitionCreateView' }
</script>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { getWorkCenterSelectOptions } from '@/utils/productionPlanMaterial'
import { warehouseState } from '@/store/warehouseStore'
import { getBatchOrder, listBatchOrders } from '@/store/batchInstructionStore'
import { itemMasterCard, itemUnit } from '@/store/processFormulaStore'
import { MATERIAL_REQ_MODES, submitMaterialRequisition } from '@/store/mobileMaterialReqStore'
import { formatNumber } from '@/utils/numberFormat'
import { getWarehouseStockQty } from '@/utils/outboundLineHelpers'
import SelectBomMaterialModal from '@/views/product-process/components/SelectBomMaterialModal.vue'
import BatchInstructionSearchSelect from '@/views/production/components/BatchInstructionSearchSelect.vue'

const route = useRoute()
const router = useRouter()

const lines = ref([])
const pickerOpen = ref(false)
const submitting = ref(false)
const mode = ref('quick')
const batchRows = ref([{ key: 'batch-row-1', batchId: '' }])
let batchRowSeq = 1

const form = reactive({
  workshop: '反应车间',
  receiveWarehouse: '',
  remark: '',
})

const workshopOpts = computed(() => getWorkCenterSelectOptions())

const openBatchOrders = computed(() =>
  listBatchOrders().filter(
    (row) =>
      row.status === 'pending_release' ||
      row.status === 'running' ||
      batchRows.value.some((item) => item.batchId === row.id),
  ),
)

const selectedBatches = computed(() =>
  batchRows.value.map((row) => getBatchOrder(row.batchId)).filter(Boolean),
)

function excludeBatchIds(currentId) {
  return batchRows.value.map((row) => row.batchId).filter((id) => id && id !== currentId)
}

const receiveWarehouseOpts = computed(() =>
  warehouseState.warehouses
    .filter((w) => w.enabled !== false && w.categoryName === '线边仓')
    .map((w) => ({
      label: `${w.name}${w.workCenter ? `（${w.workCenter}）` : ''}`,
      value: w.name,
    })),
)

const pickWarehouseOpts = computed(() =>
  warehouseState.warehouses
    .filter((w) => w.enabled !== false)
    .map((w) => ({ label: w.name, value: w.name })),
)

const batchRowColumns = [
  { title: '批次指令', key: 'batch', width: 320 },
  { title: '产品', key: 'product' },
  { title: '批量', key: 'qty', width: 140 },
  { title: '操作', key: 'action', width: 70 },
]

const lineColumns = [
  { title: '序号', key: 'seq', width: 64, align: 'center', fixed: 'left' },
  { title: '物料编号', dataIndex: 'itemCode', key: 'itemCode', width: 140 },
  { title: '物料名称', dataIndex: 'itemName', key: 'itemName', width: 160, ellipsis: true },
  { title: '规格型号', key: 'specModel', width: 120, ellipsis: true },
  { title: '建议数量', key: 'suggestedQty', width: 130, align: 'right' },
  { title: '申请数量', key: 'shipQty', width: 180 },
  { title: '领料仓库', key: 'shipWarehouse', width: 150 },
  { title: '当前仓库数量', key: 'warehouseStockQty', width: 140, align: 'right' },
  { title: '来源', key: 'source', width: 160, ellipsis: true },
  { title: '操作', key: 'action', width: 70, fixed: 'right' },
]

const selectedItemIds = computed(() => lines.value.map((line) => line.itemId).filter(Boolean))

const totalQtyText = computed(() =>
  formatQty(lines.value.reduce((sum, line) => sum + (Number(line.shipQty) || 0), 0)),
)

function formatQty(value) {
  return formatNumber(value, 3, { empty: '—' })
}

function qtyWithUnit(value, unit) {
  if (value == null || value === '') return '—'
  const qty = formatQty(value)
  return unit ? `${qty} ${unit}` : qty
}

function warehouseQty(record) {
  return getWarehouseStockQty(record.shipWarehouse, record.itemCode)
}

function sourceText(record) {
  if (record.lineSource === '手工添加') return '手工添加'
  if (record.sourceBatchNos?.length) return record.sourceBatchNos.join('、')
  return '批次指令'
}

function syncReceiveWarehouse() {
  const matched = receiveWarehouseOpts.value.find((o) => {
    const wh = warehouseState.warehouses.find((w) => w.name === o.value)
    return wh?.workCenter === form.workshop
  })
  form.receiveWarehouse = matched?.value || receiveWarehouseOpts.value[0]?.value || ''
}

function onWorkshopChange() {
  syncReceiveWarehouse()
}

function batchOf(id) {
  return id ? getBatchOrder(id) : null
}

function batchProductText(id) {
  const order = batchOf(id)
  if (!order) return '—'
  const card = itemMasterCard(order.itemId)
  const name = `${card.code || ''} ${card.name || ''}`.trim()
  return [name || '—', order.formulaName].filter(Boolean).join(' · ')
}

function batchQtyText(id) {
  const order = batchOf(id)
  if (!order) return '—'
  return `${formatQty(order.qty)} ${order.unit || ''}`.trim()
}

function rebuildBatchLines() {
  const manual = lines.value.filter((line) => line.lineSource !== '批次指令')
  const merged = new Map()
  selectedBatches.value.forEach((order) => {
    ;(order.theoreticalFeeds || []).forEach((feed) => {
      if (!feed?.itemId) return
      const qty = Number(feed.qty) || 0
      const prev = merged.get(feed.itemId)
      if (prev) {
        prev.qty += qty
        if (order.batchNo && !prev.batchNos.includes(order.batchNo))
          prev.batchNos.push(order.batchNo)
      } else {
        merged.set(feed.itemId, {
          itemId: feed.itemId,
          qty,
          batchNos: order.batchNo ? [order.batchNo] : [],
        })
      }
    })
  })
  const fromBatch = []
  merged.forEach((feed) => {
    const card = itemMasterCard(feed.itemId)
    const qty = Number(feed.qty.toFixed(3))
    fromBatch.push({
      id: `mr-line-${feed.itemId}`,
      itemId: feed.itemId,
      itemCode: card.code,
      itemName: card.name,
      specModel: card.specModel || '',
      unit: itemUnit(feed.itemId),
      suggestedQty: qty,
      shipQty: qty,
      planQty: qty,
      shipWarehouse: '原料仓',
      sourceBatchNos: feed.batchNos,
      lineSource: '批次指令',
    })
  })
  lines.value = [...fromBatch, ...manual.filter((line) => !merged.has(line.itemId))]
}

function onBatchRowChange(index, id) {
  const nextId = id || ''
  if (nextId && batchRows.value.some((row, i) => i !== index && row.batchId === nextId)) {
    message.warning('该批次指令已选择')
    batchRows.value[index].batchId = ''
    rebuildBatchLines()
    return
  }
  batchRows.value[index].batchId = nextId
  const order = nextId ? getBatchOrder(nextId) : null
  if (order && !(order.theoreticalFeeds || []).length) {
    message.warning('该批次指令没有计划投料')
  }
  rebuildBatchLines()
}

function addBatchRow() {
  batchRowSeq += 1
  batchRows.value.push({ key: `batch-row-${batchRowSeq}`, batchId: '' })
}

function removeBatchRow(index) {
  if (batchRows.value.length <= 1) return
  batchRows.value.splice(index, 1)
  rebuildBatchLines()
}

function selectBatchFromRoute(id) {
  if (!id) return
  mode.value = 'batch'
  const row = batchRows.value.find((item) => !item.batchId) || batchRows.value[0]
  if (!row) return
  if (batchRows.value.some((item) => item.batchId === id)) return
  row.batchId = id
  rebuildBatchLines()
}

function onMaterialsPicked(items) {
  const list = Array.isArray(items) ? items : []
  let added = 0
  list.forEach((item) => {
    const itemId = item.id || item.itemId
    if (!itemId) return
    if (lines.value.some((line) => line.itemId === itemId)) return
    lines.value.push({
      id: `mr-line-${itemId}`,
      itemId,
      itemCode: item.code || item.itemCode || '',
      itemName: item.name || item.itemName || '',
      specModel: item.specModel || '',
      unit: item.inventoryUnit || item.unit || 'kg',
      suggestedQty: null,
      shipQty: null,
      planQty: null,
      shipWarehouse: item.defaultWarehouse || '原料仓',
      lineSource: '手工添加',
    })
    added += 1
  })
  if (!added && list.length) message.info('所选物料已在明细中')
}

function removeLine(index) {
  lines.value.splice(index, 1)
}

function goBack() {
  router.push('/production/material-requisition')
}

onMounted(() => {
  selectBatchFromRoute(String(route.query.batchId || ''))
})

watch(
  () => route.query.batchId,
  (id) => selectBatchFromRoute(String(id || '')),
)

watch(mode, (value) => {
  if (value === 'quick') {
    lines.value = lines.value.filter((line) => line.lineSource !== '批次指令')
    return
  }
  rebuildBatchLines()
})

function onSubmit() {
  if (submitting.value) return
  if (mode.value === 'batch' && !selectedBatches.value.length) {
    message.warning('请选择批次指令')
    return
  }
  if (!form.workshop) {
    message.warning('请选择申请车间')
    return
  }
  if (!lines.value.length) {
    message.warning('请至少添加一条物料')
    return
  }
  for (const line of lines.value) {
    const qty = Number(line.shipQty)
    if (!qty || qty <= 0) {
      message.warning(`「${line.itemName || line.itemCode}」领料数量须大于 0`)
      return
    }
  }

  submitting.value = true
  const batches = mode.value === 'batch' ? selectedBatches.value : []
  const first = batches[0]
  const result = submitMaterialRequisition({
    mode: mode.value === 'batch' ? MATERIAL_REQ_MODES.BATCH_ORDER : MATERIAL_REQ_MODES.QUICK,
    workshop: form.workshop,
    receiveWarehouse: form.receiveWarehouse,
    remark: form.remark,
    lines: lines.value.map((line) => ({
      ...line,
      warehouseStockQty: warehouseQty(line),
    })),
    workOrderId: first?.id || '',
    workOrderCode: batches.map((row) => row.batchNo).join('、'),
    workOrderName: first?.formulaName || '',
    productName: first ? itemMasterCard(first.itemId).name : lines.value[0]?.itemName || '',
    sourceChannel: 'web',
    applicant: '管理员',
  })
  submitting.value = false
  if (!result.ok) {
    message.warning(result.message || '提交失败')
    return
  }
  message.success(
    result.record.auditStatus === '审核通过'
      ? `已提交并自动通过 ${result.record.reqNo}`
      : `已提交 ${result.record.reqNo}，待审核`,
  )
  router.push(`/production/material-requisition/${result.record.id}`)
}

syncReceiveWarehouse()
</script>

<style lang="less" scoped>
.mr-create-page {
  margin: -12px;
  padding: 12px;
  height: calc(100vh - 56px - 40px - 24px);
  min-width: 0;
  background: var(--page-bg, #f0f2f5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.page-header {
  flex-shrink: 0;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  padding: 10px 16px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.page-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.section-card {
  min-width: 0;
  width: 100%;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 8px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;

  .section-title {
    margin-bottom: 0;
  }
}

.mode-tabs {
  margin-bottom: 8px;
}

.mode-hint {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.batch-pick-table {
  margin-bottom: 8px;
}

.add-batch-btn {
  margin-top: 8px;
}

.selected-tip {
  margin-top: 8px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.cell-placeholder {
  color: rgba(0, 0, 0, 0.25);
}

.qty-with-unit {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.qty-input {
  width: 110px;
}

.qty-unit {
  flex-shrink: 0;
  color: rgba(0, 0, 0, 0.65);
}
</style>
