<template>
  <FormCreateShell
    :page-mode="pageMode"
    :open="open"
    :title="shellTitle"
    width="1100px"
    @cancel="handleCancel"
    @update:open="(val) => emit('update:open', val)"
  >
    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      layout="inline"
      class="process-form horizontal-form"
    >
      <div class="form-section-box modal-basic-card">
        <div class="section-title">基本信息</div>
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="8" class="field-col">
            <a-form-item label="工序编码" name="code">
              <a-input
                v-model:value="form.code"
                size="small"
                placeholder="留空则自动生成 GX+流水"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8" class="field-col">
            <a-form-item label="工序名称" name="name" required>
              <a-input v-model:value="form.name" size="small" placeholder="请输入工序名称" />
            </a-form-item>
          </a-col>
          <a-col :span="8" class="field-col">
            <a-form-item label="工序分类" name="category" required>
              <a-select
                v-model:value="form.category"
                size="small"
                placeholder="请选择工序分类"
                :options="categoryOpts"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8" class="field-col">
            <a-form-item label="资源类型" name="resourceType" required>
              <a-select
                v-model:value="form.resourceType"
                size="small"
                placeholder="请选择"
                :options="resourceTypeOpts"
                style="width: 100%"
                @change="onResourceTypeChange"
              />
            </a-form-item>
          </a-col>
          <a-col :span="16" class="field-col">
            <a-form-item label="默认执行" name="defaultExecutors" required>
              <a-select
                v-model:value="form.defaultExecutors"
                mode="multiple"
                allow-clear
                show-search
                size="small"
                option-filter-prop="label"
                placeholder="输入搜索并多选岗位"
                :options="executorOpts"
                :max-tag-count="3"
                style="width: 100%"
                :open="executorDropdownOpen"
                @dropdown-visible-change="(open) => (executorDropdownOpen = open)"
              >
                <template #dropdownRender="{ menuNode: menu }">
                  <div>
                    <component :is="menu" />
                    <a-divider style="margin: 4px 0" />
                    <div class="search-more-row" @mousedown.prevent @click="openPositionPicker">
                      选择更多
                    </div>
                  </div>
                </template>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="转移条件" name="transferCondition" class="remark-item">
              <a-textarea
                v-model:value="form.transferCondition"
                size="small"
                placeholder="这段结束、转到下一段的条件，可不填"
                :rows="2"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="操作说明" name="instruction" class="remark-item">
              <a-textarea
                v-model:value="form.instruction"
                size="small"
                placeholder="给现场看这一步怎么做，可不填"
                :rows="3"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </div>

      <div class="form-section-box modal-basic-card">
        <div class="section-head">
          <div class="section-title">关联设备</div>
          <a-space :size="8">
            <a-button size="small" @click="openEquipmentBatchPicker">从台账选择</a-button>
            <a-button size="small" @click="addEquipmentRow">添加行</a-button>
          </a-space>
        </div>
        <p class="section-hint">本工序允许使用的设备，可不填。选中后自动带出型号、位置、状态。</p>
        <a-table
          :columns="equipmentColumns"
          :data-source="form.equipmentRows"
          :pagination="false"
          size="small"
          row-key="key"
          :locale="{ emptyText: '还没有关联设备' }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'seq'">{{ index + 1 }}</template>
            <template v-else-if="column.key === 'category'">
              <a-select
                v-model:value="record.category"
                allow-clear
                show-search
                size="small"
                option-filter-prop="label"
                placeholder="设备分类"
                :options="equipmentCategoryOpts"
                style="width: 100%"
                @change="() => onEquipmentRowCategoryChange(record)"
              />
            </template>
            <template v-else-if="column.key === 'equipment'">
              <EquipmentSearchSelect
                :model-value="record.equipmentId || ''"
                :multiple="false"
                :options="equipmentOptionsForRow(record)"
                :allow-ids="equipmentAllowIdsForRow(record)"
                :category-filter="record.category || ''"
                placeholder="请选择设备"
                @change="(id) => onEquipmentRowDeviceChange(record, id)"
              />
            </template>
            <template v-else-if="column.key === 'model'">
              <span class="readonly-cell">{{ deviceField(record.equipmentId, 'model') }}</span>
            </template>
            <template v-else-if="column.key === 'location'">
              <span class="readonly-cell">{{ deviceField(record.equipmentId, 'location') }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag
                v-if="deviceField(record.equipmentId, 'status') !== '—'"
                :color="equipmentStatusColor(deviceField(record.equipmentId, 'status'))"
              >
                {{ deviceField(record.equipmentId, 'status') }}
              </a-tag>
              <span v-else class="readonly-cell">—</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" danger @click="removeEquipmentRow(record.key)"
                >删除</a-button
              >
            </template>
          </template>
        </a-table>
      </div>

      <div class="form-section-box modal-basic-card">
        <div class="section-head">
          <div class="section-title">工艺参数</div>
          <a-button size="small" @click="addParam">添加参数</a-button>
        </div>
        <p class="section-hint">
          这里是这类作业要记录的参数。配方选中本工序时会带出，设定值可以按那张配方再改。
        </p>
        <a-table
          :columns="paramColumns"
          :data-source="form.params"
          :pagination="false"
          size="small"
          row-key="key"
          :locale="{ emptyText: '还没有参数' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <a-input v-model:value="record.name" size="small" placeholder="如温度" />
            </template>
            <template v-else-if="column.key === 'unit'">
              <a-select
                v-model:value="record.unit"
                size="small"
                show-search
                allow-clear
                :options="paramUnitOptions"
                placeholder="请选择"
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'target'">
              <a-input-number v-model:value="record.target" size="small" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'min'">
              <a-input-number v-model:value="record.min" size="small" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'max'">
              <a-input-number v-model:value="record.max" size="small" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" danger @click="removeParam(record.key)"
                >删除</a-button
              >
            </template>
          </template>
        </a-table>
      </div>

      <div class="form-section-box modal-basic-card">
        <div class="section-head">
          <div class="section-title">化验</div>
          <a-button size="small" @click="addAssayScheme">添加方案</a-button>
        </div>
        <p class="section-hint">
          先选业务类型（过程化验 /
          产出化验），再选现场化验类型（如中控取样、转序放行）。模板不钉死，按物料+工序自动匹配。
        </p>
        <a-table
          :columns="assayColumns"
          :data-source="form.qcConfigs"
          :pagination="false"
          size="small"
          row-key="id"
          :locale="{ emptyText: '未配置则本步不显示化验入口' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'bizScope'">
              <a-select
                v-model:value="record.bizScope"
                size="small"
                :options="assayBizScopeOpts"
                style="width: 100%"
                @change="() => onAssayBizScopeChange(record)"
              />
            </template>
            <template v-else-if="column.key === 'assayType'">
              <a-select
                v-model:value="record.assayType"
                size="small"
                :options="assayTypeOpts(record.bizScope)"
                style="width: 100%"
                @change="() => onAssayTypeChange(record)"
              />
            </template>
            <template v-else-if="column.key === 'gateMode'">
              <a-select
                v-model:value="record.gateMode"
                size="small"
                :options="PROCESS_GATE_OPTIONS"
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'allowMultiple'">
              <a-checkbox v-model:checked="record.allowMultiple" />
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" danger @click="removeAssayScheme(record.id)"
                >删除</a-button
              >
            </template>
          </template>
        </a-table>
        <p class="section-hint assay-gate-hint">{{ ASSAY_GATE_HINT }}</p>
      </div>
      <div class="form-section-box modal-basic-card">
        <div class="section-title">过程记录</div>
        <p class="section-hint">
          开启后，批次执行本工序时需填写过程记录（进批记录）。未开启则只确认参数/投料。
        </p>
        <div class="capability-grid">
          <div class="capability-item">
            <span class="capability-label">关联过程记录</span>
            <a-switch
              v-model:checked="form.enableFormTemplate"
              size="small"
              @change="onFormSwitch"
            />
          </div>
        </div>
        <a-row
          v-if="form.enableFormTemplate"
          :gutter="[12, 8]"
          style="width: 100%; margin-top: 12px"
        >
          <a-col :span="12" class="field-col">
            <a-form-item label="记录模板" name="formTemplateId" required>
              <a-select
                v-model:value="form.formTemplateId"
                allow-clear
                show-search
                size="small"
                placeholder="请选择过程记录模板"
                option-filter-prop="label"
                :options="formTemplateOpts"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </div>
    </a-form>

    <SelectPositionModal
      v-model:open="positionPickerOpen"
      :selected="form.defaultExecutors"
      :multiple="true"
      @confirm="onPositionsPicked"
    />
    <SelectEquipmentModal
      v-model:open="equipmentBatchPickerOpen"
      :selected="selectedEquipmentIds"
      multiple
      @confirm="onEquipmentBatchPicked"
    />

    <template #footer>
      <a-space>
        <a-button @click="handleCancel">
          <CloseCircleOutlined />
          取消
        </a-button>
        <a-button type="primary" :loading="saving" @click="handleSave">
          <PlusCircleOutlined />
          保存
        </a-button>
      </a-space>
    </template>
  </FormCreateShell>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CloseCircleOutlined, PlusCircleOutlined } from '@ant-design/icons-vue'
import FormCreateShell from '@/components/FormCreateShell.vue'
import { useFormCreateModal } from '@/composables/useFormCreateModal'
import {
  addProcessConfig,
  updateProcessConfig,
  PROCESS_GATE_OPTIONS,
  PROCESS_GATE_RECORD,
} from '@/store/processConfigStore'
import { listEnabledProcessFormTemplateOptions } from '@/store/processFormTemplateStore'
import {
  deviceLabelById,
  equipmentState,
  formatDeviceLabel,
  getDeviceById,
  listDevices,
} from '@/store/equipmentStore'
import { EQUIPMENT_CATEGORY_OPTIONS, EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
import { getActiveCategoryOptions } from '@/store/processCategoryStore'
import { positionOptions } from '@/store/employeeGroupStore'
import { MOCK_POSITIONS } from '@/mock/processConfigSeed'
import SelectPositionModal from '@/views/product-process/components/SelectPositionModal.vue'
import SelectEquipmentModal from '@/views/product-process/components/SelectEquipmentModal.vue'
import EquipmentSearchSelect from '@/views/product-process/components/EquipmentSearchSelect.vue'
import {
  getEnabledProcessParamUnitOptions,
  processParamUnitState,
} from '@/store/processParamUnitStore'
import {
  ASSAY_GATE_HINT,
  assayTypeLabel,
  assayTypeOptionsForBizScope,
  createProcessQcConfig,
  deriveProcessGateFromAssaySchemes,
  processQcBizScopeOptions,
} from '@/utils/qcProcessConfig'

const props = defineProps({
  open: { type: Boolean, default: false },
  pageMode: { type: Boolean, default: false },
  listPath: { type: String, default: '' },
  record: { type: Object, default: null },
})

const emit = defineEmits(['update:open', 'saved'])

const isEdit = computed(() => Boolean(props.record?.id))

const { isActive, shellTitle, handleCancel, closeAfterSave } = useFormCreateModal(props, emit, {
  listPath: '/product-process/process-config',
  getTitle: () => (isEdit.value ? '编辑工序' : '新增工序'),
})

const formRef = ref()
const saving = ref(false)
const positionPickerOpen = ref(false)
const executorDropdownOpen = ref(false)
const equipmentBatchPickerOpen = ref(false)

const form = reactive({
  code: '',
  name: '',
  category: undefined,
  equipmentRows: [],
  resourceType: '岗位',
  defaultExecutors: [],
  gateMode: PROCESS_GATE_RECORD,
  enableFormTemplate: false,
  formTemplateId: undefined,
  transferCondition: '',
  instruction: '',
  params: [],
  qcConfigs: [],
})

let equipmentRowKeySeq = 1
function nextEquipmentRowKey() {
  equipmentRowKeySeq += 1
  return `eq-row-${equipmentRowKeySeq}`
}

function blankEquipmentRow(partial = {}) {
  return {
    key: nextEquipmentRowKey(),
    category: partial.category || undefined,
    equipmentId: partial.equipmentId || '',
  }
}

const selectedEquipmentIds = computed(() =>
  form.equipmentRows.map((row) => row.equipmentId).filter(Boolean),
)

function openPositionPicker() {
  executorDropdownOpen.value = false
  positionPickerOpen.value = true
}

function openEquipmentBatchPicker() {
  equipmentBatchPickerOpen.value = true
}

function addEquipmentRow() {
  form.equipmentRows.push(blankEquipmentRow())
}

function removeEquipmentRow(key) {
  form.equipmentRows = form.equipmentRows.filter((row) => row.key !== key)
}

function deviceField(equipmentId, field) {
  void equipmentState.devices
  if (!equipmentId) return '—'
  const device = getDeviceById(equipmentId)
  const value = device?.[field]
  return value == null || value === '' ? '—' : value
}

function equipmentStatusColor(status) {
  if (status === EQUIPMENT_STATUS.IN_USE) return 'success'
  if (status === EQUIPMENT_STATUS.REPAIRING) return 'error'
  if (status === EQUIPMENT_STATUS.IDLE) return 'warning'
  return 'default'
}

function equipmentAllowIdsForRow(row) {
  void equipmentState.devices
  const used = new Set(
    form.equipmentRows
      .filter((item) => item.key !== row.key && item.equipmentId)
      .map((item) => item.equipmentId),
  )
  const category = row?.category || ''
  return listDevices()
    .filter((device) => device.status !== EQUIPMENT_STATUS.SCRAPPED)
    .filter((device) => !used.has(device.id))
    .filter((device) => !category || device.category === category)
    .map((device) => device.id)
}

function equipmentOptionsForRow(row) {
  const allow = new Set(equipmentAllowIdsForRow(row))
  const options = listDevices()
    .filter((device) => allow.has(device.id))
    .map((device) => ({
      value: device.id,
      label: formatDeviceLabel(device) || device.name,
    }))
  if (row.equipmentId && !options.some((item) => item.value === row.equipmentId)) {
    options.unshift({
      value: row.equipmentId,
      label: deviceLabelById(row.equipmentId) || row.equipmentId,
    })
  }
  return options
}

function onEquipmentRowCategoryChange(row) {
  if (!row.equipmentId) return
  const device = getDeviceById(row.equipmentId)
  if (row.category && device && device.category !== row.category) {
    row.equipmentId = ''
  }
}

function onEquipmentRowDeviceChange(row, id) {
  const nextId = String(id || '').trim()
  row.equipmentId = nextId
  const device = nextId ? getDeviceById(nextId) : null
  if (device?.category) row.category = device.category
}

function onEquipmentBatchPicked(ids) {
  const list = [
    ...new Set(
      (Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean),
    ),
  ]
  form.equipmentRows = list.map((id) => {
    const device = getDeviceById(id)
    return blankEquipmentRow({
      equipmentId: id,
      category: device?.category || undefined,
    })
  })
}

/** 一期仅「岗位」，下拉保留便于后续扩展其它资源类型 */
const resourceTypeOpts = [{ value: '岗位', label: '岗位' }]
const positionOpts = [...new Set([...(MOCK_POSITIONS || []), ...(positionOptions || [])])].map(
  (name) => ({ label: name, value: name }),
)
const executorOpts = computed(() => {
  if (form.resourceType === '岗位') return positionOpts
  return []
})

function onResourceTypeChange() {
  const allowed = new Set(executorOpts.value.map((item) => item.value))
  form.defaultExecutors = (form.defaultExecutors || []).filter((name) => allowed.has(name))
}

function onPositionsPicked(names) {
  const list = Array.isArray(names) ? names.map((n) => String(n || '').trim()).filter(Boolean) : []
  form.defaultExecutors = [...new Set(list)]
}

let paramKeySeq = 1
function nextParamKey() {
  paramKeySeq += 1
  return `pp-${paramKeySeq}`
}

function blankProcessParam(param = {}) {
  return {
    key: nextParamKey(),
    name: param.name || '',
    unit: param.unit || '',
    target: param.target ?? null,
    min: param.min ?? null,
    max: param.max ?? null,
  }
}

const paramColumns = [
  { title: '参数', key: 'name', width: 160 },
  { title: '单位', key: 'unit', width: 140 },
  { title: '设定值', key: 'target', width: 120 },
  { title: '下限', key: 'min', width: 120 },
  { title: '上限', key: 'max', width: 120 },
  { title: '操作', key: 'action', width: 80 },
]
const paramUnitOptions = computed(() => {
  void processParamUnitState.units
  const options = getEnabledProcessParamUnitOptions()
  const known = new Set(options.map((item) => item.value))
  form.params.forEach((param) => {
    if (param.unit && !known.has(param.unit)) {
      known.add(param.unit)
      options.push({ label: param.unit, value: param.unit })
    }
  })
  return options
})

function addParam() {
  form.params.push(blankProcessParam())
}

function removeParam(key) {
  form.params = form.params.filter((param) => param.key !== key)
}

const categoryOpts = computed(() => getActiveCategoryOptions())
const equipmentCategoryOpts = EQUIPMENT_CATEGORY_OPTIONS
const equipmentColumns = [
  { title: '序号', key: 'seq', width: 56, align: 'center' },
  { title: '设备分类', key: 'category', width: 140 },
  { title: '允许设备', key: 'equipment', width: 220 },
  { title: '型号', key: 'model', width: 120, ellipsis: true },
  { title: '位置', key: 'location', width: 140, ellipsis: true },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 72 },
]
const formTemplateOpts = computed(() => listEnabledProcessFormTemplateOptions())
const assayBizScopeOpts = processQcBizScopeOptions()
const assayColumns = [
  { title: '业务类型', key: 'bizScope', width: 140 },
  { title: '化验类型', key: 'assayType', width: 140 },
  { title: '门禁', key: 'gateMode', width: 200 },
  { title: '可多次', key: 'allowMultiple', width: 72, align: 'center' },
  { title: '操作', key: 'action', width: 72 },
]

function assayTypeOpts(bizScope) {
  return assayTypeOptionsForBizScope(bizScope).map((item) => ({
    value: item.value,
    label: item.label,
  }))
}

function onAssayBizScopeChange(record) {
  const opts = assayTypeOptionsForBizScope(record.bizScope)
  if (!opts.some((item) => item.value === record.assayType)) {
    record.assayType = opts[0]?.value
  }
  record.name = assayTypeLabel(record.assayType, record.bizScope)
  record.templateCode = ''
}

function onAssayTypeChange(record) {
  record.name = assayTypeLabel(record.assayType, record.bizScope)
  record.templateCode = ''
}

function addAssayScheme() {
  form.qcConfigs.push(
    createProcessQcConfig({
      bizScope: '生产过程检',
      assayType: 'in_process',
      gateMode: PROCESS_GATE_RECORD,
      allowMultiple: true,
    }),
  )
}

function removeAssayScheme(id) {
  form.qcConfigs = form.qcConfigs.filter((row) => row.id !== id)
}

function onFormSwitch(checked) {
  if (!checked) form.formTemplateId = undefined
}

const rules = computed(() => ({
  name: [{ required: true, message: '请输入工序名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择工序分类', trigger: 'change' }],
  resourceType: [{ required: true, message: '请选择资源类型', trigger: 'change' }],
  defaultExecutors: [
    {
      type: 'array',
      required: true,
      min: 1,
      message: '请选择默认执行',
      trigger: 'change',
    },
  ],
  formTemplateId: form.enableFormTemplate
    ? [{ required: true, message: '请选择过程记录模板', trigger: 'change' }]
    : [],
}))

watch(
  () => [isActive.value, props.record?.id],
  ([visible]) => {
    if (!visible) return
    const r = props.record
    form.code = r?.code || ''
    form.name = r?.name || ''
    form.category = r?.category
    form.equipmentRows = (r?.equipmentIds || []).map((id) => {
      const device = getDeviceById(id)
      return blankEquipmentRow({
        equipmentId: id,
        category: device?.category || undefined,
      })
    })
    form.resourceType = r?.resourceType === '岗位' || !r?.resourceType ? '岗位' : r.resourceType
    if (!resourceTypeOpts.some((opt) => opt.value === form.resourceType)) {
      form.resourceType = '岗位'
    }
    const executors = Array.isArray(r?.defaultExecutors)
      ? r.defaultExecutors.map((n) => String(n || '').trim()).filter(Boolean)
      : []
    if (!executors.length && (r?.responsibleName || r?.position)) {
      executors.push(String(r.responsibleName || r.position).trim())
    }
    form.defaultExecutors = [...new Set(executors)]
    form.gateMode = r?.gateMode || PROCESS_GATE_RECORD
    form.enableFormTemplate = Boolean(r?.formTemplateId)
    form.formTemplateId = r?.formTemplateId || undefined
    form.transferCondition = r?.transferCondition || ''
    form.instruction = r?.instruction || ''
    form.params = (r?.params || []).map((param) => blankProcessParam(param))
    form.qcConfigs = (r?.qcConfigs || []).map((row) => createProcessQcConfig(row))
  },
  { immediate: true },
)

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  if (form.enableFormTemplate && !form.formTemplateId) {
    message.warning('请选择过程记录模板')
    return
  }
  if (form.qcConfigs.some((row) => !row.bizScope || !row.assayType || !row.gateMode)) {
    message.warning('请完整选择业务类型、化验类型与门禁')
    return
  }
  const qcConfigs = form.qcConfigs.map((row) => createProcessQcConfig(row))
  saving.value = true
  const payload = {
    code: form.code,
    name: form.name,
    category: form.category,
    equipmentIds: [
      ...new Set(
        form.equipmentRows.map((row) => String(row.equipmentId || '').trim()).filter(Boolean),
      ),
    ],
    resourceType: form.resourceType || '岗位',
    responsibleType: 'position',
    defaultExecutors: [...(form.defaultExecutors || [])],
    responsibleName: (form.defaultExecutors || [])[0] || '',
    gateMode: deriveProcessGateFromAssaySchemes(qcConfigs),
    formTemplateId: form.enableFormTemplate ? form.formTemplateId || '' : '',
    transferCondition: form.transferCondition,
    instruction: form.instruction,
    params: form.params,
    qcConfigs,
  }
  const res = isEdit.value
    ? updateProcessConfig(props.record.id, payload)
    : addProcessConfig(payload)
  saving.value = false
  if (!res.ok) {
    message.warning(res.message)
    return
  }
  message.success(isEdit.value ? '已保存' : '已新增')
  emit('saved')
  closeAfterSave()
}
</script>

<style lang="less" scoped>
.process-form {
  width: 100%;

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .section-title {
      margin-bottom: 0;
    }
  }

  .section-hint {
    margin: 0 0 8px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
    line-height: 20px;
  }

  .assay-gate-hint {
    margin: 12px 0 0;
  }

  .form-section-box {
    width: 100%;
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
    color: #1f2329;
  }

  .capability-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
  }

  .capability-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 40px;
    padding: 8px 12px;
    background: #fafafa;
    border: 1px solid #e5e6eb;
    border-radius: 8px;
  }

  .capability-label {
    font-size: 14px;
    color: #1f2329;
  }
}

.horizontal-form {
  width: 100%;

  .field-col {
    min-width: 0;
    max-width: 100%;
  }

  :deep(.ant-form-item) {
    width: 100%;
    max-width: 100%;
    margin-inline-end: 0;
    margin-bottom: 0;
  }

  :deep(.ant-form-item-row) {
    flex-wrap: nowrap;
    align-items: center;
    width: 100%;
  }

  :deep(.ant-form-item-label) {
    flex: 0 0 88px;
    width: 88px;
    max-width: 88px;
    padding: 0;
  }

  :deep(.ant-form-item-label > label) {
    height: auto;
    min-height: 32px;
    line-height: 32px;
    font-size: 14px;
    white-space: nowrap;
  }

  :deep(.ant-form-item-control) {
    flex: 1 1 auto;
    min-width: 0;
    max-width: 100%;
  }

  :deep(.ant-select),
  :deep(.ant-input) {
    width: 100%;
  }

  .search-more-row {
    padding: 8px 12px;
    text-align: center;
    color: #307068;
    cursor: pointer;
    font-size: 13px;

    &:hover {
      background: #f5f5f5;
    }
  }

  .readonly-cell {
    color: #1f2329;
    font-size: 13px;
  }

  .remark-item {
    :deep(.ant-form-item-row) {
      align-items: flex-start;
    }

    :deep(.ant-form-item-label > label) {
      height: 32px;
    }
  }
}
</style>
