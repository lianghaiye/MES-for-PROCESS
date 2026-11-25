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
      :label-col="{ flex: '0 0 110px' }"
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
          <a-form-item label="设备类型" name="category">
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
          <a-form-item label="所属工作中心" name="workCenterId">
            <a-select
              v-model:value="form.workCenterId"
              :options="workCenterOptions"
              allow-clear
              show-search
              option-filter-prop="label"
              placeholder="请选择工作中心"
            />
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
        <a-col :span="12">
          <!-- 与设备类型解耦：勾选才同步库存位置 -->
          <a-form-item label="库存存放点" name="asStockLocation">
            <a-checkbox v-model:checked="form.asStockLocation">作为库存存放点</a-checkbox>
          </a-form-item>
        </a-col>
        <a-col v-if="form.asStockLocation" :span="24">
          <p class="vessel-hint">
            勾选后保存会同步生成或更新库存「储罐位置」（同码挂接），供产出/投料选去向；罐容取公称容积；库存责任人同步为位置仓管员，入罐单可带出。储罐液位页只看液位与转移，不当第二套主数据入口。
          </p>
        </a-col>
        <a-col v-if="form.asStockLocation" :span="12">
          <a-form-item label="库存责任人" name="stockKeeperName">
            <a-input
              v-model:value="form.stockKeeperName"
              allow-clear
              placeholder="同步到库存位置仓管员"
            />
          </a-form-item>
        </a-col>
        <template v-if="showCapacity">
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
          <template v-if="vessel">
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
  needsCapacityFields,
  validateVesselCapacity,
} from '@/mock/equipmentSeed'
import { addDevice, updateDevice } from '@/store/equipmentStore'
import {
  formatWorkCenterLabel,
  listEnabledWorkCenters,
  workCenterState,
} from '@/store/workCenterStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  record: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'saved'])

const formRef = ref(null)
const saving = ref(false)
const form = reactive(emptyForm())

/** 启用中的工作中心；当前已选但被禁用的仍补进下拉，避免回显丢值 */
const workCenterOptions = computed(() => {
  void workCenterState.centers
  const rows = listEnabledWorkCenters().map((row) => ({
    value: row.id,
    label: `${row.code || ''} ${row.name || ''}`.trim(),
  }))
  const currentId = String(form.workCenterId || '').trim()
  if (currentId && !rows.some((row) => row.value === currentId)) {
    rows.unshift({
      value: currentId,
      label: formatWorkCenterLabel(currentId),
    })
  }
  return rows
})

const installDateValue = computed({
  get: () => form.installDate || undefined,
  set: (v) => {
    form.installDate = v || ''
  },
})

const vessel = computed(() => isVesselCategory(form.category))
/** 反应/储运，或勾选库存存放点时展示容积字段 */
const showCapacity = computed(() => needsCapacityFields(form))
const holdsBatch = computed(
  () =>
    form.occupyStatus === EQUIPMENT_OCCUPY_STATUS.OCCUPIED ||
    form.occupyStatus === EQUIPMENT_OCCUPY_STATUS.WAIT_DISCHARGE,
)

const rules = computed(() => {
  const base = {
    name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
    category: [{ required: true, message: '请选择设备类型', trigger: 'change' }],
    status: [{ required: true, message: '请选择设备状态', trigger: 'change' }],
  }
  const next = { ...base }
  // 作为库存存放点时必须指定库存责任人（对齐仓库管理员必填）
  if (form.asStockLocation) {
    next.stockKeeperName = [{ required: true, message: '请填写库存责任人', trigger: 'blur' }]
  }
  if (!showCapacity.value) return next
  next.nominalCapacity = [{ required: true, message: '请填写公称容积', trigger: 'blur' }]
  next.capacityUnit = [{ required: true, message: '请选择容积单位', trigger: 'change' }]
  // 占釜仅反应/储运设备必填
  if (vessel.value) {
    next.occupyStatus = [{ required: true, message: '请选择占釜状态', trigger: 'change' }]
  }
  return next
})

function emptyForm() {
  return {
    code: '',
    name: '',
    category: '公用工程',
    asStockLocation: false,
    stockKeeperName: '',
    model: '',
    workCenterId: undefined,
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

/** 主控关闭后清空容积/占釜联动字段，避免只藏界面留下旧值 */
function clearCapacityFields({ clearOccupy = true } = {}) {
  form.nominalCapacity = null
  form.workingCapacity = null
  form.capacityUnit = ''
  if (clearOccupy) {
    form.occupyStatus = ''
    form.occupiedBatchNo = ''
  }
}

watch(
  () => [props.open, props.record],
  ([open]) => {
    if (!open) return
    const r = props.record
    Object.assign(form, emptyForm(), r ? { ...r } : {})
    // 空串转 undefined，避免 a-select 显示异常
    if (!form.workCenterId) form.workCenterId = undefined
    // 非容积场景：清掉误带回的容积/占釜
    if (r && !needsCapacityFields(form)) {
      clearCapacityFields()
    } else if (r && !isVesselCategory(form.category)) {
      form.occupyStatus = ''
      form.occupiedBatchNo = ''
    }
  },
)

// 切换设备类型：进入反应/储运时补默认单位与占釜；离开且未勾选存放点时清空容积
watch(
  () => form.category,
  (category, prev) => {
    if (!props.open || category === prev) return
    if (isVesselCategory(category)) {
      if (!form.capacityUnit) form.capacityUnit = 'L'
      if (!form.occupyStatus) form.occupyStatus = EQUIPMENT_OCCUPY_STATUS.CLEAN
      return
    }
    // 非反应/储运：占釜必须清空；若也未勾选存放点则容积一并清空
    form.occupyStatus = ''
    form.occupiedBatchNo = ''
    if (!form.asStockLocation) clearCapacityFields({ clearOccupy: false })
  },
)

// 关闭「作为库存存放点」：清空库存责任人；非反应/储运时清空容积联动字段
watch(
  () => form.asStockLocation,
  (checked, prev) => {
    if (!props.open || checked === prev) return
    if (checked) {
      if (!form.capacityUnit) form.capacityUnit = 'L'
      // 首次勾选可把设备责任人带入库存责任人，方便填表
      if (!form.stockKeeperName && form.responsible) {
        form.stockKeeperName = form.responsible
      }
      return
    }
    form.stockKeeperName = ''
    if (!isVesselCategory(form.category)) clearCapacityFields()
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
    if (res.device?.asStockLocation && res.device.inventoryLocationId) {
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
