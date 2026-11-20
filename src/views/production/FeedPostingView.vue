<template>
  <div class="process-batch-page">
    <div class="table-card">
      <a-table
        :columns="columns"
        :data-source="rows"
        row-key="key"
        size="small"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'item'">{{ itemLabel(record.itemId) }}</template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { itemLabel } from '@/store/processFormulaStore'
import { listFeeds } from '@/store/batchInstructionStore'
import '@/styles/process-batch-page.less'

const columns = [
  { title: '批次指令', dataIndex: 'orderNo' },
  { title: '原料批次', dataIndex: 'batchNo' },
  { title: '物料', key: 'item' },
  { title: '投料量', dataIndex: 'qty', align: 'right' },
  { title: '含量', dataIndex: 'contentUsed', align: 'right' },
  { title: '步骤', dataIndex: 'stepNo', width: 80 },
  { title: '时间', dataIndex: 'at', width: 160 },
]
const rows = computed(() =>
  listFeeds().map((row, index) => ({ ...row, key: `${row.orderId}-${index}` })),
)
</script>
