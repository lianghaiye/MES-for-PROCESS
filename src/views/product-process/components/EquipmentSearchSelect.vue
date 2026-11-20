<template>
  <div class="equipment-search-select">
    <a-select
      :value="selectValue"
      :mode="multiple ? 'multiple' : undefined"
      allow-clear
      show-search
      size="small"
      option-filter-prop="label"
      :placeholder="placeholder"
      :options="mergedOptions"
      :max-tag-count="multiple ? maxTagCount : undefined"
      :disabled="disabled"
      style="width: 100%"
      :open="dropdownOpen"
      @change="onChange"
      @dropdown-visible-change="onDropdownVisibleChange"
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

    <SelectEquipmentModal
      v-model:open="pickerOpen"
      :selected="selectedIds"
      :allow-ids="allowIds"
      :category-filter="categoryFilter"
      :multiple="multiple"
      @confirm="onPicked"
    />
  </div>
</template>

<script>
export default { name: 'EquipmentSearchSelect' }
</script>

<script setup>
import { computed, ref } from 'vue'
import { deviceLabelById } from '@/store/equipmentStore'
import SelectEquipmentModal from '@/views/product-process/components/SelectEquipmentModal.vue'

const props = defineProps({
  /** 多选：string[]；单选：string */
  modelValue: { type: [Array, String], default: undefined },
  options: { type: Array, default: () => [] },
  /** 弹窗可选范围；null=不限制（未报废）；[]=无可选项 */
  allowIds: { type: Array, default: null },
  categoryFilter: { type: String, default: '' },
  placeholder: { type: String, default: '边搜边选设备' },
  maxTagCount: { type: Number, default: 2 },
  disabled: { type: Boolean, default: false },
  multiple: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'change'])

const dropdownOpen = ref(false)
const pickerOpen = ref(false)

const selectedIds = computed(() => {
  if (props.multiple) {
    return Array.isArray(props.modelValue) ? props.modelValue.filter(Boolean) : []
  }
  const id = String(props.modelValue || '').trim()
  return id ? [id] : []
})

const selectValue = computed(() => {
  if (props.multiple) return Array.isArray(props.modelValue) ? props.modelValue : []
  return props.modelValue || undefined
})

const mergedOptions = computed(() => {
  const opts = [...(props.options || [])]
  const seen = new Set(opts.map((o) => o.value))
  selectedIds.value.forEach((id) => {
    if (id && !seen.has(id)) {
      opts.unshift({ value: id, label: deviceLabelById(id) || id })
      seen.add(id)
    }
  })
  return opts
})

function emitValue(next) {
  emit('update:modelValue', next)
  emit('change', next)
}

function onChange(val) {
  if (props.multiple) {
    emitValue(Array.isArray(val) ? [...val] : [])
    return
  }
  emitValue(val || '')
}

function onDropdownVisibleChange(open) {
  dropdownOpen.value = open
}

function openPicker() {
  dropdownOpen.value = false
  pickerOpen.value = true
}

function onPicked(ids) {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : []
  if (props.multiple) {
    emitValue([...list])
    return
  }
  emitValue(list[0] || '')
}
</script>

<style scoped lang="less">
.equipment-search-select {
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
</style>
