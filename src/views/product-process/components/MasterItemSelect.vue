<template>
  <a-select
    :value="modelValue || undefined"
    show-search
    allow-clear
    size="small"
    :placeholder="placeholder"
    :disabled="disabled"
    style="width: 100%"
    :filter-option="false"
    :options="displayOptions"
    :dropdown-match-select-width="360"
    @search="onSearch"
    @dropdown-visible-change="onDropdownVisibleChange"
    @change="onSelectChange"
  >
    <template #dropdownRender="{ menuNode: menu }">
      <div>
        <component :is="menu" />
        <template v-if="!disabled">
          <a-divider style="margin: 4px 0" />
          <div class="search-more-row" @mousedown.prevent @click="openPicker">选择更多</div>
        </template>
      </div>
    </template>
  </a-select>

  <SelectBomMaterialModal
    v-model:open="pickerOpen"
    :title="resolvedModalTitle"
    :multiple="false"
    hide-add-material
    :picker-default-item-type="catalog === 'product' ? '产品' : ''"
    @selected="onPicked"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import { materialInfoState } from '@/store/materialInfoStore'
import { PROCESS_ITEMS } from '@/store/materialBatchStore'
import { productInfoState } from '@/store/productInfoStore'
import { isProductArchived } from '@/utils/productStatus'
import SelectBomMaterialModal from './SelectBomMaterialModal.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '请选择物料' },
  disabled: { type: Boolean, default: false },
  /** all：产品与物料；product：只选产品 */
  catalog: { type: String, default: 'all' },
  /** 覆盖弹窗标题。主产品场景用「选择主产品」 */
  modalTitle: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'change', 'select'])

const pickerOpen = ref(false)
const searchKeyword = ref('')
const DROPDOWN_LIMIT = 8

const resolvedModalTitle = computed(
  () => props.modalTitle || (props.catalog === 'product' ? '选择产品' : '选择物料'),
)

const catalogRows = computed(() => {
  void productInfoState.products
  void materialInfoState.materials
  const rows = []
  const seen = new Set()
  const push = (row) => {
    if (!row?.id || seen.has(row.id)) return
    seen.add(row.id)
    rows.push(row)
  }
  if (props.catalog !== 'material') {
    productInfoState.products.forEach((item) => {
      if (isProductArchived(item)) return
      push(toRow(item, '产品'))
    })
  }
  if (props.catalog !== 'product') {
    materialInfoState.materials.forEach((item) => {
      if (isProductArchived(item)) return
      push(toRow(item, '物料'))
    })
  }
  PROCESS_ITEMS.forEach((item) => {
    const itemType = item.kind === 'fg' || item.kind === 'by' ? '产品' : '物料'
    if (props.catalog === 'product' && itemType !== '产品') return
    push({
      id: item.id,
      code: item.code || '',
      name: item.name || '',
      itemType,
      specModel: '',
      material: '',
      drawingNo: '',
      variantSummary: '',
      inventoryUnit: '',
    })
  })
  return rows
})

const displayOptions = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const matched = keyword
    ? catalogRows.value.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(keyword))
    : catalogRows.value
  const sliced = keyword ? matched.slice(0, 50) : matched.slice(0, DROPDOWN_LIMIT)
  const options = sliced.map(toOption)
  if (props.modelValue && !options.some((option) => option.value === props.modelValue)) {
    const current = catalogRows.value.find((row) => row.id === props.modelValue)
    if (current) options.unshift(toOption(current))
  }
  return options
})

function toRow(item, itemType) {
  return {
    id: item.id,
    code: item.code || '',
    name: item.name || '',
    itemType,
    specModel: item.specModel || '',
    material: item.material || '',
    drawingNo: item.drawingNo || '',
    variantSummary: item.variantSummary || '',
    inventoryUnit: item.inventoryUnit || '',
  }
}

function toOption(row) {
  return {
    value: row.id,
    label: `[${row.code}] ${row.name}`,
    item: row,
  }
}

function emitItem(id) {
  const item = id ? catalogRows.value.find((row) => row.id === id) || null : null
  emit('update:modelValue', id || '')
  emit('change', id || '')
  emit('select', item)
}

function onSearch(keyword) {
  searchKeyword.value = keyword || ''
}

function onDropdownVisibleChange(open) {
  if (!open) searchKeyword.value = ''
}

function onSelectChange(id) {
  emitItem(id)
}

function openPicker() {
  if (props.disabled) return
  pickerOpen.value = true
}

function onPicked(items) {
  const payload = Array.isArray(items) ? items[0] : items
  if (!payload?.id) return
  const known = catalogRows.value.find((row) => row.id === payload.id)
  emit('update:modelValue', payload.id)
  emit('change', payload.id)
  emit(
    'select',
    known || {
      id: payload.id,
      code: payload.code || '',
      name: payload.name || '',
      itemType: payload.itemType || '产品',
      specModel: payload.specModel || '',
      material: payload.material || '',
      drawingNo: payload.drawingNo || '',
      variantSummary: '',
      inventoryUnit: payload.inventoryUnit || '',
    },
  )
}
</script>

<style lang="less" scoped>
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
</style>
