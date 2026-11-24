<template>
  <a-modal
    :open="open"
    :title="record?.id ? '编辑设备' : '新增设备'"
    :confirm-loading="saving"
    destroy-on-close
    width="720px"
    @ok="handleSave"
    @cancel="emit('update:open', false)"
  >
    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      layout="horizontal"
      :label-col="{ flex: '0 0 96px' }"
      :wrapper-col="{ flex: '1 1 auto' }"
    >
      <a-row :gutter="[12, 8]">
        <a-col :span="12">
          <a-form-item label="设备编码" name="code">
            <a-input v-model:value="form.code" allow-clear placeholder="空则自动生成" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="设备名称" name="name">
            <a-input v-model:value="form.name" allow-clear placeholder="请输入设备名称" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="设备类别" name="category">
            <a-select
              v-model:value="form.category"
              :options="EQUIPMENT_CATEGORY_OPTIONS"
              placeholder="请选择"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="型号" name="model">
            <a-input v-model:value="form.model" allow-clear placeholder="选填" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="所属车间" name="workshop">
            <a-input v-model:value="form.workshop" allow-clear placeholder="如：机加车间" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="安装位置" name="location">
            <a-input v-model:value="form.location" allow-clear placeholder="如：A区-01" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="设备状态" name="status">
            <a-select
              v-model:value="form.status"
              :options="EQUIPMENT_STATUS_OPTIONS"
              placeholder="请选择"
            />
          </a-form-item>
        </a-col>
        <template v-if="vessel">
          <a-col v-if="form.category === '储罐'" :span="24">
            <p class="vessel-hint">
              类别为储罐时，保存会同步生成或更新库存「储罐位置」（同码挂接），供产出/投料选去向；罐容取公称容积。储罐液位页只看液位与转移，不当第二套主数据入口。
            </p>
          </a-col>
          <a-col :span="12">
            <a-form-item label="公称容积" name="nominalCapacity">
              <a-input-number
                v-model:value="form.nominalCapacity"
                :min="0.001"
                :precision="3"
                style="width: 100%"
                placeholder="设计容积"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="工作容积" name="workingCapacity" extra="留空则只按公称容积限制">
              <a-input-number
                v-model:value="form.workingCapacity"
                :min="0.001"
                :precision="3"
                style="width: 100%"
                placeholder="运行上限，不超过公称容积"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="容积单位" name="capacityUnit">
              <a-select
                v-model:value="form.capacityUnit"
                :options="CAPACITY_UNIT_OPTIONS"
                placeholder="请选择"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="占釜状态" name="occupyStatus">
              <a-select
                v-model:value="form.occupyStatus"
                :options="EQUIPMENT_OCCUPY_STATUS_OPTIONS"
                placeholder="请选择"
              />
            </a-form-item>
          </a-col>
          <a-col v-if="holdsBatch" :span="12">
            <a-form-item label="占用批次" name="occupiedBatchNo">
              <a-input
                v-model:value="form.occupiedBatchNo"
                allow-clear
                placeholder="当前占用的批次号，可空"
              />
            </a-form-item>
          </a-col>
        </template>
        <a-col :span="12">
          <a-form-item label="责任人" name="responsible">
            <a-input v-model:value="form.responsible" allow-clear placeholder="选填" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="生产厂家" name="manufacturer">
            <a-input v-model:value="form.manufacturer" allow-clear placeholder="选填" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="投用日期" name="installDate">
            <a-date-picker
              v-model:value="installDateValue"
              value-format="YYYY-MM-DD"
              style="width: 100%"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item label="备注" name="remark">
            <a-textarea v-model:value="form.remark" :rows="2" allow-clear placeholder="选填" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  CAPACITY_UNIT_OPTIONS,
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_OCCUPY_STATUS,
  EQUIPMENT_OCCUPY_STATUS_OPTIONS,
  EQUIPMENT_STATUS,
  EQUIPMENT_STATUS_OPTIONS,
  isVesselCategory,
  validateVesselCapacity,
} from '@/mock/equipmentSeed'
import { addDevice, updateDevice } from '@/store/equipmentStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  record: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'saved'])

const formRef = ref(null)
const saving = ref(false)
const form = reactive(emptyForm())

const installDateValue = computed({
  get: () => form.installDate || undefined,
  set: (v) => {
    form.installDate = v || ''
  },
})

const vessel = computed(() => isVesselCategory(form.category))
const holdsBatch = computed(
  () =>
    form.occupyStatus === EQUIPMENT_OCCUPY_STATUS.OCCUPIED ||
    form.occupyStatus === EQUIPMENT_OCCUPY_STATUS.WAIT_DISCHARGE,
)

const rules = computed(() => {
  const base = {
    name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
    category: [{ required: true, message: '请选择设备类别', trigger: 'change' }],
    status: [{ required: true, message: '请选择设备状态', trigger: 'change' }],
  }
  if (!vessel.value) return base
  return {
    ...base,
    nominalCapacity: [{ required: true, message: '请填写公称容积', trigger: 'blur' }],
    capacityUnit: [{ required: true, message: '请选择容积单位', trigger: 'change' }],
    occupyStatus: [{ required: true, message: '请选择占釜状态', trigger: 'change' }],
  }
})

function emptyForm() {
  return {
    code: '',
    name: '',
    category: '公用工程',
    model: '',
    workshop: '',
    location: '',
    status: EQUIPMENT_STATUS.IN_USE,
    nominalCapacity: null,
    workingCapacity: null,
    capacityUnit: 'L',
    occupyStatus: EQUIPMENT_OCCUPY_STATUS.CLEAN,
    occupiedBatchNo: '',
    responsible: '',
    manufacturer: '',
    installDate: '',
    remark: '',
  }
}

watch(
  () => [props.open, props.record],
  ([open]) => {
    if (!open) return
    const r = props.record
    Object.assign(form, emptyForm(), r ? { ...r } : {})
    if (r && !isVesselCategory(r.category)) {
      form.nominalCapacity = null
      form.workingCapacity = null
      form.capacityUnit = ''
      form.occupyStatus = ''
      form.occupiedBatchNo = ''
    }
  },
)

watch(
  () => form.category,
  (category) => {
    if (!props.open || !isVesselCategory(category)) return
    if (!form.capacityUnit) form.capacityUnit = 'L'
    if (!form.occupyStatus) form.occupyStatus = EQUIPMENT_OCCUPY_STATUS.CLEAN
  },
)

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const capacityCheck = validateVesselCapacity(form)
  if (!capacityCheck.ok) {
    message.warning(capacityCheck.message)
    return
  }
  saving.value = true
  try {
    const res = props.record?.id
      ? updateDevice(props.record.id, { ...form })
      : addDevice({ ...form })
    if (!res.ok) {
      message.warning(res.message || '保存失败')
      return
    }
    if (res.device?.category === '储罐' && res.device.inventoryLocationId) {
      message.success(`保存成功，已挂接库存位置 ${res.device.inventoryLocationId}`)
    } else {
      message.success('保存成功')
    }
    emit('update:open', false)
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.vessel-hint {
  margin: 0 0 4px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: #307068;
  background: #e7f3f1;
  border-radius: 6px;
}
</style>
