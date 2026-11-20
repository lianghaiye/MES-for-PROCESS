<template>
  <a-modal
    v-model:open="visible"
    :title="modalTitle"
    :width="720"
    :mask-closable="false"
    destroy-on-close
    @cancel="handleCancel"
  >
    <div class="modal-basic-card">
      <div class="section-title">基本信息</div>
      <a-form layout="inline" class="horizontal-form" :model="form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="12">
            <a-form-item label="规则名称">
              <a-input
                v-model:value="form.name"
                size="small"
                allow-clear
                :disabled="readonly"
                placeholder="不填则默认用所属业务名称"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="规则编码">
              <a-input
                v-model:value="form.code"
                size="small"
                allow-clear
                :maxlength="30"
                show-count
                :disabled="readonly || isEdit"
                placeholder="不填则系统自动生成"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="所属业务" required>
              <a-select
                v-model:value="form.business"
                size="small"
                allow-clear
                show-search
                option-filter-prop="label"
                :disabled="readonly"
                placeholder="请选择所属业务"
                :options="BUSINESS_OPTIONS"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="段落数" required>
              <a-select
                v-model:value="form.segmentCount"
                size="small"
                :disabled="readonly"
                :options="SEGMENT_COUNT_OPTIONS"
                style="width: 100%"
                @change="onSegmentCountChange"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="段落分隔符" required>
              <a-select
                v-model:value="separatorForm"
                size="small"
                :disabled="readonly"
                :options="SEPARATOR_OPTIONS"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="状态" required>
              <a-switch
                v-model:checked="statusEnabled"
                :disabled="readonly"
                checked-children="启用"
                un-checked-children="禁用"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注" class="remark-item">
              <a-textarea
                v-model:value="form.remark"
                :rows="2"
                size="small"
                :maxlength="200"
                show-count
                :disabled="readonly"
                placeholder="选填，最多 200 字"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <div class="preview-bar">
      <span class="preview-label">编码预览：</span>
      <span class="preview-value">{{ previewText || '—' }}</span>
    </div>

    <div v-for="(seg, index) in form.segments" :key="seg.id || index" class="segment-card">
      <div class="segment-title">段落 {{ index + 1 }}</div>
      <a-form layout="inline" class="horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="12">
            <a-form-item label="规则类型" required>
              <a-select
                v-model:value="seg.type"
                size="small"
                show-search
                option-filter-prop="label"
                :disabled="readonly"
                :options="SEGMENT_TYPE_OPTIONS"
                style="width: 100%"
                @change="() => onSegmentTypeChange(seg)"
              />
            </a-form-item>
          </a-col>
          <a-col v-if="seg.type === SEGMENT_TYPE.CONSTANT" :span="12">
            <a-form-item label="设置值" required>
              <a-input
                v-model:value="seg.value"
                size="small"
                allow-clear
                :disabled="readonly"
                placeholder="如 XSDD、PO"
              />
            </a-form-item>
          </a-col>
          <a-col v-else-if="seg.type === SEGMENT_TYPE.DATE" :span="12">
            <a-form-item label="日期格式" required>
              <a-select
                v-model:value="seg.dateFormat"
                size="small"
                :disabled="readonly"
                :options="DATE_FORMAT_OPTIONS"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <template v-else-if="seg.type === SEGMENT_TYPE.SERIAL">
            <a-col :span="8">
              <a-form-item label="流水长度" required>
                <a-input-number
                  v-model:value="seg.serialLength"
                  size="small"
                  :min="1"
                  :max="12"
                  :precision="0"
                  :disabled="readonly"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="起始值" required>
                <a-input-number
                  v-model:value="seg.serialStart"
                  size="small"
                  :min="0"
                  :precision="0"
                  :disabled="readonly"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="重置周期" required>
                <a-select
                  v-model:value="seg.serialReset"
                  size="small"
                  :disabled="readonly"
                  :options="SERIAL_RESET_OPTIONS"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
          </template>
          <a-col v-else-if="seg.type === SEGMENT_TYPE.BIZ_FIELD" :span="12">
            <a-form-item label="业务字段" required>
              <a-input
                v-model:value="seg.fieldKey"
                size="small"
                allow-clear
                :disabled="readonly"
                placeholder="如 warehouseCode"
              />
            </a-form-item>
          </a-col>
          <a-col v-else-if="seg.type === SEGMENT_TYPE.INPUT" :span="12">
            <a-form-item label="参数名" required>
              <a-input
                v-model:value="seg.paramKey"
                size="small"
                allow-clear
                :disabled="readonly"
                placeholder="生成时传入的参数名"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <template #footer>
      <a-space>
        <a-button @click="handleCancel">{{ readonly ? '关闭' : '取消' }}</a-button>
        <a-button v-if="!readonly" type="primary" :loading="saving" @click="handleSave">
          保存
        </a-button>
      </a-space>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  BUSINESS_OPTIONS,
  DATE_FORMAT_OPTIONS,
  RULE_STATUS,
  SEGMENT_COUNT_OPTIONS,
  SEGMENT_TYPE,
  SEGMENT_TYPE_OPTIONS,
  SEPARATOR_OPTIONS,
  SERIAL_RESET_OPTIONS,
  addCodingRule,
  createEmptySegments,
  fromSeparatorFormValue,
  previewCodeByRule,
  toSeparatorFormValue,
  updateCodingRule,
} from '@/store/codingRuleStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  record: { type: Object, default: null },
  mode: { type: String, default: 'edit' }, // create | edit | view
})

const emit = defineEmits(['update:open', 'saved'])

const visible = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const isEdit = computed(() => Boolean(props.record?.id) && props.mode !== 'create')
const readonly = computed(() => props.mode === 'view')
const modalTitle = computed(() => {
  if (props.mode === 'view') return '编码规则数据-查看'
  if (isEdit.value) return '编码规则数据-编辑'
  return '编码规则数据-新增'
})

const saving = ref(false)

const form = reactive({
  name: '',
  code: '',
  business: undefined,
  segmentCount: 3,
  separator: '-',
  status: RULE_STATUS.ENABLED,
  remark: '',
  segments: createEmptySegments(3),
})

const statusEnabled = computed({
  get: () => form.status === RULE_STATUS.ENABLED,
  set: (val) => {
    form.status = val ? RULE_STATUS.ENABLED : RULE_STATUS.DISABLED
  },
})

const separatorForm = computed({
  get: () => toSeparatorFormValue(form.separator),
  set: (val) => {
    form.separator = fromSeparatorFormValue(val)
  },
})

const previewText = computed(() =>
  previewCodeByRule({
    ...form,
    segments: form.segments,
  }),
)

function resetForm() {
  form.name = ''
  form.code = ''
  form.business = undefined
  form.segmentCount = 3
  form.separator = '-'
  form.status = RULE_STATUS.ENABLED
  form.remark = ''
  form.segments = createEmptySegments(3)
}

function fillForm(record) {
  form.name = record.name || ''
  form.code = record.code || ''
  form.business = record.business || undefined
  form.segmentCount = record.segmentCount || record.segments?.length || 3
  form.separator = record.separator == null ? '-' : record.separator
  form.status = record.status === RULE_STATUS.DISABLED ? RULE_STATUS.DISABLED : RULE_STATUS.ENABLED
  form.remark = record.remark || ''
  const segs = Array.isArray(record.segments) ? record.segments.map((s) => ({ ...s })) : []
  while (segs.length < form.segmentCount) {
    segs.push(...createEmptySegments(1).map((s, i) => ({ ...s, id: `${s.id}-${i}` })))
  }
  form.segments = segs.slice(0, form.segmentCount)
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    if (props.record?.id) fillForm(props.record)
    else resetForm()
  },
)

function onSegmentCountChange(count) {
  const n = Number(count) || 1
  const next = [...form.segments]
  if (next.length < n) {
    const extras = createEmptySegments(n - next.length)
    next.push(...extras)
  }
  form.segments = next.slice(0, n)
  form.segmentCount = n
}

function onSegmentTypeChange(seg) {
  if (seg.type === SEGMENT_TYPE.CONSTANT) {
    seg.value = seg.value || ''
  } else if (seg.type === SEGMENT_TYPE.DATE) {
    seg.dateFormat = seg.dateFormat || 'yyyyMMdd'
  } else if (seg.type === SEGMENT_TYPE.SERIAL) {
    seg.serialLength = seg.serialLength || 4
    seg.serialStart = seg.serialStart ?? 1
    seg.serialReset = seg.serialReset || 'month'
  } else if (seg.type === SEGMENT_TYPE.BIZ_FIELD) {
    seg.fieldKey = seg.fieldKey || ''
  } else if (seg.type === SEGMENT_TYPE.INPUT) {
    seg.paramKey = seg.paramKey || ''
  }
}

function handleCancel() {
  visible.value = false
}

function handleSave() {
  saving.value = true
  const payload = {
    name: form.name,
    code: form.code,
    business: form.business,
    segmentCount: form.segmentCount,
    separator: form.separator,
    status: form.status,
    remark: form.remark,
    segments: form.segments.map((s) => ({ ...s })),
  }
  const res = isEdit.value ? updateCodingRule(props.record.id, payload) : addCodingRule(payload)
  saving.value = false
  if (!res.ok) {
    message.warning(res.message)
    return
  }
  message.success(isEdit.value ? '保存成功' : '新增成功')
  emit('saved')
  visible.value = false
}
</script>

<style lang="less" scoped>
.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.preview-bar {
  margin: 12px 0;
  padding: 8px 12px;
  background: #e7f3f1;
  border-radius: 6px;
  font-size: 13px;
  color: #307068;
}

.preview-label {
  font-weight: 600;
}

.preview-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.segment-card {
  margin-bottom: 12px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid var(--divider, #e5e6eb);
  border-radius: 8px;
}

.segment-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
</style>
