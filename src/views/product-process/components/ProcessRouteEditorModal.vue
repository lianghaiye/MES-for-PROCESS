<template>
  <FormCreateShell
    :page-mode="pageMode"
    :open="open"
    :title="shellTitle"
    width="96%"
    class="process-route-editor-modal"
    @cancel="handleCancel"
    @update:open="(val) => emit('update:open', val)"
  >
    <div class="route-editor-page">
      <div class="form-section-box modal-basic-card">
        <div class="section-label">基本信息</div>
        <a-form
          :model="form"
          layout="horizontal"
          class="route-basic-form horizontal-form"
          :label-col="{ style: { width: '110px' } }"
          :wrapper-col="{ style: { flex: 1 } }"
        >
          <a-row :gutter="[16, 0]" style="width: 100%">
            <a-col :xs="24" :md="12">
              <a-form-item label="路线名称" required>
                <a-input v-model:value="form.name" size="small" placeholder="请输入 路线名称" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="适用范围" required>
                <a-radio-group v-model:value="form.applyScope" size="small" @change="onScopeChange">
                  <a-radio value="全部产品">全局</a-radio>
                  <a-radio value="单个物品">单产品</a-radio>
                  <a-radio value="物品类别">产品类别</a-radio>
                </a-radio-group>
              </a-form-item>
            </a-col>
            <a-col v-if="form.applyScope === '单个物品'" :span="24">
              <a-form-item label="适用对象" required>
                <div class="scope-target-row">
                  <a-select
                    :value="form.itemId || undefined"
                    show-search
                    allow-clear
                    size="small"
                    placeholder="输入编码/名称搜索"
                    :options="productOpts"
                    :filter-option="filterProductOption"
                    style="flex: 1"
                    @change="onProductSelect"
                  />
                  <a class="link-more" @click.prevent="itemPickerOpen = true">查看更多</a>
                </div>
              </a-form-item>
            </a-col>
            <template v-if="form.applyScope === '物品类别'">
              <a-col :span="24">
                <a-form-item label="适用对象" required>
                  <div class="scope-target-row">
                    <a-tree-select
                      v-model:value="form.categoryKey"
                      :tree-data="categoryTree"
                      placeholder="输入编码/名称搜索"
                      tree-default-expand-all
                      show-search
                      allow-clear
                      tree-node-filter-prop="title"
                      size="small"
                      style="flex: 1"
                      @change="onCategoryChange"
                    />
                    <a class="link-more muted">查看更多</a>
                  </div>
                </a-form-item>
              </a-col>
            </template>
            <a-col :span="24">
              <a-form-item label="备注">
                <a-textarea
                  v-model:value="form.remark"
                  :rows="2"
                  size="small"
                  placeholder="请输入 备注"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <ProcessRouteGridEditor
        v-if="editMode === ROUTE_MODE_PROCESS"
        v-model:grid="form.grid"
        v-model:step-policies="form.stepPolicies"
        v-model:selected-step="selectedStep"
        v-model:selected-row="selectedRow"
      />

      <div v-else class="form-section-box modal-basic-card">
        <div class="section-head">
          <div class="section-label">设备顺序</div>
          <a-button size="small" @click="addUnit">添加设备</a-button>
        </div>
        <p class="block-hint">
          按生产经过的设备排列，同一台只出现一次。配方里的多个阶段可以都选同一台设备。
        </p>
        <a-table
          :columns="unitColumns"
          :data-source="form.units"
          :pagination="false"
          size="small"
          row-key="key"
          :locale="{ emptyText: '还没有设备' }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'seq'">{{ index + 1 }}</template>
            <template v-else-if="column.key === 'equipment'">
              <EquipmentSearchSelect
                v-model="record.equipmentId"
                :multiple="false"
                :options="unitOptions(record)"
                :allow-ids="unitAllowIds(record)"
                placeholder="请选择设备"
              />
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button
                type="link"
                size="small"
                :disabled="index === 0"
                @click="moveUnit(index, -1)"
                >上移</a-button
              >
              <a-button
                type="link"
                size="small"
                :disabled="index === form.units.length - 1"
                @click="moveUnit(index, 1)"
                >下移</a-button
              >
              <a-button type="link" size="small" danger @click="removeUnit(record.key)"
                >删除</a-button
              >
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <SelectProductMaterialModal
      v-if="isActive"
      v-model:open="itemPickerOpen"
      :item-type="form.itemType"
      :selected-id="form.itemId"
      @confirm="onItemSelected"
    />

    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" @click="handleSave">保存</a-button>
    </template>
  </FormCreateShell>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import FormCreateShell from '@/components/FormCreateShell.vue'
import { useFormCreateModal } from '@/composables/useFormCreateModal'
import { createEmptyGrid, syncStepPolicies } from '@/utils/processRouteGrid'
import { addProcessRoute, updateProcessRoute } from '@/store/processRouteStore'
import { productCategoryState } from '@/store/productCategoryStore'
import { materialCategoryState } from '@/store/materialCategoryStore'
import { productInfoState } from '@/store/productInfoStore'
import { ROUTE_MODE_EQUIPMENT, ROUTE_MODE_PROCESS } from '@/constants/processRouteMode'
import { resolveRouteEditMode } from '@/store/processMesSettingsStore'
import { EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
import { equipmentState, formatDeviceLabel } from '@/store/equipmentStore'
import ProcessRouteGridEditor from './ProcessRouteGridEditor.vue'
import EquipmentSearchSelect from './EquipmentSearchSelect.vue'
import SelectProductMaterialModal from './SelectProductMaterialModal.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  pageMode: { type: Boolean, default: false },
  listPath: { type: String, default: '' },
  editRecord: { type: Object, default: null },
})

const emit = defineEmits(['update:open', 'saved'])

const isEdit = computed(() => Boolean(props.editRecord?.id))

const { isActive, shellTitle, handleCancel, closeAfterSave } = useFormCreateModal(props, emit, {
  listPath: '/product-process/routing',
  getTitle: () => (isEdit.value ? '编辑工艺路线' : '新增工艺路线'),
})
const itemPickerOpen = ref(false)
const selectedStep = ref(-1)
const selectedRow = ref(-1)
const editMode = ref(ROUTE_MODE_PROCESS)
let unitSeq = 1
function nextUnitKey() {
  unitSeq += 1
  return `unit-${unitSeq}`
}

const unitColumns = [
  { title: '顺序', key: 'seq', width: 70, align: 'center' },
  { title: '设备', key: 'equipment' },
  { title: '操作', key: 'action', width: 180 },
]

const form = reactive({
  name: '',
  applyScope: '全部产品',
  itemType: '产品',
  itemId: '',
  itemName: '',
  itemCode: '',
  categoryType: '产品',
  categoryKey: undefined,
  categoryName: '',
  productDisplay: '',
  remark: '',
  grid: createEmptyGrid(9, 2),
  stepPolicies: syncStepPolicies(createEmptyGrid(9, 2), []),
  units: [],
})

const deviceOptions = computed(() => {
  void equipmentState.devices
  return (equipmentState.devices || []).filter(
    (device) => device.status !== EQUIPMENT_STATUS.SCRAPPED,
  )
})

function unitAllowIds(record) {
  const used = new Set(
    form.units
      .filter((unit) => unit.key !== record.key && unit.equipmentId)
      .map((unit) => unit.equipmentId),
  )
  return deviceOptions.value
    .filter((device) => !used.has(device.id) || device.id === record.equipmentId)
    .map((device) => device.id)
}

function unitOptions(record) {
  const allow = new Set(unitAllowIds(record))
  const options = deviceOptions.value
    .filter((device) => allow.has(device.id))
    .map((device) => ({ value: device.id, label: formatDeviceLabel(device) }))
  if (record.equipmentId && !options.some((item) => item.value === record.equipmentId)) {
    const current = (equipmentState.devices || []).find(
      (device) => device.id === record.equipmentId,
    )
    options.unshift({
      value: record.equipmentId,
      label: current ? formatDeviceLabel(current) : record.equipmentId,
    })
  }
  return options
}

function addUnit() {
  form.units.push({ key: nextUnitKey(), equipmentId: undefined })
}

function removeUnit(key) {
  form.units = form.units.filter((unit) => unit.key !== key)
}

function moveUnit(index, delta) {
  const next = index + delta
  if (next < 0 || next >= form.units.length) return
  const [row] = form.units.splice(index, 1)
  form.units.splice(next, 0, row)
}

const productOpts = computed(() =>
  (productInfoState.products || [])
    .filter((p) => p?.status !== '已归档' && p?.status !== 'archived')
    .map((p) => ({
      label: `${p.code || ''} ${p.name || ''}`.trim(),
      value: p.id,
      code: p.code,
      name: p.name,
    })),
)

const categoryTree = computed(() => {
  const tree = form.categoryType === '物料' ? materialCategoryState.tree : productCategoryState.tree
  return tree || []
})

function filterProductOption(input, option) {
  const kw = String(input || '')
    .trim()
    .toLowerCase()
  if (!kw) return true
  const label = String(option?.label || '').toLowerCase()
  const code = String(option?.code || '').toLowerCase()
  const name = String(option?.name || '').toLowerCase()
  return label.includes(kw) || code.includes(kw) || name.includes(kw)
}

function onProductSelect(id) {
  if (!id) {
    form.itemId = ''
    form.itemName = ''
    form.itemCode = ''
    form.productDisplay = ''
    return
  }
  const row = (productInfoState.products || []).find((p) => p.id === id)
  if (!row) return
  form.itemType = '产品'
  form.itemId = row.id
  form.itemName = row.name || ''
  form.itemCode = row.code || ''
  form.productDisplay = row.name || ''
}

function resetForm() {
  const r = props.editRecord
  editMode.value = resolveRouteEditMode(r)
  if (r) {
    const grid = r.grid?.length ? r.grid : createEmptyGrid(9, 2)
    Object.assign(form, {
      name: r.name || '',
      applyScope: r.applyScope || '全部产品',
      itemType: r.itemType || '产品',
      itemId: r.itemId || '',
      itemName: r.itemName || '',
      itemCode: r.itemCode || '',
      categoryType: r.categoryType || '产品',
      categoryKey: r.categoryKey || undefined,
      categoryName: r.categoryName || '',
      productDisplay: r.productDisplay || '',
      remark: r.remark || '',
      grid,
      stepPolicies: syncStepPolicies(grid, r.stepPolicies),
      units: (r.units || []).map((unit) => ({
        key: nextUnitKey(),
        equipmentId: unit.equipmentId,
      })),
    })
    if (editMode.value === ROUTE_MODE_EQUIPMENT && !form.units.length) {
      form.units = [{ key: nextUnitKey(), equipmentId: undefined }]
    }
  } else {
    const grid = createEmptyGrid(9, 2)
    Object.assign(form, {
      name: '',
      applyScope: '全部产品',
      itemType: '产品',
      itemId: '',
      itemName: '',
      itemCode: '',
      categoryType: '产品',
      categoryKey: undefined,
      categoryName: '',
      productDisplay: '',
      remark: '',
      grid,
      stepPolicies: syncStepPolicies(grid, []),
      units:
        editMode.value === ROUTE_MODE_EQUIPMENT
          ? [{ key: nextUnitKey(), equipmentId: undefined }]
          : [],
    })
  }
  selectedStep.value = -1
  selectedRow.value = -1
}

function onScopeChange() {
  form.itemId = ''
  form.itemName = ''
  form.itemCode = ''
  form.categoryKey = undefined
  form.categoryName = ''
  form.productDisplay = ''
}

function onCategoryChange(key) {
  const findTitle = (nodes) => {
    for (const n of nodes) {
      if (n.key === key) return n.title
      if (n.children) {
        const t = findTitle(n.children)
        if (t) return t
      }
    }
    return ''
  }
  const tree = form.categoryType === '物料' ? materialCategoryState.tree : productCategoryState.tree
  form.categoryName = findTitle(tree)
  form.productDisplay = form.categoryName
}

function onItemSelected(row) {
  form.itemType = row.itemType
  form.itemId = row.id
  form.itemName = row.name
  form.itemCode = row.code
  form.productDisplay = row.name
  form.categoryKey = row.categoryKey
}

function handleSave() {
  const payload = {
    name: form.name,
    applyScope: form.applyScope,
    itemType: form.itemType,
    itemId: form.itemId,
    itemName: form.itemName,
    itemCode: form.itemCode,
    categoryType: form.categoryType,
    categoryKey: form.categoryKey,
    categoryName: form.categoryName,
    productDisplay: form.productDisplay || form.itemName || form.categoryName,
    remark: form.remark,
    routeMode: editMode.value,
  }
  if (editMode.value === ROUTE_MODE_EQUIPMENT) {
    payload.units = form.units.map((unit) => ({ equipmentId: unit.equipmentId || '' }))
  } else {
    payload.grid = form.grid
    payload.stepPolicies = form.stepPolicies
  }
  const res = isEdit.value
    ? updateProcessRoute(props.editRecord.id, payload)
    : addProcessRoute(payload)
  if (!res.ok) {
    message.warning(res.message)
    return
  }
  message.success('保存成功')
  emit('saved', res.route)
  closeAfterSave()
}

watch(
  () => [isActive.value, props.editRecord?.id],
  ([visible]) => {
    if (visible) resetForm()
  },
  { immediate: true },
)
</script>

<style scoped>
.route-editor-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-section-box {
  width: 100%;
  margin-bottom: 0;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-label {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.section-head .section-label {
  margin-bottom: 0;
}

.block-hint {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 22px;
  color: #4e5969;
}

.route-basic-form :deep(.ant-form-item) {
  margin-bottom: 12px;
}

.route-basic-form :deep(.ant-form-item-label > label) {
  font-size: 13px;
}

.scope-target-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.link-more {
  color: #307068;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
}

.link-more.muted {
  color: rgba(0, 0, 0, 0.25);
  cursor: default;
  pointer-events: none;
}
</style>

<style>
.process-route-editor-modal .ant-modal-content {
  overflow: hidden;
}

.process-route-editor-modal .ant-modal-body {
  max-height: calc(100vh - 160px);
  overflow: auto;
  padding: 0;
}
</style>
