<template>
  <a-modal
    :open="open"
    title="生成批次指令"
    :width="720"
    :mask-closable="false"
    destroy-on-close
    @cancel="emit('update:open', false)"
  >
    <div class="modal-basic-card">
      <div class="section-title">基本信息</div>
      <a-form layout="inline" class="horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="12">
            <a-form-item label="生效配方" required>
              <a-select
                v-model:value="formulaId"
                size="small"
                :options="formulaOptions"
                placeholder="请选择"
                @change="refreshPreview"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="需求量" required>
              <a-input-number
                v-model:value="demandQty"
                size="small"
                :min="0"
                style="width: 100%"
                @change="refreshPreview"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="来源">
              <a-input
                v-model:value="sourceLabel"
                size="small"
                placeholder="销售订单号或手工需求"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>
    <p class="hint">
      按基准批量向上取整，每一批都是完整基准批量。需求 100、基准批量 30 时生成 4
      张。同一产品可以有多张生效配方，打开时优先选中默认配方。
    </p>
    <a-table
      :columns="columns"
      :data-source="preview"
      :pagination="false"
      size="small"
      row-key="seq"
    />
    <template #footer>
      <a-button @click="emit('update:open', false)">取消</a-button>
      <a-button type="primary" :loading="saving" @click="submit"
        >确定 ({{ preview.length }})</a-button
      >
    </template>
  </a-modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { planBatchCount } from '@/utils/processBatchMath'
import { itemLabel, listActiveFormulas } from '@/store/processFormulaStore'
import { createOrdersFromDemand } from '@/store/batchInstructionStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  presetDemand: { type: Number, default: null },
  presetSource: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'created'])

const formulaId = ref()
const demandQty = ref(100)
const sourceLabel = ref('')
const saving = ref(false)
const preview = ref([])

const formulaOptions = computed(() =>
  listActiveFormulas()
    .slice()
    .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)))
    .map((f) => {
      const mark = f.isDefault ? '（默认）' : ''
      return {
        value: f.id,
        label: `${f.formulaNo} ${f.name}${mark}（${itemLabel(f.itemId)} / ${f.baseBatchQty}kg）`,
      }
    }),
)
const columns = [
  { title: '批序', dataIndex: 'seq', width: 80 },
  { title: '批量', dataIndex: 'qtyText' },
  { title: '理论产出', dataIndex: 'outputText' },
]

watch(
  () => props.open,
  (val) => {
    if (!val) return
    demandQty.value = props.presetDemand || 100
    sourceLabel.value = props.presetSource || ''
    const defaults = listActiveFormulas().filter((row) => row.isDefault)
    formulaId.value = defaults.length === 1 ? defaults[0].id : undefined
    refreshPreview()
  },
)

function refreshPreview() {
  const formula = listActiveFormulas().find((f) => f.id === formulaId.value)
  const count = formula ? planBatchCount(demandQty.value, formula.baseBatchQty) : 0
  preview.value = Array.from({ length: count }, (_, i) => ({
    seq: `${i + 1}/${count}`,
    qtyText: formula ? `${formula.baseBatchQty} kg` : '—',
    outputText: formula
      ? `${Math.round(formula.baseBatchQty * formula.theoreticalYield * 1000) / 1000} kg`
      : '—',
  }))
}

function submit() {
  saving.value = true
  try {
    const created = createOrdersFromDemand({
      formulaId: formulaId.value,
      demandQty: demandQty.value,
      sourceLabel: sourceLabel.value,
    })
    message.success(`已生成 ${created.length} 张批次指令`)
    emit('created', created)
    emit('update:open', false)
  } catch (error) {
    message.error(error.message || '生成失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.modal-basic-card {
  margin-bottom: 12px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}
.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
}
.hint {
  color: #4e5969;
  font-size: 13px;
}
</style>
