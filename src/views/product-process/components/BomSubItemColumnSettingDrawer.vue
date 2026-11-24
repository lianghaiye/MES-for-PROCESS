<template>
  <TableColumnSettingDrawer
    :open="open"
    :settings="settings"
    :default-settings="resolvedDefaults"
    title="列显隐"
    @update:open="emit('update:open', $event)"
    @update:settings="emit('update:settings', $event)"
  />
</template>

<script setup>
import { computed } from 'vue'
import TableColumnSettingDrawer from '@/components/TableColumnSettingDrawer.vue'
import { defaultBomSubItemPickerColumns } from '@/mock/bomSubItemPickerColumns'

const props = defineProps({
  open: Boolean,
  settings: { type: Array, default: () => [] },
  defaultSettings: { type: Array, default: () => [] },
})

const resolvedDefaults = computed(() =>
  props.defaultSettings?.length ? props.defaultSettings : defaultBomSubItemPickerColumns,
)

const emit = defineEmits(['update:open', 'update:settings'])
</script>
