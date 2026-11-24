<template>
  <a-modal
    :open="open"
    title="生成批次指令"
    :width="960"
    :mask-closable="false"
    destroy-on-close
    @cancel="emit('cancel')"
  >
    <div class="modal-basic-card">
      <div class="section-title">基本信息</div>
      <a-form layout="inline" class="horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="8">
            <a-form-item label="生产计划">
              <a-input :value="planLabel" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="主产品">
              <a-input :value="productText" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="配方">
              <a-input :value="formulaText" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="8">
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
          <a-col v-if="formula" :span="24">
            <div class="plan-metric-bar">
              <div class="plan-metric-item">
                <div class="plan-metric-label">主原料</div>
                <div class="plan-metric-value">{{ selectedMaterials }}</div>
              </div>
              <div class="plan-metric-item">
                <div class="plan-metric-label">理论得率</div>
                <div class="plan-metric-value">{{ theoreticalYieldText }}</div>
              </div>
              <div class="plan-metric-item">
                <div class="plan-metric-label">理论产出</div>
                <div class="plan-metric-value accent">{{ theoreticalOutputText }}</div>
              </div>
            </div>
          </a-col>
          <a-col :span="24">
            <a-form-item label="拆分方式">
              <a-radio-group v-model:value="splitMode" size="small" @change="onModeChange">
                <a-radio-button value="by_count">按张数</a-radio-button>
                <a-radio-button value="by_qty">按投料量</a-radio-button>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col v-if="splitMode === 'by_count'" :span="8">
            <a-form-item label="张数" required>
              <a-input-number
                v-model:value="count"
                size="small"
                :min="1"
                :max="200"
                :disabled="!coverage.remaining"
                style="width: 100%"
                @change="resizeByCount"
              />
            </a-form-item>
          </a-col>
          <template v-else>
            <a-col :span="8">
              <a-form-item label="本次投料量" required>
                <a-input-number
                  v-model:value="feedQty"
                  size="small"
                  :min="0.001"
                  :step="0.001"
                  :formatter="inputNumberFormatter"
                  :parser="inputNumberParser"
                  addon-after="kg"
                  :disabled="!coverage.remaining"
                  style="width: 100%"
                  @change="rebuildByQty"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="向上取整">
                <a-switch v-model:checked="ceil" size="small" @change="rebuildByQty" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="预计张数">
                <a-input :value="String(lines.length || 0)" size="small" disabled />
              </a-form-item>
            </a-col>
          </template>
          <a-col :span="24">
            <a-form-item label="备注" class="remark-item">
              <a-textarea
                v-model:value="remark"
                :rows="2"
                size="small"
                placeholder="写入本次生成的每张批次指令"
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
      :data-source="displayLines"
      :pagination="false"
      row-key="key"
      :scroll="{ y: 320 }"
      :locale="{ emptyText: '剩余目标投料量已用完' }"
    >
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'seq'">{{ lines.length - index }}</template>
        <template v-else-if="column.key === 'batchNo'">
          <a-input
            v-model:value="record.batchNo"
            size="small"
            allow-clear
            placeholder="按编码规则预填"
          />
        </template>
        <template v-else-if="column.key === 'qty'">
          <a-input-number
            v-model:value="record.qty"
            size="small"
            :min="0.001"
            :step="0.001"
            :formatter="inputNumberFormatter"
            :parser="inputNumberParser"
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
import {
  executeFeedPlan,
  getFeedPlan,
  mainRawMaterialIds,
  planFeedCoverage,
} from '@/store/feedPlanStore'
import { previewNextBatchNos } from '@/store/batchInstructionStore'
import { getFormula, itemLabel, itemUnit } from '@/store/processFormulaStore'
import { round3, splitPlanFeedQty, theoreticalOutput } from '@/utils/processBatchMath'
import { inputNumberFormatter, inputNumberParser } from '@/utils/numberFormat'

const props = defineProps({
  open: { type: Boolean, default: false },
  planId: { type: String, default: '' },
})

const emit = defineEmits(['cancel', 'done'])

const columns = [
  { title: '序号', key: 'seq', width: 56, align: 'center' },
  { title: '批次号', key: 'batchNo', width: 180 },
  { title: '计划投料量 (kg)', key: 'qty', width: 150 },
  { title: '说明', key: 'note' },
]

const splitMode = ref('by_count')
const count = ref(1)
const feedQty = ref(null)
const ceil = ref(false)
const remark = ref('')
const lines = ref([])
const saving = ref(false)
let lineKey = 0

const plan = computed(() => (props.planId ? getFeedPlan(props.planId) : null))
const formula = computed(() => (plan.value ? getFormula(plan.value.formulaId) : null))
const coverage = computed(() => planFeedCoverage(props.planId))
const planLabel = computed(() => {
  const row = plan.value
  if (!row) return '—'
  return `${row.planNo || ''} ${row.periodLabel || ''}`.trim() || '—'
})
const productText = computed(() => {
  const id = plan.value?.itemId || formula.value?.itemId
  return id ? itemLabel(id) : '—'
})
const formulaText = computed(() => {
  const row = formula.value
  if (!row) return '—'
  return `${row.formulaNo || ''} ${row.name || ''}`.trim() || '—'
})
const baseText = computed(() => (coverage.value.base > 0 ? `${coverage.value.base} kg` : '未设置'))
const sumQty = computed(() =>
  round3(lines.value.reduce((sum, row) => sum + (Number(row.qty) || 0), 0)),
)
/** 倒序展示，余数/取整补足行固定在顶部可见。提交仍按拆分顺序。 */
const displayLines = computed(() => lines.value.slice().reverse())
const selectedMaterials = computed(() => {
  const ids = mainRawMaterialIds(formula.value)
  return ids.length ? ids.map((id) => itemLabel(id)).join('、') : '—'
})
const feedUnit = computed(() => {
  const ids = mainRawMaterialIds(formula.value)
  return ids.length ? itemUnit(ids[0]) : 'kg'
})
const outputUnit = computed(() =>
  formula.value?.itemId ? itemUnit(formula.value.itemId) : feedUnit.value,
)
const theoreticalYieldText = computed(() => {
  const rate = Number(formula.value?.theoreticalYield)
  if (!Number.isFinite(rate) || rate < 0) return '—'
  return rate <= 1 ? `${Math.round(rate * 1000) / 10}%` : String(rate)
})
const metricFeedQty = computed(() => {
  if (sumQty.value > 0) return sumQty.value
  if (splitMode.value === 'by_qty') return Number(feedQty.value) || 0
  return coverage.value.remaining || 0
})
const theoreticalOutputText = computed(() => {
  const row = formula.value
  const qty = metricFeedQty.value
  if (!row || !(qty > 0) || !Number.isFinite(Number(row.theoreticalYield))) return '—'
  return `${theoreticalOutput(qty, row.theoreticalYield)} ${outputUnit.value}`
})
const hint = computed(() => {
  if (!coverage.value.remaining) return '这张计划的目标投料量已经分完，不能再生成。'
  if (splitMode.value === 'by_qty') {
    if (!coverage.value.base) {
      return '配方没有基准批量，按投料量会合成一张。可改每张计划投料量；批次号已按编码规则预填，可改。'
    }
    return ceil.value
      ? `按投料量拆分，余数不足一个基准批量时向上取整为完整批量。本次合计 ${sumQty.value} kg。批次号已按编码规则预填，可改。`
      : `按投料量拆分，整批等于基准批量，余数单独一张。本次合计 ${sumQty.value} kg。批次号已按编码规则预填，可改。`
  }
  if (!coverage.value.base) {
    return '配方没有基准批量，默认把剩余目标做成一张。可以改张数和每张计划投料量。批次号已按编码规则预填，可改。'
  }
  const over = sumQty.value > coverage.value.remaining + 1e-9
  return `按张数拆分。本次合计 ${sumQty.value} kg${over ? '，已超过剩余目标' : ''}。批次号已按编码规则预填，可改；清空后提交时再自动生成。`
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

function nextLine(qty, batchNo = '') {
  lineKey += 1
  return { key: lineKey, qty, batchNo: batchNo || '' }
}

/** 空批次号按编码规则预填；已有内容保留（用户改过的不覆盖）。 */
function withPrefillBatchNos(rows) {
  const list = Array.isArray(rows) ? rows : []
  const emptyIdx = []
  list.forEach((row, index) => {
    if (!String(row.batchNo || '').trim()) emptyIdx.push(index)
  })
  if (!emptyIdx.length) return list
  const exclude = list.map((row) => String(row.batchNo || '').trim()).filter(Boolean)
  const nos = previewNextBatchNos(emptyIdx.length, { exclude })
  emptyIdx.forEach((index, i) => {
    list[index].batchNo = nos[i] || ''
  })
  return list
}

function fillDefault() {
  const remaining = coverage.value.remaining
  feedQty.value = remaining > 0 ? remaining : null
  ceil.value = false
  remark.value = ''
  splitMode.value = 'by_count'
  const rows = splitPlanFeedQty(remaining, coverage.value.base, { ceil: false })
  lines.value = withPrefillBatchNos(rows.map((row) => nextLine(row.qty)))
  count.value = Math.max(1, lines.value.length || 1)
}

function onModeChange() {
  if (splitMode.value === 'by_qty') {
    if (!(Number(feedQty.value) > 0)) {
      feedQty.value = coverage.value.remaining > 0 ? coverage.value.remaining : null
    }
    rebuildByQty()
    return
  }
  count.value = Math.max(1, lines.value.length || 1)
  resizeByCount()
}

function resizeByCount() {
  const next = Math.max(1, Math.min(200, Number(count.value) || 1))
  count.value = next
  const base = coverage.value.base > 0 ? coverage.value.base : coverage.value.remaining
  const prev = lines.value.slice()
  const nextLines = []
  for (let i = 0; i < next; i += 1) {
    const keep = prev[i]
    nextLines.push(nextLine(keep?.qty > 0 ? keep.qty : base, keep?.batchNo || ''))
  }
  lines.value = withPrefillBatchNos(nextLines)
}

function rebuildByQty() {
  const qty = Number(feedQty.value)
  if (!(qty > 0)) {
    lines.value = []
    return
  }
  const prev = lines.value.slice()
  const rows = splitPlanFeedQty(qty, coverage.value.base, { ceil: ceil.value })
  lines.value = withPrefillBatchNos(
    rows.map((row, index) => nextLine(row.qty, prev[index]?.batchNo || '')),
  )
  count.value = Math.max(1, lines.value.length || 1)
}

function submit() {
  const qtys = lines.value.map((row) => Number(row.qty))
  if (qtys.some((qty) => !(qty > 0))) {
    message.warning('每张计划投料量都要大于 0')
    return
  }
  const batchNos = lines.value.map((row) => String(row.batchNo || '').trim())
  const seen = new Set()
  for (const no of batchNos) {
    if (!no) continue
    if (seen.has(no)) {
      message.warning(`批次号「${no}」重复`)
      return
    }
    seen.add(no)
  }
  saving.value = true
  try {
    const created = executeFeedPlan(props.planId, {
      qtys,
      batchNos,
      productionLineId: '',
      ceil: splitMode.value === 'by_qty' ? ceil.value : false,
      remark: String(remark.value || '').trim(),
    })
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

.plan-metric-bar {
  display: flex;
  margin: 4px 0 8px;
  padding: 12px 4px;
  background: linear-gradient(180deg, #f7f9fc 0%, #f5f5f5 100%);
  border: 1px solid #ebedf0;
  border-radius: 8px;
}

.plan-metric-item {
  flex: 1;
  min-width: 0;
  padding: 0 16px;
  border-right: 1px solid #e8e8e8;

  &:last-child {
    border-right: none;
  }
}

.plan-metric-label {
  margin-bottom: 6px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1.4;
}

.plan-metric-value {
  color: rgba(0, 0, 0, 0.88);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-all;

  &.accent {
    color: #307068;
  }
}
</style>
