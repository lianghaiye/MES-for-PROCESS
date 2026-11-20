<template>
  <div class="process-batch-page">
    <div class="table-card">
      <div class="toolbar">
        <a-button type="primary" size="small" @click="open = true">登记收货批次</a-button>
        <a-space>
          <a-input-number v-model:value="shipQty" size="small" :min="0" placeholder="发货量" />
          <span class="item-select"
            ><MasterItemSelect v-model="shipItem" placeholder="请选择物料"
          /></span>
          <a-button size="small" @click="ship">近效期发货</a-button>
        </a-space>
      </div>
      <a-table :columns="columns" :data-source="rows" row-key="id" size="small" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="color(record.status)">{{ BATCH_STATUS_LABEL[record.status] }}</a-tag>
          </template>
          <template v-else-if="column.key === 'item'">{{ itemLabel(record.itemId) }}</template>
          <template v-else-if="column.key === 'expiryDate'">
            {{ record.expiryDate || '—' }}
          </template>
          <template v-else-if="column.key === 'expiryAlert'">
            <a-tag v-if="expiryHint(record).type === 'soon'" color="warning">
              {{ expiryHint(record).text }}
            </a-tag>
            <a-tag v-else-if="expiryHint(record).type === 'expired'" color="error">
              {{ expiryHint(record).text }}
            </a-tag>
            <span v-else>—</span>
          </template>
          <template v-else-if="column.key === 'loc'">{{ tankName(record.locationId) }}</template>
          <template v-else-if="column.key === 'action'">
            <a-button
              v-if="record.status === 'pending'"
              type="link"
              size="small"
              @click="pass(record.id)"
              >来料放行</a-button
            >
            <a-button
              v-if="record.status === 'pending'"
              type="link"
              size="small"
              danger
              @click="fail(record.id)"
              >不合格</a-button
            >
            <a-button type="link" size="small" @click="showTrace(record)">追溯</a-button>
          </template>
        </template>
      </a-table>
    </div>

    <a-modal
      :open="open"
      title="采购收货生成原料批次"
      :width="640"
      :mask-closable="false"
      @cancel="open = false"
      @ok="save"
    >
      <div class="modal-basic-card">
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="12">
              <a-form-item label="物料" required>
                <MasterItemSelect v-model="form.itemId" placeholder="请选择物料" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="数量" required>
                <a-input-number
                  v-model:value="form.qty"
                  size="small"
                  :min="0"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="供应商批号" required>
                <a-input v-model:value="form.supplierBatchNo" size="small" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="含量">
                <a-input-number
                  v-model:value="form.content"
                  size="small"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="生产日期" required>
                <a-input
                  v-model:value="form.productionDate"
                  size="small"
                  placeholder="YYYY-MM-DD"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="失效日期" required>
                <a-input v-model:value="form.expiryDate" size="small" placeholder="YYYY-MM-DD" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="储罐" required>
                <a-select v-model:value="form.locationId" size="small" :options="tankOptions" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </div>
      <p class="hint">收货后默认待检。来料放行后才允许投料和发货。</p>
    </a-modal>

    <a-modal
      :open="traceOpen"
      title="批次追溯"
      :width="640"
      :footer="null"
      @cancel="traceOpen = false"
    >
      <p>原料批次：{{ trace.batch?.batchNo || '—' }}</p>
      <p>投进指令：{{ feedText }}</p>
      <p>作为产出：{{ outputText }}</p>
      <p>返工指令：{{ reworkText }}</p>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { itemLabel } from '@/store/processFormulaStore'
import MasterItemSelect from '@/views/product-process/components/MasterItemSelect.vue'
import {
  BATCH_STATUS_LABEL,
  listMaterialBatches,
  listProcessItems,
  listTanks,
  receiveMaterialBatch,
  setBatchStatus,
  shipByFefo,
} from '@/store/materialBatchStore'
import { traceByBatch } from '@/store/batchInstructionStore'
import { findMasterItemByCode } from '@/utils/stockAlertDisplay'
import { resolveExpiryAlert } from '@/utils/expiryAlert'
import '@/styles/process-batch-page.less'

const open = ref(false)
const shipQty = ref(10)
const shipItem = ref('pi-solvent')
const traceOpen = ref(false)
const trace = ref({})
const form = reactive({
  itemId: 'pi-solvent',
  qty: 50,
  supplierBatchNo: '',
  content: 0.8,
  productionDate: '',
  expiryDate: '',
  locationId: 'silo-1',
})

const tankOptions = computed(() => listTanks().map((t) => ({ value: t.id, label: t.name })))
const columns = [
  { title: '批次号', dataIndex: 'batchNo', width: 160 },
  { title: '物料', key: 'item' },
  { title: '状态', key: 'status', width: 90 },
  { title: '重量', dataIndex: 'qty', align: 'right', width: 90 },
  { title: '含量', dataIndex: 'content', align: 'right', width: 80 },
  { title: '失效日期', key: 'expiryDate', dataIndex: 'expiryDate', width: 120 },
  { title: '效期预警', key: 'expiryAlert', width: 120 },
  { title: '位置', key: 'loc', width: 120 },
  { title: '供应商批号', dataIndex: 'supplierBatchNo' },
  { title: '操作', key: 'action', width: 200 },
]
const rows = computed(() => listMaterialBatches())

function tankName(id) {
  return listTanks().find((t) => t.id === id)?.name || '—'
}

function expiryHint(record) {
  const item = listProcessItems().find((row) => row.id === record.itemId)
  const master = findMasterItemByCode(item?.code)
  return resolveExpiryAlert(record.expiryDate, master?.item?.alert)
}
function color(status) {
  if (status === 'released') return 'success'
  if (status === 'rejected' || status === 'expired') return 'error'
  return 'warning'
}
function save() {
  try {
    receiveMaterialBatch(form)
    open.value = false
    message.success('已生成待检原料批次')
  } catch (error) {
    message.error(error.message)
  }
}
function pass(id) {
  try {
    setBatchStatus(id, 'released')
    message.success('来料已放行，可以投料')
  } catch (error) {
    message.error(error.message)
  }
}
function fail(id) {
  setBatchStatus(id, 'rejected')
  message.success('已判不合格')
}
function ship() {
  try {
    const used = shipByFefo(shipItem.value, shipQty.value)
    message.success(`已按近效期发出：${used.map((u) => `${u.batchNo} ${u.qty}`).join('，')}`)
  } catch (error) {
    message.error(error.message)
  }
}
function showTrace(record) {
  trace.value = traceByBatch(record.id)
  traceOpen.value = true
}
const feedText = computed(
  () => (trace.value.asFeed || []).map((f) => `${f.orderNo} ${f.qty}`).join('，') || '—',
)
const outputText = computed(
  () => (trace.value.asOutput || []).map((o) => o.batchNo).join('，') || '—',
)
const reworkText = computed(
  () => (trace.value.rework || []).map((o) => o.batchNo).join('，') || '—',
)
</script>

<style scoped>
.modal-basic-card {
  padding: 12px 16px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}
.hint {
  color: #4e5969;
  font-size: 13px;
}
.item-select {
  display: inline-block;
  width: 180px;
}
</style>
