<template>
  <a-select
    :value="value || undefined"
    show-search
    allow-clear
    :size="size"
    :placeholder="placeholder"
    :disabled="disabled"
    style="width: 100%"
    :filter-option="false"
    :options="displayOptions"
    :open="innerOpen"
    :dropdown-match-select-width="420"
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

  <BatchInstructionSelectModal
    v-model:open="pickerOpen"
    :orders="orders"
    :exclude-ids="excludeIds"
    :selected-id="value"
    @confirm="onPickedFromModal"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import { itemMasterCard } from '@/store/processFormulaStore'
import BatchInstructionSelectModal from '@/views/production/components/BatchInstructionSelectModal.vue'

const QUICK_LIMIT = 8
const SEARCH_LIMIT = 50

const props = defineProps({
  value: { type: String, default: '' },
  orders: { type: Array, default: () => [] },
  excludeIds: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请搜索或选择批次指令' },
  size: { type: String, default: 'small' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:value', 'change'])

const pickerOpen = ref(false)
const searchKeyword = ref('')
const innerOpen = ref(false)

const availableOrders = computed(() => {
  const excluded = new Set((props.excludeIds || []).filter((id) => id && id !== props.value))
  return (props.orders || []).filter((row) => row?.id && !excluded.has(row.id))
})

function orderLabel(order) {
  if (!order) return ''
  const card = itemMasterCard(order.itemId)
  const name = card.name || order.formulaName || ''
  return `${order.batchNo || ''}${name ? ` ${name}` : ''}`.trim()
}

const displayOptions = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const matched = keyword
    ? availableOrders.value.filter((order) => {
        const card = itemMasterCard(order.itemId)
        const text = [order.batchNo, order.formulaName, card.code, card.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return text.includes(keyword)
      })
    : availableOrders.value
  const limit = keyword ? SEARCH_LIMIT : QUICK_LIMIT
  const options = matched.slice(0, limit).map((order) => ({
    value: order.id,
    label: orderLabel(order),
  }))
  if (props.value && !options.some((option) => option.value === props.value)) {
    const current = availableOrders.value.find((order) => order.id === props.value)
    if (current) options.unshift({ value: current.id, label: orderLabel(current) })
  }
  return options
})

function onSearch(keyword) {
  searchKeyword.value = keyword || ''
}

function onDropdownVisibleChange(open) {
  innerOpen.value = open
  if (!open) searchKeyword.value = ''
}

function onSelectChange(nextValue) {
  emit('update:value', nextValue || '')
  emit('change', nextValue || '')
}

function openPicker() {
  if (props.disabled) return
  innerOpen.value = false
  pickerOpen.value = true
}

function onPickedFromModal(order) {
  if (!order?.id) return
  emit('update:value', order.id)
  emit('change', order.id)
}
</script>

<script>
export default { name: 'BatchInstructionSearchSelect' }
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
