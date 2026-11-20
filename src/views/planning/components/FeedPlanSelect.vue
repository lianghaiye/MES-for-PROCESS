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

  <SelectFeedPlanModal
    v-model:open="pickerOpen"
    :title="modalTitle"
    :initial-selected-id="modelValue"
    @selected="onPicked"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import { listGeneratableFeedPlanOptions } from '@/store/feedPlanStore'
import SelectFeedPlanModal from './SelectFeedPlanModal.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '请选择生产计划' },
  disabled: { type: Boolean, default: false },
  modalTitle: { type: String, default: '选择生产计划' },
})

const emit = defineEmits(['update:modelValue', 'change'])

const pickerOpen = ref(false)
const searchKeyword = ref('')
const DROPDOWN_LIMIT = 8

const allOptions = computed(() => listGeneratableFeedPlanOptions())

const displayOptions = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const matched = keyword
    ? allOptions.value.filter((row) =>
        String(row.label || '')
          .toLowerCase()
          .includes(keyword),
      )
    : allOptions.value
  const sliced = keyword ? matched.slice(0, 50) : matched.slice(0, DROPDOWN_LIMIT)
  const options = sliced.map((row) => ({ value: row.value, label: row.label }))
  if (props.modelValue && !options.some((row) => row.value === props.modelValue)) {
    const current = allOptions.value.find((row) => row.value === props.modelValue)
    if (current) options.unshift({ value: current.value, label: current.label })
  }
  return options
})

function emitValue(id) {
  emit('update:modelValue', id || '')
  emit('change', id || '')
}

function onSearch(keyword) {
  searchKeyword.value = keyword || ''
}

function onDropdownVisibleChange(open) {
  if (!open) searchKeyword.value = ''
}

function onSelectChange(id) {
  emitValue(id)
}

function openPicker() {
  if (props.disabled) return
  pickerOpen.value = true
}

function onPicked(row) {
  if (!row?.id) return
  emitValue(row.id)
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
