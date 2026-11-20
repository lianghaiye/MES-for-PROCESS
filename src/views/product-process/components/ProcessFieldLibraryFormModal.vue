<template>
  <FormCreateShell
    :page-mode="pageMode"
    :open="open"
    :title="shellTitle"
    width="1100px"
    :mask-closable="false"
    @cancel="handleCancel"
    @update:open="(val) => emit('update:open', val)"
  >
    <div class="process-field-library-form">
      <QcFieldEditorForm
        :model="form"
        show-code
        hide-judge
        :code-disabled="isEdit"
        @update:model="onModelUpdate"
      />
    </div>
    <template #footer>
      <a-space>
        <a-button :size="pageMode ? 'small' : 'middle'" @click="handleCancel">取消</a-button>
        <a-button
          type="primary"
          :size="pageMode ? 'small' : 'middle'"
          :loading="saving"
          @click="handleSave"
        >
          保存
        </a-button>
      </a-space>
    </template>
  </FormCreateShell>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import FormCreateShell from '@/components/FormCreateShell.vue'
import { useFormCreateModal } from '@/composables/useFormCreateModal'
import { useTabs } from '@/composables/useTabs'
import QcFieldEditorForm from '@/views/quality/components/QcFieldEditorForm.vue'
import {
  addProcessLibraryField,
  getProcessLibraryFieldById,
  updateProcessLibraryField,
} from '@/store/processFieldLibraryStore'
import {
  QC_FIELD_JUDGE_RULE,
  QC_UNIT_POSITION,
  pickFieldStandardProps,
} from '@/utils/qcFieldStandard'
import {
  ensureChildFieldCodes,
  pickComplexFieldProps,
  validateComplexFieldConfig,
} from '@/utils/qcComplexField'

defineOptions({ name: 'ProcessFieldLibraryFormModal' })

const props = defineProps({
  open: { type: Boolean, default: false },
  pageMode: { type: Boolean, default: false },
  listPath: { type: String, default: '/product-process/process-field-library' },
  editRecord: { type: Object, default: null },
  recordId: { type: String, default: '' },
})

const emit = defineEmits(['update:open', 'saved', 'cancel'])
const route = useRoute()
const router = useRouter()
const { openTab, closeTab } = useTabs()
const saving = ref(false)
const form = reactive(emptyForm())

const returnTo = computed(() => String(route.query.returnTo || '').trim())
const returnTitle = computed(() => String(route.query.returnTitle || '').trim())

const editingId = computed(() => {
  if (props.editRecord?.id) return props.editRecord.id
  if (props.recordId) return String(props.recordId).trim()
  return String(route.query.id || '').trim() || ''
})
const isEdit = computed(() => Boolean(editingId.value))

const { isActive, shellTitle, handleCancel, closeAfterSave } = useFormCreateModal(props, emit, {
  listPath: '/product-process/process-field-library',
  getTitle: () => (isEdit.value ? '编辑采集指标' : '新增采集指标'),
})

/** 从过程记录模板跳转新建时：保存后回到模板并带入字段 */
function finishAfterSave(field) {
  emit('saved', field)
  if (props.pageMode && returnTo.value && !isEdit.value && field?.id) {
    const resolved = router.resolve(returnTo.value)
    const nextQuery = { ...resolved.query, injectFieldId: field.id }
    const fullPath = router.resolve({ path: resolved.path, query: nextQuery }).fullPath
    closeTab(route.path)
    openTab(fullPath, returnTitle.value || undefined)
    router.push({ path: resolved.path, query: nextQuery })
    return
  }
  closeAfterSave()
}

function emptyForm() {
  return {
    code: '',
    name: '',
    indicatorKind: 'basic',
    type: 'number',
    category: '执行',
    required: false,
    withUnit: false,
    unit: '',
    unitPosition: QC_UNIT_POSITION.SUFFIX,
    allowDecimal: true,
    placeholder: '',
    description: '',
    optionRows: [],
    defaultValue: '',
    format: '',
    charLimit: null,
    judgeRule: QC_FIELD_JUDGE_RULE.NONE,
    standardMin: '',
    standardMax: '',
    standardValue: '',
    passOptions: [],
    standardText: '',
    children: [],
    matrixColumns: [],
    matrixRows: [],
    matrixAllowAddRow: false,
    syncToLibrary: false,
    manualOptionItems: [],
    countByQty: false,
    status: '启用',
  }
}

function toOptionRows(options = [], defaultValue = '', optionRows = null) {
  if (Array.isArray(optionRows) && optionRows.length) {
    return optionRows.map((o) => ({
      value: String(o?.value ?? o ?? ''),
      isDefault: Boolean(o?.isDefault),
      allowFill: Boolean(o?.allowFill),
      fillPlaceholder: String(o?.fillPlaceholder ?? ''),
    }))
  }
  return (Array.isArray(options) ? options : []).map((v) => ({
    value: String(v || ''),
    isDefault: Boolean(defaultValue && String(v) === String(defaultValue)),
    allowFill: false,
    fillPlaceholder: '',
  }))
}

function loadChildrenForEdit(children = []) {
  return (children || []).map((c) => ({
    ...c,
    optionRows: toOptionRows(c.options || [], c.defaultValue, c.optionRows),
    judgeRule: QC_FIELD_JUDGE_RULE.NONE,
    placeholder: c.placeholder || '',
    defaultValue: c.defaultValue ?? '',
    unitPosition: c.unitPosition === 'prefix' ? 'prefix' : 'suffix',
  }))
}

function loadRecord(record) {
  const complex = pickComplexFieldProps(record)
  Object.assign(form, emptyForm(), {
    code: record.code || '',
    name: record.name || '',
    indicatorKind: record.type === 'composite' ? 'composite' : 'basic',
    type: record.type || 'text',
    category: record.category || '执行',
    required: Boolean(record.required),
    allowDecimal: record.allowDecimal !== false,
    withUnit: Boolean(record.withUnit),
    unit: record.unit || '',
    unitPosition: record.unitPosition || QC_UNIT_POSITION.SUFFIX,
    placeholder: record.placeholder || '',
    description: record.description || '',
    optionRows: toOptionRows(record.options || [], record.defaultValue, record.optionRows),
    defaultValue: record.defaultValue || '',
    format: record.format || '',
    charLimit: record.charLimit ?? null,
    ...complex,
    children: loadChildrenForEdit(complex.children || record.children || []),
    judgeRule: QC_FIELD_JUDGE_RULE.NONE,
    status: record.status || '启用',
  })
}

function resolveActiveRecord() {
  if (props.editRecord?.id) return props.editRecord
  const id = editingId.value
  if (id) return getProcessLibraryFieldById(id)
  return null
}

function onModelUpdate(next) {
  Object.assign(form, next, { judgeRule: QC_FIELD_JUDGE_RULE.NONE })
}

watch(
  () => [isActive.value, props.editRecord?.id, props.recordId, route.query.id],
  ([active]) => {
    if (!active) return
    const record = resolveActiveRecord()
    if (record) loadRecord(record)
    else Object.assign(form, emptyForm())
  },
  { immediate: true },
)

function handleSave() {
  if (!form.type) {
    message.warning(form.indicatorKind === 'composite' ? '请选择复合类型' : '请选择字段类型')
    return
  }
  if (form.type === 'matrix') {
    message.warning('多点项暂未开放')
    return
  }
  if (!String(form.name || '').trim()) {
    message.warning(form.type === 'composite' ? '请输入父项名称' : '请输入指标名称')
    return
  }
  if (form.withUnit && !String(form.unit || '').trim()) {
    message.warning('请输入单位')
    return
  }
  const complexCheck = validateComplexFieldConfig({
    ...form,
    judgeRule: QC_FIELD_JUDGE_RULE.NONE,
  })
  if (!complexCheck.ok) {
    message.warning(complexCheck.message)
    return
  }
  const isChoice = form.type === 'radio' || form.type === 'checkbox'
  const optionRows = isChoice
    ? (form.optionRows || [])
        .map((o) => ({
          value: String(o.value || '').trim(),
          isDefault: Boolean(o.isDefault),
          allowFill: Boolean(o.allowFill),
          fillPlaceholder: String(o.fillPlaceholder || '').trim(),
        }))
        .filter((o) => o.value)
    : []
  const options = optionRows.map((o) => o.value)
  if (isChoice && !options.length) {
    message.warning('请至少添加一个选项')
    return
  }

  const defaultValue = isChoice
    ? String(optionRows.find((o) => o.isDefault)?.value || form.defaultValue || '').trim()
    : form.defaultValue || ''

  const children =
    form.type === 'composite'
      ? (complexCheck.children || ensureChildFieldCodes(form.children)).map((c) => ({
          ...c,
          judgeRule: QC_FIELD_JUDGE_RULE.NONE,
        }))
      : []

  const standard = pickFieldStandardProps({
    ...form,
    options,
    judgeRule: QC_FIELD_JUDGE_RULE.NONE,
  })
  const complex = pickComplexFieldProps({ ...form, children, judgeRule: QC_FIELD_JUDGE_RULE.NONE })
  const payload = {
    code: String(form.code || '').trim(),
    name: String(form.name).trim(),
    type: form.type,
    category: form.category || '执行',
    status: form.status || '启用',
    required: Boolean(form.required),
    allowDecimal: form.type === 'number' ? Boolean(form.allowDecimal) : false,
    placeholder: form.placeholder || '',
    description: form.description || '',
    options,
    optionRows,
    defaultValue,
    format: form.format || '',
    charLimit: form.charLimit,
    ...standard,
    ...complex,
    children,
    judgeRule: QC_FIELD_JUDGE_RULE.NONE,
    standardText: form.type === 'composite' ? '含多个采集子项' : '',
  }

  saving.value = true
  try {
    const res = isEdit.value
      ? updateProcessLibraryField(editingId.value, payload)
      : addProcessLibraryField(payload)
    if (!res.ok) {
      message.warning(res.message || '保存失败')
      return
    }
    message.success(isEdit.value ? '采集指标已更新' : `已创建 ${res.field.code}`)
    finishAfterSave(res.field)
  } finally {
    saving.value = false
  }
}
</script>

<style lang="less" scoped>
.process-field-library-form {
  width: 100%;
}
</style>
