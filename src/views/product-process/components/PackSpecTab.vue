<template>
  <div class="pack-spec-tab">
    <div class="section-head">
      <span class="section-title">包装规格</span>
      <a-button v-if="!disabled" type="primary" size="small" ghost @click="openCreate">
        + 新增包装规格
      </a-button>
    </div>
    <p class="section-desc">
      每件含量折回库存单位{{
        inventoryUnit ? `（${inventoryUnit}）` : ''
      }}。销售单价、采购单价按库存单位，后缀写成元/kg，不是按包装单位。销项税、进项税按产品维护，各包装规格共用。
    </p>
    <a-table
      :columns="columns"
      :data-source="packSpecs"
      row-key="id"
      size="small"
      bordered
      :pagination="false"
      :locale="{ emptyText: '暂无包装规格，可按本产品新增' }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <span>{{ record.name || '—' }}</span>
          <a-tag v-if="record.isDefault" color="blue" class="default-tag">默认</a-tag>
          <a-tag v-if="record.enabled === false">已停用</a-tag>
        </template>
        <template v-else-if="column.key === 'convert'">
          {{ formatPackSpecText(record, inventoryUnit) }}
        </template>
        <template v-else-if="column.key === 'salesPrice'">
          {{ formatPackPrice(record.salesPrice, inventoryUnit) }}
        </template>
        <template v-else-if="column.key === 'purchasePrice'">
          {{ formatPackPrice(record.purchasePrice, inventoryUnit) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.enabled === false ? 'default' : 'success'">
            {{ record.enabled === false ? '停用' : '启用' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'actions'">
          <template v-if="!disabled">
            <a @click="openEdit(record)">编辑</a>
            <a-divider type="vertical" />
            <a class="danger-link" @click="removeRow(record)">删除</a>
          </template>
          <span v-else>—</span>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑包装规格' : '新增包装规格'"
      :width="720"
      :mask-closable="false"
      ok-text="确定"
      cancel-text="取消"
      destroy-on-close
      @ok="submitModal"
    >
      <a-form layout="inline" class="horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="24">
            <a-form-item label="规格名称" required>
              <a-input
                v-model:value="draft.name"
                size="small"
                placeholder="如 20kg铁桶、散装槽车"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="散装">
              <a-switch v-model:checked="draft.isBulk" size="small" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="默认">
              <a-switch v-model:checked="draft.isDefault" size="small" />
            </a-form-item>
          </a-col>
          <a-col v-if="!draft.isBulk" :span="12">
            <a-form-item label="包装单位" required>
              <a-select
                v-model:value="draft.packUnit"
                size="small"
                allow-clear
                show-search
                option-filter-prop="label"
                :options="packUnitOpts"
                :disabled="disabled"
                placeholder="请选择包装单位"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col v-if="!draft.isBulk" :span="12">
            <a-form-item label="每件含量" required>
              <a-input-number
                v-model:value="draft.qty"
                size="small"
                :min="0"
                :precision="3"
                style="width: 100%"
                :addon-after="inventoryUnit || '库存单位'"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="销售单价">
              <a-input-number
                v-model:value="draft.salesPrice"
                size="small"
                :min="0"
                :precision="2"
                style="width: 100%"
                placeholder="不含税，可空"
                :addon-after="priceAddon"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="销项税">
              <a-input-number
                v-model:value="outputTaxRateModel"
                size="small"
                :min="0"
                :max="100"
                :precision="2"
                :disabled="disabled"
                style="width: 100%"
                placeholder="各规格共用"
                addon-after="%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="销售含税">
              <a-input-number
                :value="inclTax(draft.salesPrice, outputTaxRate)"
                size="small"
                :precision="2"
                disabled
                style="width: 100%"
                placeholder="自动计算"
                :addon-after="priceAddon"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="采购单价">
              <a-input-number
                v-model:value="draft.purchasePrice"
                size="small"
                :min="0"
                :precision="2"
                style="width: 100%"
                placeholder="不含税，可空"
                :addon-after="priceAddon"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="进项税">
              <a-input-number
                v-model:value="inputTaxRateModel"
                size="small"
                :min="0"
                :max="100"
                :precision="2"
                :disabled="disabled"
                style="width: 100%"
                placeholder="各规格共用"
                addon-after="%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="采购含税">
              <a-input-number
                :value="inclTax(draft.purchasePrice, inputTaxRate)"
                size="small"
                :precision="2"
                disabled
                style="width: 100%"
                placeholder="自动计算"
                :addon-after="priceAddon"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注" class="remark-item">
              <a-textarea v-model:value="draft.remark" size="small" :rows="2" :maxlength="100" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { createEmptyPackSpec, formatPackPrice, formatPackSpecText } from '@/utils/packSpec'
import { getAllEnabledUnitOptions, unitState } from '@/store/unitStore'

const props = defineProps({
  packSpecs: { type: Array, default: () => [] },
  inventoryUnit: { type: String, default: '' },
  outputTaxRate: { type: [Number, String], default: null },
  inputTaxRate: { type: [Number, String], default: null },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:packSpecs', 'update:outputTaxRate', 'update:inputTaxRate'])

const columns = [
  { title: '规格名称', key: 'name', dataIndex: 'name' },
  { title: '换算', key: 'convert', width: 180 },
  { title: '销售单价', key: 'salesPrice', width: 140, align: 'right' },
  { title: '采购单价', key: 'purchasePrice', width: 140, align: 'right' },
  { title: '状态', key: 'status', width: 88 },
  { title: '操作', key: 'actions', width: 120 },
]

const priceAddon = computed(() => `元/${props.inventoryUnit || '库存单位'}`)

const outputTaxRateModel = computed({
  get: () =>
    props.outputTaxRate == null || props.outputTaxRate === '' ? null : props.outputTaxRate,
  set: (value) => emit('update:outputTaxRate', value),
})

const inputTaxRateModel = computed({
  get: () => (props.inputTaxRate == null || props.inputTaxRate === '' ? null : props.inputTaxRate),
  set: (value) => emit('update:inputTaxRate', value),
})

function inclTax(ex, rate) {
  if (ex == null || ex === '' || rate == null || rate === '') return null
  const n = Number(ex)
  const tax = Number(rate)
  if (!Number.isFinite(n) || !Number.isFinite(tax)) return null
  return Number((n * (1 + tax / 100)).toFixed(2))
}

const modalOpen = ref(false)
const editingId = ref('')
const draft = reactive(createEmptyPackSpec())

const packUnitOpts = computed(() => {
  void unitState.units
  const options = getAllEnabledUnitOptions()
  const current = String(draft.packUnit || '').trim()
  if (current && !options.some((item) => item.value === current)) {
    return [{ label: current, value: current }, ...options]
  }
  return options
})

function emitList(list) {
  const enabledDefaults = list.filter((row) => row.enabled !== false && row.isDefault)
  if (list.some((row) => row.enabled !== false) && !enabledDefaults.length) {
    const first = list.find((row) => row.enabled !== false)
    if (first) first.isDefault = true
  }
  emit('update:packSpecs', list)
}

function openCreate() {
  editingId.value = ''
  Object.assign(draft, createEmptyPackSpec({ isDefault: !props.packSpecs.length }))
  modalOpen.value = true
}

function openEdit(record) {
  editingId.value = record.id
  Object.assign(draft, createEmptyPackSpec(record))
  modalOpen.value = true
}

function submitModal() {
  const name = String(draft.name || '').trim()
  if (!name) {
    message.warning('请填写规格名称')
    return Promise.reject()
  }
  if (!draft.isBulk) {
    if (!String(draft.packUnit || '').trim()) {
      message.warning('请填写包装单位')
      return Promise.reject()
    }
    if (!(Number(draft.qty) > 0)) {
      message.warning('每件含量须大于 0')
      return Promise.reject()
    }
  }
  const duplicated = props.packSpecs.some(
    (row) => row.id !== editingId.value && String(row.name || '').trim() === name,
  )
  if (duplicated) {
    message.warning(`包装规格「${name}」重复`)
    return Promise.reject()
  }
  const nextRow = createEmptyPackSpec({
    ...draft,
    id: editingId.value || draft.id,
    name,
    packUnit: draft.isBulk ? '' : String(draft.packUnit || '').trim(),
    qty: draft.isBulk ? null : Number(draft.qty),
  })
  let list = props.packSpecs.map((row) => ({ ...row }))
  if (nextRow.isDefault) {
    list = list.map((row) => ({ ...row, isDefault: false }))
  }
  const idx = list.findIndex((row) => row.id === nextRow.id)
  if (idx === -1) list.push(nextRow)
  else list.splice(idx, 1, nextRow)
  emitList(list)
  modalOpen.value = false
}

function removeRow(record) {
  emitList(props.packSpecs.filter((row) => row.id !== record.id).map((row) => ({ ...row })))
}
</script>

<style scoped lang="less">
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.section-desc {
  margin: 0 0 12px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1.6;
}

.default-tag {
  margin-left: 6px;
}

.danger-link {
  color: #ff4d4f;
}
</style>
