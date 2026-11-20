<template>
  <div class="process-batch-page">
    <div class="table-card">
      <a-table :columns="columns" :data-source="rows" row-key="id" size="small" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'item'">{{ itemLabel(record.itemId) }}</template>
          <template v-else-if="column.key === 'gap'">{{ record.yieldGap ?? '—' }}</template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openDetail(record)">去入库</a-button>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTabs } from '@/composables/useTabs'
import { itemLabel } from '@/store/processFormulaStore'
import { batchInstructionState } from '@/store/batchInstructionStore'
import '@/styles/process-batch-page.less'

const router = useRouter()
const { openTab } = useTabs()
const columns = [
  { title: '批次号', dataIndex: 'batchNo' },
  { title: '主产品', key: 'item' },
  { title: '理论产出', dataIndex: 'theoreticalOutput', align: 'right' },
  { title: '实际产出', dataIndex: 'actualOutput', align: 'right' },
  { title: '得率差', key: 'gap', align: 'right' },
  { title: '操作', key: 'action', width: 100 },
]
const rows = computed(() =>
  batchInstructionState.orders.filter((o) => o.status === 'running' || o.outputs.length),
)
function openDetail(record) {
  const path = `/production/work-orders/${record.id}`
  openTab(path, record.batchNo)
  router.push(path)
}
</script>
