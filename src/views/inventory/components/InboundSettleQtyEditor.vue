<template>
  <div class="settle-entry">
    <a-form-item required>
      <template #label>
        <span class="field-label">结算数量合计（{{ settleUnit }}）</span>
      </template>
      <a-input-number
        :value="line.settleQty"
        :min="0.0001"
        :precision="4"
        size="small"
        :formatter="inputNumberFormatter"
        :parser="inputNumberParser"
        placeholder="本行合计"
        style="width: 100%"
        @update:value="onTotalInput"
      />
      <div class="vl-tip">结算单位（{{ settleUnit }}）与库存单位分开计，只填本行结算合计。</div>
    </a-form-item>
  </div>
</template>

<script setup>
/** 结算数量：流程型仅合计，已去掉统一单件/逐件 */
import { computed } from 'vue'
import { inputNumberFormatter, inputNumberParser } from '@/utils/numberFormat'
import { SETTLE_ENTRY_MODE } from '@/utils/inboundLineHelpers'
import { resolveSettleUnit } from '@/utils/settleUnit'

const props = defineProps({
  line: { type: Object, required: true },
})

const emit = defineEmits(['patch'])

const settleUnit = computed(() => resolveSettleUnit(props.line) || 'kg')

function onTotalInput(value) {
  emit('patch', {
    settleEntryMode: SETTLE_ENTRY_MODE.TOTAL,
    settleQty: value,
    settleUniformValue: undefined,
    settlePieceValues: undefined,
  })
}
</script>

<style lang="less" scoped>
.settle-entry {
  width: 100%;
  margin-bottom: 4px;
}

.field-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.vl-tip {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 1.5;
}
</style>
