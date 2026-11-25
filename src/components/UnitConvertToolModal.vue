<template>
  <!-- 克/毫升/升 → 公斤换算；只读结果，不自动写回业务明细 -->
  <a-modal
    :open="open"
    title="换算工具"
    :width="520"
    :mask-closable="true"
    destroy-on-close
    :z-index="zIndex"
    @cancel="close"
  >
    <div class="mode-switch">
      <div class="mode-switch-label">换算方式</div>
      <a-radio-group
        v-model:value="draft.unit"
        option-type="button"
        button-style="solid"
        size="small"
        :options="unitOptions"
      />
      <div class="mode-switch-hint">{{ modeHint }}</div>
    </div>
    <a-form layout="inline" class="horizontal-form">
      <a-row :gutter="[12, 8]" style="width: 100%">
        <a-col :span="12">
          <a-form-item label="数量">
            <a-input-number
              v-model:value="draft.qty"
              size="small"
              :min="0"
              :addon-after="unitAddon"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
        <a-col v-if="draft.unit !== 'g'" :span="12">
          <a-form-item label="密度">
            <a-input-number
              v-model:value="draft.density"
              size="small"
              :min="0"
              addon-after="kg/L"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
    <div class="convert-result-card">
      <span class="convert-result-label">折合公斤</span>
      <span class="convert-result-value">{{ kgText }}</span>
    </div>
    <p class="convert-tip">{{ tip }}</p>
    <template #footer>
      <a-button @click="close">关闭</a-button>
    </template>
  </a-modal>
</template>

<script setup>
/**
 * 通用体积/质量换算工具弹窗（对齐配方编辑 / 入库行编辑）。
 * 仅展示折合公斤，不写回清单；调用方自行把结果填到数量列。
 */
import { computed, reactive, watch } from 'vue'
import { convertToFeedKg } from '@/utils/processBatchMath'
import { formatNumber } from '@/utils/numberFormat'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** 叠加在表单弹窗之上时抬高层级 */
  zIndex: { type: Number, default: 1100 },
  tip: {
    type: String,
    default: '结果不会写入清单，请把公斤数自行填到对应行的数量。',
  },
})

const emit = defineEmits(['update:open'])

const unitOptions = [
  { value: 'g', label: '克' },
  { value: 'mL', label: '毫升' },
  { value: 'L', label: '升' },
]

const draft = reactive({ qty: null, unit: 'L', density: null })

const unitAddon = computed(() => ({ g: 'g', mL: 'mL', L: 'L' })[draft.unit] || 'g')

const modeHint = computed(() => {
  if (draft.unit === 'g') return '1000 g = 1 kg，不使用密度'
  if (draft.unit === 'mL') return '公斤 = 毫升 × 密度（kg/L）÷ 1000'
  return '公斤 = 升 × 密度（kg/L）'
})

const kgText = computed(() => {
  const kg = convertToFeedKg(draft.qty, draft.unit, draft.density)
  return kg == null ? '—' : `${formatNumber(kg, 4)} kg`
})

/** 每次打开重置输入，避免上次结果残留误导 */
watch(
  () => props.open,
  (visible) => {
    if (!visible) return
    draft.qty = null
    draft.unit = 'L'
    draft.density = null
  },
)

function close() {
  emit('update:open', false)
}
</script>

<style scoped>
.mode-switch {
  margin-bottom: 12px;
}

.mode-switch-label {
  margin-bottom: 6px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}

.mode-switch-hint,
.convert-tip {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 20px;
  color: rgba(0, 0, 0, 0.45);
}

.convert-result-card {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 12px;
  background: #e7f2f0;
  border: 1px solid #a9c6c2;
  border-radius: 6px;
}

.convert-result-label {
  color: rgba(0, 0, 0, 0.45);
  font-size: 13px;
}

.convert-result-value {
  color: rgba(0, 0, 0, 0.88);
  font-size: 16px;
  font-weight: 600;
}
</style>
