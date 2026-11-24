<template>
  <div class="process-batch-page">
    <div class="table-card">
      <div class="toolbar">
        <span
          >汇总待判定、待回用、待再提产出。待判定在化验后确认去向；待回用在指令投料选「回流料」；待再提可开再提指令。</span
        >
      </div>
      <a-table
        :columns="columns"
        :data-source="rows"
        row-key="key"
        size="small"
        :pagination="rows.length > 20 ? { pageSize: 20, size: 'small' } : false"
        :locale="{ emptyText: '暂无待处置产出' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'item'">{{ itemLabel(record.itemId) || '—' }}</template>
          <template v-else-if="column.key === 'role'">{{
            OUTPUT_ROLE_LABEL[record.role] || record.role || '—'
          }}</template>
          <template v-else-if="column.key === 'disposition'">{{
            OUTPUT_DISPOSITION_LABEL[record.disposition] || '—'
          }}</template>
          <template v-else-if="column.key === 'location'">{{
            locationName(record.locationId)
          }}</template>
          <template v-else-if="column.key === 'qty'">{{
            formatQtyWithUnit(record.qty, record.unit)
          }}</template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{
              BATCH_STATUS_LABEL[record.status] || record.status
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="goOrder(record)">打开指令</a-button>
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
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { message } from 'ant-design-vue'
import { useTabs } from '@/composables/useTabs'
import { formatQtyWithUnit } from '@/utils/numberFormat'
import { OUTPUT_DISPOSITION_LABEL, OUTPUT_ROLE_LABEL, itemLabel } from '@/store/processFormulaStore'
import { BATCH_STATUS_LABEL, listTanks } from '@/store/materialBatchStore'
import { createReextract, listPendingDispositionOutputs } from '@/store/batchInstructionStore'
import '@/styles/process-batch-page.less'

const { openTab } = useTabs()

const columns = [
  { title: '批次指令', dataIndex: 'orderNo', width: 150 },
  { title: '产出批次', dataIndex: 'batchNo', width: 160 },
  { title: '角色', key: 'role', width: 90 },
  { title: '物料', key: 'item', width: 160, ellipsis: true },
  { title: '处理方式', key: 'disposition', width: 90 },
  { title: '位置', key: 'location', width: 120 },
  { title: '剩余', key: 'qty', width: 120, align: 'right' },
  { title: '放行状态', key: 'status', width: 100 },
  { title: '登记时间', dataIndex: 'at', width: 150 },
  { title: '操作', key: 'action', width: 180 },
]

const rows = computed(() => listPendingDispositionOutputs())

function locationName(id) {
  if (!id) return '—'
  return listTanks().find((t) => t.id === id)?.name || '—'
}

function statusColor(status) {
  if (status === 'await_decide') return 'default'
  if (status === 'await_reuse') return 'processing'
  if (status === 'await_reextract') return 'warning'
  return 'default'
}

function goOrder(record) {
  openTab(`/production/work-orders/${record.orderId}`, `批次指令 ${record.orderNo}`)
}

function doReextract(record) {
  try {
    const created = createReextract({ sourceBatchId: record.batchId, qty: record.qty })
    message.success(`已生成再提指令 ${created.batchNo}`)
    openTab(`/production/work-orders/${created.id}`, `批次指令 ${created.batchNo}`)
  } catch (error) {
    message.error(error.message)
  }
}
</script>
