<template>
  <a-modal
    :open="open"
    title="生成批次指令"
    :width="720"
    :mask-closable="false"
    destroy-on-close
    @cancel="emit('cancel')"
  >
    <div class="modal-basic-card">
      <div class="section-title">基本信息</div>
      <a-form layout="inline" class="horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="12">
            <a-form-item label="计划">
              <a-input :value="planLabel" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="基准批量">
              <a-input :value="baseText" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="目标投料量">
              <a-input :value="qtyText(coverage.target)" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="已挂计划投料">
              <a-input :value="qtyText(coverage.linkedQty)" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="剩余">
              <a-input :value="qtyText(coverage.remaining)" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="张数" required>
              <a-input-number
                v-model:value="count"
                size="small"
                :min="1"
                :max="200"
                :disabled="!coverage.remaining"
                style="width: 100%"
                @change="resizeLines"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>
    <div class="section-title lines-title">指令明细</div>
    <a-table
      size="small"
      :columns="columns"
      :data-source="lines"
      :pagination="false"
      row-key="key"
      :scroll="{ y: 280 }"
      :locale="{ emptyText: '剩余目标投料量已用完' }"
    >
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'seq'">{{ index + 1 }}</template>
        <template v-else-if="column.key === 'qty'">
          <a-input-number
            v-model:value="record.qty"
            size="small"
            :min="0.001"
            :precision="3"
            style="width: 100%"
          />
        </template>
        <template v-else-if="column.key === 'note'">{{ noteOf(record.qty) }}</template>
      </template>
    </a-table>
    <div class="split-hint">{{ hint }}</div>
    <template #footer>
      <a-button @click="emit('cancel')">取消</a-button>
      <a-button type="primary" :disabled="!lines.length" :loading="saving" @click="submit">
        生成 ({{ lines.length }})
      </a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { executeFeedPlan, getFeedPlan, planFeedCoverage } from '@/store/feedPlanStore'
import { round3, splitPlanFeedQty } from '@/utils/processBatchMath'

const props = defineProps({
  open: { type: Boolean, default: false },
  planId: { type: String, default: '' },
})

const emit = defineEmits(['cancel', 'done'])

const columns = [
  { title: '序号', key: 'seq', width: 70, align: 'center' },
  { title: '计划投料量 (kg)', key: 'qty', width: 180 },
  { title: '说明', key: 'note' },
]

const count = ref(1)
const lines = ref([])
const saving = ref(false)
let lineKey = 0

const plan = computed(() => (props.planId ? getFeedPlan(props.planId) : null))
const coverage = computed(() => planFeedCoverage(props.planId))
const planLabel = computed(() => {
  const row = plan.value
  if (!row) return '—'
  return `${row.planNo || ''} ${row.periodLabel || ''}`.trim() || '—'
})
const baseText = computed(() => (coverage.value.base > 0 ? `${coverage.value.base} kg` : '未设置'))
const sumQty = computed(() =>
  round3(lines.value.reduce((sum, row) => sum + (Number(row.qty) || 0), 0)),
)
const hint = computed(() => {
  if (!coverage.value.remaining) return '这张计划的目标投料量已经分完，不能再生成。'
  if (!coverage.value.base)
    return '配方没有基准批量，默认把剩余目标做成一张。可以改张数和每张计划投料量。'
  const over = sumQty.value > coverage.value.remaining + 1e-9
  return `整批等于基准批量，余数单独一张，不向上取整。本次合计 ${sumQty.value} kg${
    over ? '，已超过剩余目标' : ''
  }。`
})

function qtyText(value) {
  return `${round3(value) || 0} kg`
}

function noteOf(qty) {
  const base = coverage.value.base
  const value = Number(qty)
  if (!(value > 0)) return '请填写计划投料量'
  if (!(base > 0)) return '按剩余目标'
  if (Math.abs(value - base) < 1e-9) return '基准批量'
  if (value < base) return '不足一个基准批量'
  return '超过基准批量'
}

function nextLine(qty) {
  lineKey += 1
  return { key: lineKey, qty }
}

function fillDefault() {
  const rows = splitPlanFeedQty(coverage.value.remaining, coverage.value.base)
  lines.value = rows.map((row) => nextLine(row.qty))
  count.value = Math.max(1, lines.value.length)
}

function resizeLines() {
  const next = Math.max(1, Math.min(200, Number(count.value) || 1))
  count.value = next
  const base = coverage.value.base > 0 ? coverage.value.base : coverage.value.remaining
  while (lines.value.length < next) lines.value.push(nextLine(base))
  if (lines.value.length > next) lines.value.splice(next)
}

function submit() {
  const qtys = lines.value.map((row) => Number(row.qty))
  if (qtys.some((qty) => !(qty > 0))) {
    message.warning('每张计划投料量都要大于 0')
    return
  }
  saving.value = true
  try {
    const created = executeFeedPlan(props.planId, { qtys })
    message.success(`已生成 ${created.length} 张批次指令`)
    emit('done', created)
  } catch (error) {
    message.warning(error.message || '生成失败')
  } finally {
    saving.value = false
  }
}

watch(
  () => [props.open, props.planId],
  ([open]) => {
    if (!open) return
    fillDefault()
  },
  { immediate: true },
)
</script>

<script>
export default { name: 'GeneratePlanBatchModal' }
</script>

<style scoped>
.section-title {
  margin-bottom: 8px;
  color: #1f2329;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.lines-title {
  margin-top: 12px;
}

.split-hint {
  margin-top: 8px;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
}
</style>
