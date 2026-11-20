<template>
  <div class="process-batch-page">
    <div class="table-card">
      <div class="toolbar">
        <a-button type="primary" size="small" @click="open = true">新建返工</a-button>
      </div>
      <a-table :columns="columns" :data-source="rows" row-key="id" size="small" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'prev'">{{ batchNo(record.reworkOfBatchId) }}</template>
          <template v-else-if="column.key === 'next'">{{ nextBatch(record) }}</template>
          <template v-else-if="column.key === 'status'">
            <a-tag>{{ ORDER_STATUS_LABEL[record.status] }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openDetail(record)">执行</a-button>
          </template>
        </template>
      </a-table>
    </div>
    <a-modal
      :open="open"
      title="对原批次再加工"
      :width="520"
      :mask-closable="false"
      @cancel="open = false"
      @ok="save"
    >
      <a-form layout="inline" class="horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="24">
            <a-form-item label="原批次" required>
              <a-select v-model:value="form.batchId" size="small" :options="batchOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="返工批量" required>
              <a-input-number v-model:value="form.qty" size="small" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useTabs } from '@/composables/useTabs'
import {
  ORDER_STATUS_LABEL,
  batchInstructionState,
  createRework,
} from '@/store/batchInstructionStore'
import { getMaterialBatch, listMaterialBatches } from '@/store/materialBatchStore'
import { itemLabel } from '@/store/processFormulaStore'
import '@/styles/process-batch-page.less'

const router = useRouter()
const { openTab } = useTabs()
const open = ref(false)
const form = reactive({ batchId: undefined, qty: null })
const columns = [
  { title: '返工指令', dataIndex: 'batchNo' },
  { title: '前批次', key: 'prev' },
  { title: '后批次', key: 'next' },
  { title: '批量', dataIndex: 'qty', align: 'right' },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 80 },
]
const rows = computed(() => batchInstructionState.orders.filter((o) => o.reworkOfBatchId))
const batchOptions = computed(() =>
  listMaterialBatches()
    .filter((b) => b.status === 'released' && b.sourceType === 'output' && Number(b.qty) > 0)
    .map((b) => ({ value: b.id, label: `${b.batchNo} ${itemLabel(b.itemId)} 剩余 ${b.qty}` })),
)
function batchNo(id) {
  return getMaterialBatch(id)?.batchNo || '—'
}
function nextBatch(record) {
  return record.outputs?.[0]?.batchNo || '—'
}
function save() {
  try {
    const created = createRework({ sourceBatchId: form.batchId, qty: form.qty })
    open.value = false
    message.success(`已生成 ${created.batchNo}`)
  } catch (error) {
    message.error(error.message)
  }
}
function openDetail(record) {
  const path = `/production/work-orders/${record.id}`
  openTab(path, record.batchNo)
  router.push(path)
}
</script>
