<template>
  <div class="process-batch-page">
    <div class="table-card">
      <div class="toolbar"><span>液位 = 罐内批次重量之和，不能超过罐容</span></div>
      <a-table :columns="columns" :data-source="rows" row-key="id" size="small" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'kind'">{{
            record.kind === 'silo' ? '料仓' : '储罐'
          }}</template>
          <template v-else-if="column.key === 'level'"
            >{{ record.level }} / {{ record.capacity }}</template
          >
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openTransfer(record)">罐间转移</a-button>
          </template>
        </template>
      </a-table>
    </div>
    <a-modal
      :open="open"
      title="罐间转移"
      :width="520"
      :mask-closable="false"
      @cancel="open = false"
      @ok="save"
    >
      <a-form layout="inline" class="horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="24">
            <a-form-item label="源批次" required>
              <a-select v-model:value="form.batchId" size="small" :options="batchOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="目标罐" required>
              <a-select v-model:value="form.toLocationId" size="small" :options="tankOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="重量" required>
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
import { message } from 'ant-design-vue'
import { itemLabel } from '@/store/processFormulaStore'
import { listMaterialBatches, listTanks, tankLevel, transferTank } from '@/store/materialBatchStore'
import '@/styles/process-batch-page.less'

const open = ref(false)
const form = reactive({ batchId: undefined, toLocationId: undefined, qty: null })
const columns = [
  { title: '名称', dataIndex: 'name' },
  { title: '类型', key: 'kind', width: 100 },
  { title: '液位 / 罐容', key: 'level', align: 'right' },
  { title: '操作', key: 'action', width: 120 },
]
const rows = computed(() => listTanks().map((tank) => ({ ...tank, level: tankLevel(tank.id) })))
const tankOptions = computed(() => listTanks().map((t) => ({ value: t.id, label: t.name })))
const batchOptions = computed(() =>
  listMaterialBatches()
    .filter((b) => Number(b.qty) > 0)
    .map((b) => ({ value: b.id, label: `${b.batchNo} ${itemLabel(b.itemId)} ${b.qty}` })),
)

function openTransfer(record) {
  form.toLocationId = listTanks().find((t) => t.id !== record.id)?.id
  open.value = true
}
function save() {
  try {
    transferTank(form)
    open.value = false
    message.success('罐间转移已过账')
  } catch (error) {
    message.error(error.message)
  }
}
</script>
