<template>
  <div class="material-req-detail-page">
    <div class="detail-sticky-bar">
      <div class="page-header">
        <div class="header-left">
          <template v-if="record">
            <span class="order-no">{{ record.reqNo }}</span>
            <a-tag :color="modeColor(record.mode)">{{ record.modeLabel }}</a-tag>
            <a-tag :color="auditColor(record.auditStatus)">{{ record.auditStatus }}</a-tag>
            <a-badge :status="statusBadge(record.outboundStatus)" :text="record.outboundStatus" />
          </template>
          <span v-else class="order-no">领料申请详情</span>
        </div>
        <a-space :size="8">
          <template v-if="record?.auditStatus === MATERIAL_REQ_AUDIT.PENDING">
            <a-button type="primary" size="small" @click="onApprove">审核通过</a-button>
            <a-button danger size="small" @click="onReject">审核驳回</a-button>
          </template>
          <a-button v-if="record" size="small" @click="openPrint">打印</a-button>
          <a-button size="small" @click="goBack">返回列表</a-button>
        </a-space>
      </div>

      <div v-if="record" class="detail-tabs-wrap">
        <a-tabs
          v-model:active-key="activeTab"
          class="detail-tabs detail-tabs-pill detail-tabs-pill--nav-only"
        >
          <a-tab-pane key="basic" tab="基本信息" />
          <a-tab-pane key="outbound" :tab="`出库信息 (${outboundRows.length})`" />
        </a-tabs>
      </div>
    </div>

    <template v-if="!record">
      <div class="tab-body">
        <a-empty description="申请单不存在或已删除" />
      </div>
    </template>

    <template v-else>
      <div class="tab-body">
        <template v-if="activeTab === 'basic'">
          <DetailSectionCard title="基本信息">
            <MaterialRequisitionBasicInfoSection :record="record" />
          </DetailSectionCard>

          <DetailSectionCard
            v-if="workOrderList.length"
            :title="`工单清单（${workOrderList.length}）`"
          >
            <a-table
              :columns="woColumns"
              :data-source="workOrderList"
              :row-key="(r) => r.id || r.code"
              size="small"
              bordered
              :pagination="false"
              :scroll="{ x: 1100 }"
            >
              <template #bodyCell="{ column, record: row }">
                <template v-if="column.key === 'productCode'">{{
                  row.productCode || '—'
                }}</template>
                <template v-else-if="column.key === 'specModel'">{{
                  row.specModel || '—'
                }}</template>
                <template v-else-if="column.key === 'material'">{{ row.material || '—' }}</template>
                <template v-else-if="column.key === 'drawingNo'">{{
                  row.drawingNo || '—'
                }}</template>
                <template v-else-if="column.key === 'bom'">{{ row.bom || '—' }}</template>
                <template v-else-if="column.key === 'planQty'">{{ row.planQty ?? '—' }}</template>
              </template>
            </a-table>
          </DetailSectionCard>

          <DetailSectionCard :title="`领料明细（${record.lineCount || 0} 项）`">
            <a-table
              :columns="lineColumns"
              :data-source="record.lines || []"
              row-key="id"
              size="small"
              bordered
              :pagination="false"
              :scroll="{ x: 1480 }"
              :locale="{ emptyText: '暂无领料明细' }"
            >
              <template #bodyCell="{ column, record: line, index }">
                <template v-if="column.key === 'seq'">{{ index + 1 }}</template>
                <template v-else-if="column.key === 'specModel'">{{
                  line.specModel || '—'
                }}</template>
                <template v-else-if="column.key === 'suggestedQty'">
                  {{ qtyWithUnit(line.suggestedQty ?? line.planQty, line.unit) }}
                </template>
                <template v-else-if="column.key === 'shipQty'">
                  {{ qtyWithUnit(line.shipQty, line.unit) }}
                </template>
                <template v-else-if="column.key === 'warehouseStockQty'">
                  {{ qtyWithUnit(warehouseQty(line), line.unit) }}
                </template>
                <template v-else-if="column.key === 'source'">{{ sourceText(line) }}</template>
                <template v-else-if="column.key === 'issuedBatch'">
                  {{ issuedBatchText(line) }}
                </template>
              </template>
              <template #summary>
                <a-table-summary v-if="(record.lines || []).length">
                  <a-table-summary-row class="line-summary-row">
                    <a-table-summary-cell
                      v-for="(col, colIndex) in lineColumns"
                      :key="col.key"
                      :index="colIndex"
                      :align="col.align"
                    >
                      <template v-if="col.key === 'seq'">合计</template>
                      <template v-else-if="col.key === 'shipQty'">{{
                        formatLineQty(lineQtyTotal)
                      }}</template>
                    </a-table-summary-cell>
                  </a-table-summary-row>
                </a-table-summary>
              </template>
            </a-table>
          </DetailSectionCard>
        </template>

        <template v-else-if="activeTab === 'outbound'">
          <DetailSectionCard title="出库信息">
            <a-table
              :columns="outboundColumns"
              :data-source="outboundRows"
              row-key="id"
              size="small"
              bordered
              :pagination="false"
              :scroll="{ x: outboundTableScrollX }"
              :locale="{ emptyText: '暂无出库信息' }"
            >
              <template #bodyCell="{ column, record: row, index }">
                <template v-if="column.key === 'index'">{{ index + 1 }}</template>
                <template v-else-if="column.key === 'outboundOrderNo'">
                  <a
                    v-if="row.outboundId || row.outboundOrderNo"
                    class="doc-link"
                    @click="goOutbound({ id: row.outboundId, docNo: row.outboundOrderNo })"
                  >
                    {{ row.outboundOrderNo || '—' }}
                  </a>
                  <span v-else>—</span>
                </template>
                <template v-else-if="column.key === 'applyQty'">
                  {{ formatQty(row.applyQty) }}
                </template>
                <template v-else-if="column.key === 'actualQty'">
                  {{ formatQty(row.actualQty) }}
                </template>
                <template v-else>
                  {{ row[column.dataIndex] || '—' }}
                </template>
              </template>
            </a-table>
          </DetailSectionCard>
        </template>
      </div>
    </template>

    <MaterialRequisitionPrintModal v-model:open="printModalOpen" :record="record" />
  </div>
</template>

<script>
export default { name: 'MaterialRequisitionDetailView' }
</script>

<script setup>
import DetailSectionCard from '@/components/DetailSectionCard.vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  getMobileMaterialReqById,
  refreshMobileMaterialReqs,
  approveMaterialRequisition,
  rejectMaterialRequisition,
  MATERIAL_REQ_MODES,
  MATERIAL_REQ_AUDIT,
} from '@/store/mobileMaterialReqStore'
import { outboundState } from '@/store/outboundStore'
import { workOrderState } from '@/store/workOrderStore'
import { assemblyWorkOrderState } from '@/store/assemblyWorkOrderStore'
import { getWorkOrderPlanQty } from '@/utils/workOrderScheduleBatch'
import { flattenMaterialReqOutboundLines } from '@/utils/materialReqOutboundLines'
import {
  createOutboundIssueLineColumns,
  getOutboundIssueLineScrollX,
} from '@/utils/outboundIssueLines'
import { formatNumber, formatQty } from '@/utils/numberFormat'
import { getWarehouseStockQty } from '@/utils/outboundLineHelpers'
import MaterialRequisitionBasicInfoSection from './components/MaterialRequisitionBasicInfoSection.vue'
import MaterialRequisitionPrintModal from './components/MaterialRequisitionPrintModal.vue'

const route = useRoute()
const router = useRouter()
const activeTab = ref('basic')
const printModalOpen = ref(false)

const record = computed(() => getMobileMaterialReqById(String(route.params.id || '')))

const outboundRows = computed(() => {
  void outboundState.orders
  return flattenMaterialReqOutboundLines(record.value)
})

const outboundColumns = createOutboundIssueLineColumns()
const outboundTableScrollX = getOutboundIssueLineScrollX(outboundColumns)

function findLinkedWorkOrder(row = {}) {
  const id = row.id
  const code = row.code
  return (
    workOrderState.orders.find((o) => (id && o.id === id) || (code && o.code === code)) ||
    assemblyWorkOrderState.orders.find((o) => (id && o.id === id) || (code && o.code === code)) ||
    null
  )
}

function enrichWorkOrderRow(row = {}) {
  const wo = findLinkedWorkOrder(row)
  const planQty =
    row.planQty != null && row.planQty !== ''
      ? row.planQty
      : wo
        ? getWorkOrderPlanQty(wo) || wo.scheduleQty
        : row.scheduleQty
  return {
    ...row,
    id: row.id || row.workOrderId || wo?.id || '',
    code: row.code || row.workOrderCode || wo?.code || '',
    productName: row.productName || wo?.productName || '—',
    productCode: row.productCode || wo?.productCode || wo?.materialCode || '',
    specModel: row.specModel || wo?.specModel || wo?.productSpec || '',
    material: row.material || wo?.material || '',
    drawingNo: row.drawingNo || wo?.drawingNo || '',
    bom: row.bom || wo?.bomLabel || wo?.bom || '',
    planQty,
  }
}

const workOrderList = computed(() => {
  const row = record.value
  if (!row) return []
  const list = Array.isArray(row.workOrders) ? row.workOrders : []
  if (list.length) return list.map(enrichWorkOrderRow)
  if (row.workOrderCode || row.workOrderId) {
    return [
      enrichWorkOrderRow({
        id: row.workOrderId,
        code: row.workOrderCode,
        productName: row.productName,
        productCode: row.productCode,
        specModel: row.specModel,
        material: row.material,
        drawingNo: row.drawingNo,
        bom: row.bom,
        planQty: row.planQty ?? row.scheduleQty,
        scheduleQty: row.scheduleQty,
      }),
    ]
  }
  return []
})

const woColumns = [
  { title: '工单号', dataIndex: 'code', key: 'code', width: 150 },
  { title: '产品', dataIndex: 'productName', key: 'productName', width: 140, ellipsis: true },
  { title: '编号', key: 'productCode', width: 120, ellipsis: true },
  { title: '规格型号', key: 'specModel', width: 110, ellipsis: true },
  { title: '材质', key: 'material', width: 90, ellipsis: true },
  { title: '图号', key: 'drawingNo', width: 110, ellipsis: true },
  { title: '关联BOM', key: 'bom', width: 140, ellipsis: true },
  { title: '计划数量', key: 'planQty', width: 100, align: 'right' },
]

const lineColumns = [
  { title: '序号', key: 'seq', width: 64, align: 'center', fixed: 'left' },
  { title: '物料编号', dataIndex: 'itemCode', key: 'itemCode', width: 140 },
  { title: '物料名称', dataIndex: 'itemName', key: 'itemName', width: 160, ellipsis: true },
  { title: '规格型号', key: 'specModel', width: 120, ellipsis: true },
  { title: '建议数量', key: 'suggestedQty', width: 130, align: 'right' },
  { title: '申请数量', key: 'shipQty', width: 130, align: 'right' },
  { title: '领料仓库', dataIndex: 'shipWarehouse', key: 'shipWarehouse', width: 140 },
  { title: '当前仓库数量', key: 'warehouseStockQty', width: 140, align: 'right' },
  { title: '来源', key: 'source', width: 160, ellipsis: true },
  { title: '已领批次', key: 'issuedBatch', width: 220 },
]

function issuedBatchText(line) {
  const req = record.value
  if (!req || !line) return '—'
  const ids = new Set((req.outboundOrders || []).map((order) => order.id).filter(Boolean))
  if (req.outboundId) ids.add(req.outboundId)
  const orders = outboundState.orders.filter(
    (order) => ids.has(order.id) || (req.id && order.materialReqId === req.id),
  )
  const nos = []
  orders.forEach((order) => {
    ;(order.lineItems || []).forEach((item) => {
      const code = item.itemCode || item.productCode || ''
      if (line.itemCode && code && code !== line.itemCode) return
      const text = item.issuedBatchNo || item.pickedBatchNo || ''
      if (text) nos.push(text)
    })
  })
  const unique = [...new Set(nos)]
  return unique.length ? unique.join('、') : '—'
}

function formatLineQty(value) {
  return formatNumber(value, 3, { empty: '—' })
}

function qtyWithUnit(value, unit) {
  if (value == null || value === '') return '—'
  const qty = formatLineQty(value)
  return unit ? `${qty} ${unit}` : qty
}

function warehouseQty(line) {
  if (line?.warehouseStockQty != null && line.warehouseStockQty !== '')
    return line.warehouseStockQty
  return getWarehouseStockQty(line?.shipWarehouse, line?.itemCode)
}

function sourceText(line) {
  if (line?.lineSource === '手工添加') return '手工添加'
  if (line?.sourceBatchNos?.length) return line.sourceBatchNos.join('、')
  if (line?.lineSource) return line.lineSource
  return '—'
}

const lineQtyTotal = computed(() =>
  (record.value?.lines || []).reduce((sum, line) => sum + (Number(line.shipQty) || 0), 0),
)

onMounted(() => {
  refreshMobileMaterialReqs()
})

function goBack() {
  router.push('/production/material-requisition')
}

function openPrint() {
  if (!record.value) {
    message.warning('申请单不存在，无法打印')
    return
  }
  printModalOpen.value = true
}

function goOutbound(link) {
  if (!link?.id) {
    message.info('暂无关联出库单详情')
    return
  }
  router.push(`/inventory/outbound/${link.id}`)
}

function onApprove() {
  Modal.confirm({
    title: '审核通过',
    content: `确认通过申请单 ${record.value.reqNo}？通过后将按仓库生成领料出库单。`,
    onOk() {
      const res = approveMaterialRequisition(record.value.id)
      if (!res.ok) {
        message.warning(res.message)
        return
      }
      const nos = res.record.outboundDocNo || ''
      message.success(nos ? `已通过，出库单 ${nos}` : '已通过')
      refreshMobileMaterialReqs()
      activeTab.value = 'outbound'
    },
  })
}

function onReject() {
  Modal.confirm({
    title: '审核驳回',
    content: `确认驳回申请单 ${record.value.reqNo}？`,
    okType: 'danger',
    onOk() {
      const res = rejectMaterialRequisition(record.value.id, '')
      if (!res.ok) {
        message.warning(res.message)
        return
      }
      message.success('已驳回')
      refreshMobileMaterialReqs()
    },
  })
}

function modeColor(mode) {
  if (mode === MATERIAL_REQ_MODES.QUICK) return 'purple'
  if (mode === MATERIAL_REQ_MODES.BATCH_ORDER) return 'blue'
  if (mode === MATERIAL_REQ_MODES.BATCH) return 'blue'
  return 'cyan'
}

function auditColor(status) {
  if (status === MATERIAL_REQ_AUDIT.APPROVED) return 'success'
  if (status === MATERIAL_REQ_AUDIT.REJECTED) return 'error'
  return 'warning'
}

function statusBadge(status) {
  const map = {
    待处理: 'warning',
    待出库: 'processing',
    已出库: 'success',
    已拒绝: 'error',
    拒绝领料: 'error',
    多单进行中: 'processing',
  }
  return map[status] || 'default'
}
</script>

<style lang="less" scoped>
.material-req-detail-page {
  margin: -12px;
  padding: 12px;
  height: calc(100vh - 112px);
  max-height: calc(100vh - 112px);
  min-height: 0;
  background: var(--page-bg, #f0f2f5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-sticky-bar {
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--page-bg, #f0f2f5);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  min-height: 48px;
  padding: 0 16px;
  box-sizing: border-box;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.order-no {
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.detail-sticky-bar .detail-tabs-wrap {
  flex-shrink: 0;
}

.tab-body {
  flex: 1;
  min-height: 0;
  padding: 8px 12px 16px;
  overflow: auto;
}

.section-card {
  background: #fff;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.section-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
}

.doc-link {
  color: #307068;
  cursor: pointer;
}

.blank-size-hint {
  margin-top: 2px;
  font-size: 11px;
  color: #d46b08;
  line-height: 1.25;
}

.line-summary-row {
  font-weight: 600;
}
</style>
