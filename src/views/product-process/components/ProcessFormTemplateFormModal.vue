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
    <div class="modal-basic-card">
      <div class="section-title">基本信息</div>
      <a-form ref="formRef" layout="inline" class="horizontal-form" :model="form" :rules="rules">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="8">
            <a-form-item label="模板编码" name="code">
              <a-input v-model:value="form.code" size="small" placeholder="留空自动生成" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="模板名称" name="name" required>
              <a-input v-model:value="form.name" size="small" placeholder="如：投料记录" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="状态">
              <a-switch
                v-model:checked="form.enabled"
                checked-children="启用"
                un-checked-children="停用"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注" class="remark-item">
              <a-textarea v-model:value="form.remark" :rows="2" size="small" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <div class="fields-section">
      <div class="fields-header">
        <div>
          <h4>模板指标</h4>
          <div class="fields-hint">
            从「采集指标库」选用系统项（操作人、操作时间等）及其他采集指标，或点「新增采集指标」创建。过程记录不做合格判定；字段可拖拽排序、编辑、删除。
          </div>
        </div>
        <a-space size="small">
          <a-button size="small" @click="pickOpen = true">从采集指标库添加</a-button>
          <a-button type="primary" size="small" @click="openCreateField">
            <PlusOutlined />
            新增采集指标
          </a-button>
        </a-space>
      </div>

      <a-table
        v-if="form.fields.length"
        :columns="fieldColumns"
        :data-source="form.fields"
        :row-key="fieldRowKey"
        size="small"
        bordered
        :pagination="false"
        :custom-row="customFieldRow"
        children-column-name="__noTreeChildren__"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'drag'">
            <span class="drag-handle" title="拖拽排序" @mousedown.stop>
              <HolderOutlined />
            </span>
          </template>
          <template v-else-if="column.key === 'index'">{{ index + 1 }}</template>
          <template v-else-if="column.key === 'type'">
            <a-tag :color="fieldTypeTagColor(record.type)">{{
              qcFieldTypeLabel(record.type)
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'fieldKind'">
            <a-tag v-if="isProcessFormSystemField(record)" color="blue">系统</a-tag>
            <a-tag v-else color="default">自定义</a-tag>
          </template>
          <template v-else-if="column.key === 'required'">
            <a-tag :color="record.required ? 'blue' : 'default'">{{
              record.required ? '必填' : '非必填'
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'unit'">
            {{ displayFieldUnit(record) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openFieldModal(record)">编辑</a-button>
              <a-button type="link" size="small" danger @click="removeField(record)">删除</a-button>
            </a-space>
          </template>
          <template v-else>
            {{ record[column.dataIndex] || '—' }}
          </template>
        </template>
      </a-table>
      <p v-else class="empty-hint">请从采集指标库添加指标，或新增采集指标</p>
    </div>

    <template #footer>
      <a-button :size="pageMode ? 'small' : 'middle'" @click="handleCancel">取消</a-button>
      <a-button
        type="primary"
        :size="pageMode ? 'small' : 'middle'"
        :loading="saving"
        @click="handleSave"
      >
        保存
      </a-button>
    </template>

    <ProcessFieldLibraryPickModal
      v-model:open="pickOpen"
      :existing-fields="form.fields"
      @confirm="onPickFields"
    />

    <FormCreateShell
      :open="fieldModalOpen"
      :title="editingFieldIndex != null ? '编辑模板指标' : '新增模板指标'"
      width="1100px"
      :mask-closable="false"
      @cancel="closeFieldModal"
      @update:open="(val) => (fieldModalOpen = val)"
    >
      <QcFieldEditorForm
        :model="fieldForm"
        show-code
        hide-judge
        :code-disabled="editingFieldIndex != null"
        @update:model="(next) => Object.assign(fieldForm, next)"
      />
      <template #footer>
        <a-button @click="closeFieldModal">取消</a-button>
        <a-button type="primary" @click="saveField">确定</a-button>
      </template>
    </FormCreateShell>
  </FormCreateShell>
</template>

<script setup>
import { computed, onActivated, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { HolderOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import FormCreateShell from '@/components/FormCreateShell.vue'
import { useFormCreateModal } from '@/composables/useFormCreateModal'
import { useTabs } from '@/composables/useTabs'
import { findCreatePageByListPath } from '@/config/createPages'
import { openCreateTab } from '@/utils/openCreateTab'
import {
  isCreatePageBootstrapped,
  loadCreatePageDraft,
  saveCreatePageDraft,
} from '@/utils/createPageDraft'
import {
  fieldTypeTagColor,
  processLibraryFieldToTemplateField,
  qcFieldTypeLabel,
} from '@/mock/processFieldLibrary'
import {
  addProcessFormTemplate,
  getProcessFormTemplateById,
  updateProcessFormTemplate,
} from '@/store/processFormTemplateStore'
import { getProcessLibraryFieldById } from '@/store/processFieldLibraryStore'
import { isProcessFormSystemField } from '@/utils/processFormSystemField'
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
import ProcessFieldLibraryPickModal from '@/views/product-process/components/ProcessFieldLibraryPickModal.vue'
import QcFieldEditorForm from '@/views/quality/components/QcFieldEditorForm.vue'

defineOptions({ name: 'ProcessFormTemplateFormModal' })

const props = defineProps({
  open: { type: Boolean, default: false },
  pageMode: { type: Boolean, default: false },
  listPath: { type: String, default: '/product-process/process-form' },
  recordId: { type: String, default: '' },
})

const emit = defineEmits(['update:open', 'saved', 'cancel'])
const route = useRoute()
const router = useRouter()
const { openTab } = useTabs()

const TEMPLATE_DRAFT_PATH = '/product-process/process-form/new'
const fieldLibraryCreatePage = findCreatePageByListPath('/product-process/process-field-library')

const formRef = ref()
const saving = ref(false)
const pickOpen = ref(false)
const formBootstrapped = ref(false)
const fieldModalOpen = ref(false)
const editingFieldIndex = ref(null)

const editingId = computed(() => {
  if (props.recordId) return String(props.recordId).trim()
  return String(route.query.id || '').trim() || ''
})

const { isActive, shellTitle, handleCancel, closeAfterSave } = useFormCreateModal(props, emit, {
  listPath: '/product-process/process-form',
  getTitle: () => (editingId.value ? '编辑过程记录模板' : '新增过程记录模板'),
})

const form = reactive({
  code: '',
  name: '',
  enabled: true,
  remark: '',
  fields: [],
})

const fieldForm = reactive(emptyFieldForm())

const rules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
}

const fieldColumns = [
  { title: '', key: 'drag', width: 36, align: 'center' },
  { title: '序号', key: 'index', width: 56, align: 'center' },
  { title: '字段名称', dataIndex: 'name', width: 120 },
  { title: '字段类型', key: 'type', width: 110 },
  { title: '类型', key: 'fieldKind', width: 80, align: 'center' },
  { title: '必填', key: 'required', width: 80, align: 'center' },
  { title: '单位', key: 'unit', width: 88 },
  { title: '输入提示', dataIndex: 'placeholder', ellipsis: true },
  { title: '操作', key: 'action', width: 110 },
]

const dragFieldIndex = ref(null)
const dragOverFieldIndex = ref(null)

function emptyFieldForm() {
  return {
    code: '',
    name: '',
    indicatorKind: 'basic',
    type: 'number',
    format: '',
    required: false,
    withUnit: false,
    unit: '',
    unitPosition: QC_UNIT_POSITION.SUFFIX,
    allowDecimal: true,
    description: '',
    placeholder: '',
    optionRows: [],
    defaultValue: '',
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

function displayFieldUnit(record) {
  if (!record?.withUnit && !record?.unit) return '—'
  const unit = String(record.unit || '').trim()
  if (!unit) return '—'
  return record.unitPosition === 'prefix' ? `${unit}（前）` : `${unit}（后）`
}

function fieldRowKey(record, index) {
  return String(record?.code || `field-${index}`)
}

function customFieldRow(_record, index) {
  return {
    draggable: true,
    class: {
      'field-row-dragging': dragFieldIndex.value === index,
      'field-row-drag-over': dragOverFieldIndex.value === index && dragFieldIndex.value !== index,
    },
    onDragstart: (e) => onFieldDragStart(index, e),
    onDragover: (e) => onFieldDragOver(index, e),
    onDragleave: () => onFieldDragLeave(index),
    onDrop: (e) => onFieldDrop(index, e),
    onDragend: onFieldDragEnd,
  }
}

function onFieldDragStart(index, e) {
  dragFieldIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(index))
}

function onFieldDragOver(index, e) {
  if (dragFieldIndex.value == null) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dragOverFieldIndex.value = index
}

function onFieldDragLeave(index) {
  if (dragOverFieldIndex.value === index) dragOverFieldIndex.value = null
}

function onFieldDrop(index, e) {
  e.preventDefault()
  const from = dragFieldIndex.value
  dragOverFieldIndex.value = null
  dragFieldIndex.value = null
  if (from == null || from === index) return
  const list = form.fields.map((f) => ({ ...f }))
  const [item] = list.splice(from, 1)
  list.splice(index, 0, item)
  form.fields = list
  captureDraft()
}

function onFieldDragEnd() {
  dragFieldIndex.value = null
  dragOverFieldIndex.value = null
}

function resetForm() {
  form.code = ''
  form.name = ''
  form.enabled = true
  form.remark = ''
  form.fields = []
}

function loadEdit(row) {
  form.code = row.code || ''
  form.name = row.name || ''
  form.enabled = row.status !== '停用'
  form.remark = row.remark || ''
  form.fields = (row.fields || []).map((f) => ({ ...f }))
}

function captureDraft() {
  if (!props.pageMode) return
  if (!formBootstrapped.value && !isCreatePageBootstrapped(TEMPLATE_DRAFT_PATH)) return
  saveCreatePageDraft(TEMPLATE_DRAFT_PATH, {
    code: form.code,
    name: form.name,
    enabled: form.enabled,
    remark: form.remark,
    fields: form.fields.map((f) => ({ ...f })),
    editingId: editingId.value,
  })
}

function restoreDraft() {
  const draft = loadCreatePageDraft(TEMPLATE_DRAFT_PATH)
  if (!draft) return false
  form.code = draft.code || ''
  form.name = draft.name || ''
  form.enabled = draft.enabled !== false
  form.remark = draft.remark || ''
  form.fields = Array.isArray(draft.fields) ? draft.fields.map((f) => ({ ...f })) : []
  formBootstrapped.value = true
  return true
}

function injectFieldById(fieldId) {
  const lib = getProcessLibraryFieldById(fieldId)
  if (!lib) return false
  const code = String(lib.code || '')
    .trim()
    .toUpperCase()
  if (!code) return false
  if (
    form.fields.some(
      (f) =>
        String(f.code || '')
          .trim()
          .toUpperCase() === code,
    )
  ) {
    message.info(`指标「${lib.name || lib.code}」已在模板中`)
    return true
  }
  form.fields.push({
    ...processLibraryFieldToTemplateField(lib),
    sortOrder: form.fields.length + 1,
  })
  message.success(`已带入采集指标「${lib.name || lib.code}」`)
  captureDraft()
  return true
}

function clearInjectQuery() {
  if (!route.query.injectFieldId) return
  const q = { ...route.query }
  delete q.injectFieldId
  router.replace({ path: route.path, query: q })
}

function initFromRoute() {
  if (!isActive.value) return

  if (props.pageMode) {
    const injectId = String(route.query.injectFieldId || '').trim()
    const already = formBootstrapped.value || isCreatePageBootstrapped(TEMPLATE_DRAFT_PATH)

    if (already || injectId) {
      if (!formBootstrapped.value) restoreDraft()
      if (injectId) {
        injectFieldById(injectId)
        clearInjectQuery()
      }
      return
    }

    if (restoreDraft()) return

    if (editingId.value) {
      const row = getProcessFormTemplateById(editingId.value)
      if (row) loadEdit(row)
      else resetForm()
    } else {
      resetForm()
    }
    formBootstrapped.value = true
    captureDraft()
    return
  }

  if (editingId.value) {
    const row = getProcessFormTemplateById(editingId.value)
    if (row) loadEdit(row)
    else resetForm()
  } else {
    resetForm()
  }
}

watch(
  () => [isActive.value, props.recordId, route.query.id, route.query.injectFieldId],
  () => initFromRoute(),
  { immediate: true },
)

onActivated(() => {
  if (props.pageMode && route.query.injectFieldId) initFromRoute()
})

function onPickFields(rows) {
  const existing = new Set(
    form.fields.map((f) =>
      String(f.code || '')
        .trim()
        .toUpperCase(),
    ),
  )
  const added = []
  ;(rows || []).forEach((lib) => {
    const code = String(lib.code || '')
      .trim()
      .toUpperCase()
    if (!code || existing.has(code)) return
    existing.add(code)
    added.push({
      ...processLibraryFieldToTemplateField(lib),
      sortOrder: form.fields.length + added.length + 1,
    })
  })
  form.fields.push(...added)
  if (added.length) message.success(`已添加 ${added.length} 个指标`)
  captureDraft()
}

function removeField(record) {
  const index = form.fields.indexOf(record)
  if (index < 0) return
  form.fields.splice(index, 1)
  captureDraft()
}

function openCreateField() {
  if (!fieldLibraryCreatePage) {
    message.warning('未配置新增页')
    return
  }
  formBootstrapped.value = true
  captureDraft()
  openCreateTab(router, openTab, {
    path: fieldLibraryCreatePage.newPath,
    title: fieldLibraryCreatePage.title,
    query: {
      returnTo: route.fullPath,
      returnTitle: shellTitle.value,
    },
  })
}

function openFieldModal(record) {
  const index = form.fields.indexOf(record)
  editingFieldIndex.value = index >= 0 ? index : null
  if (index >= 0 && form.fields[index]) {
    const f = form.fields[index]
    const unit = String(f.unit || '').trim()
    Object.assign(fieldForm, {
      ...emptyFieldForm(),
      code: f.code || '',
      name: f.name || '',
      indicatorKind: f.type === 'composite' ? 'composite' : 'basic',
      type: f.type || 'text',
      format: f.format || '',
      required: Boolean(f.required),
      withUnit: Boolean(f.withUnit) || Boolean(unit),
      unit,
      unitPosition: f.unitPosition === 'prefix' ? QC_UNIT_POSITION.PREFIX : QC_UNIT_POSITION.SUFFIX,
      allowDecimal: Boolean(f.allowDecimal),
      description: f.description || '',
      placeholder: f.placeholder || '',
      optionRows: toOptionRows(f.options || [], f.defaultValue, f.optionRows),
      defaultValue: f.defaultValue || '',
      charLimit: f.charLimit ?? null,
      ...pickFieldStandardProps({ ...f, judgeRule: QC_FIELD_JUDGE_RULE.NONE }),
      ...pickComplexFieldProps({ ...f, judgeRule: QC_FIELD_JUDGE_RULE.NONE }),
      children: (f.children || []).map((c) => ({
        ...c,
        optionRows: toOptionRows(c.options || [], c.defaultValue, c.optionRows),
        judgeRule: QC_FIELD_JUDGE_RULE.NONE,
        placeholder: c.placeholder || '',
        defaultValue: c.defaultValue ?? '',
        unitPosition: c.unitPosition === 'prefix' ? 'prefix' : 'suffix',
      })),
      judgeRule: QC_FIELD_JUDGE_RULE.NONE,
    })
  } else {
    Object.assign(fieldForm, emptyFieldForm())
  }
  fieldModalOpen.value = true
}

function closeFieldModal() {
  fieldModalOpen.value = false
  editingFieldIndex.value = null
}

function saveField() {
  if (!fieldForm.type) {
    message.warning(fieldForm.indicatorKind === 'composite' ? '请选择复合类型' : '请选择字段类型')
    return
  }
  if (!String(fieldForm.name || '').trim()) {
    message.warning(fieldForm.type === 'composite' ? '请输入父项名称' : '请输入指标名称')
    return
  }
  if (fieldForm.withUnit && !String(fieldForm.unit || '').trim()) {
    message.warning('请输入单位')
    return
  }
  const complexCheck = validateComplexFieldConfig({
    ...fieldForm,
    judgeRule: QC_FIELD_JUDGE_RULE.NONE,
  })
  if (!complexCheck.ok) {
    message.warning(complexCheck.message)
    return
  }
  const isChoice = fieldForm.type === 'radio' || fieldForm.type === 'checkbox'
  const optionRows = isChoice
    ? (fieldForm.optionRows || [])
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
  const children =
    fieldForm.type === 'composite'
      ? (complexCheck.children || ensureChildFieldCodes(fieldForm.children)).map((c) => ({
          ...c,
          judgeRule: QC_FIELD_JUDGE_RULE.NONE,
        }))
      : []
  const next = {
    ...processLibraryFieldToTemplateField({
      ...fieldForm,
      options,
      optionRows,
      children,
      judgeRule: QC_FIELD_JUDGE_RULE.NONE,
    }),
    code: String(fieldForm.code || '').trim(),
    name: String(fieldForm.name || '').trim(),
  }
  if (!next.code) {
    message.warning('请填写指标编码')
    return
  }
  const dup = form.fields.findIndex(
    (f, i) =>
      i !== editingFieldIndex.value &&
      String(f.code || '')
        .trim()
        .toUpperCase() === next.code.toUpperCase(),
  )
  if (dup >= 0) {
    message.warning(`编码「${next.code}」已存在`)
    return
  }
  if (editingFieldIndex.value != null && editingFieldIndex.value >= 0) {
    form.fields[editingFieldIndex.value] = {
      ...form.fields[editingFieldIndex.value],
      ...next,
    }
  } else {
    form.fields.push({ ...next, sortOrder: form.fields.length + 1 })
  }
  captureDraft()
  closeFieldModal()
  message.success('已更新模板指标')
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  if (!form.fields.length) {
    message.warning('请至少添加一个采集指标')
    return
  }
  saving.value = true
  const payload = {
    code: form.code,
    name: form.name,
    status: form.enabled ? '启用' : '停用',
    remark: form.remark,
    fields: form.fields.map((f, idx) => ({ ...f, sortOrder: idx + 1 })),
  }
  const res = editingId.value
    ? updateProcessFormTemplate(editingId.value, payload)
    : addProcessFormTemplate(payload)
  saving.value = false
  if (!res.ok) {
    message.warning(res.message || '保存失败')
    return
  }
  message.success('保存成功')
  emit('saved')
  closeAfterSave()
}
</script>

<style scoped lang="less">
.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.fields-section {
  margin-top: 12px;
}

.fields-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;

  h4 {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 600;
    color: #1f2329;
  }
}

.fields-hint {
  max-width: 720px;
  font-size: 12px;
  line-height: 18px;
  color: #86909c;
}

.empty-hint {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: #86909c;
  font-size: 13px;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.45);
  cursor: grab;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

:deep(.field-row-dragging) {
  opacity: 0.55;
}

:deep(.field-row-drag-over) > td {
  background: #e7f2f0 !important;
}

:deep(tr[draggable='true']) {
  cursor: grab;
}

.horizontal-form {
  width: 100%;

  :deep(.ant-form-item) {
    width: 100%;
    margin-inline-end: 0;
    margin-bottom: 0;
  }

  :deep(.ant-form-item-label) {
    flex: 0 0 88px;
    width: 88px;
    max-width: 88px;
  }
}
</style>
