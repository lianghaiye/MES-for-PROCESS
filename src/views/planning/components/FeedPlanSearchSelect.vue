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
    :dropdown-match-select-width="280"
    :open="dropdownOpen"
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

  <a-modal
    :open="pickerOpen"
    :title="title"
    :width="720"
    :mask-closable="false"
    destroy-on-close
    @cancel="pickerOpen = false"
  >
    <a-input
      v-model:value="pickerKeyword"
      size="small"
      allow-clear
      placeholder="输入编码或名称"
      style="margin-bottom: 12px"
    />
    <a-table
      size="small"
      row-key="value"
      :columns="columns"
      :data-source="pickerRows"
      :pagination="{ pageSize: 8, size: 'small', showTotal: (total) => `共 ${total} 条` }"
      :row-selection="rowSelection"
      :custom-row="customRow"
      :locale="{ emptyText: '没有可选项' }"
    />
    <template #footer>
      <a-button @click="pickerOpen = false">取消</a-button>
      <a-button type="primary" :disabled="!pickedKey" @click="confirmPick">确定</a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
  title: { type: String, default: '选择' },
})

const emit = defineEmits(['update:modelValue', 'change'])

const DROPDOWN_LIMIT = 8
const searchKeyword = ref('')
const dropdownOpen = ref(false)
const pickerOpen = ref(false)
const pickerKeyword = ref('')
const pickedKey = ref('')

const columns = [{ title: '名称', dataIndex: 'label', key: 'label', ellipsis: true }]

const displayOptions = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const matched = keyword
    ? props.options.filter((row) =>
        String(row.label || '')
          .toLowerCase()
          .includes(keyword),
      )
    : props.options
  const sliced = keyword ? matched.slice(0, 50) : matched.slice(0, DROPDOWN_LIMIT)
  const options = sliced.map((row) => ({ value: row.value, label: row.label }))
  if (props.modelValue && !options.some((row) => row.value === props.modelValue)) {
    const current = props.options.find((row) => row.value === props.modelValue)
    if (current) options.unshift({ value: current.value, label: current.label })
  }
  return options
})

const pickerRows = computed(() => {
  const keyword = pickerKeyword.value.trim().toLowerCase()
  if (!keyword) return props.options
  return props.options.filter((row) =>
    String(row.label || '')
      .toLowerCase()
      .includes(keyword),
  )
})

const rowSelection = computed(() => ({
  type: 'radio',
  selectedRowKeys: pickedKey.value ? [pickedKey.value] : [],
  onChange: (keys) => {
    pickedKey.value = keys[0] || ''
  },
}))

function onSearch(keyword) {
  searchKeyword.value = keyword || ''
}

function onDropdownVisibleChange(open) {
  dropdownOpen.value = open
  if (!open) searchKeyword.value = ''
}

function onSelectChange(value) {
  emit('update:modelValue', value || '')
  emit('change', value || '')
}

function openPicker() {
  if (props.disabled) return
  dropdownOpen.value = false
  pickerKeyword.value = ''
  pickedKey.value = props.modelValue || ''
  pickerOpen.value = true
}

function customRow(record) {
  return {
    onClick: () => {
      pickedKey.value = record.value
    },
  }
}

function confirmPick() {
  if (!pickedKey.value) return
  emit('update:modelValue', pickedKey.value)
  emit('change', pickedKey.value)
  pickerOpen.value = false
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
