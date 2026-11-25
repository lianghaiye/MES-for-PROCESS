<template>
  <div class="step-report-fields">
    <a-row v-if="fields.length" :gutter="[12, 12]" style="width: 100%">
      <a-col v-for="field in fields" :key="field.code" :span="fieldSpan(field)">
        <div class="field-block">
          <div class="field-label">
            <span v-if="field.required" class="req">*</span>
            {{ fieldLabel(field) }}
            <a-tag v-if="isSystem(field)" color="blue" class="sys-tag">系统</a-tag>
          </div>
          <template v-if="isSystem(field)">
            <a-input :value="displaySystem(field)" size="small" disabled />
            <div class="field-hint">{{ processFormSystemKeyLabel(field.systemKey) }}，自动带出</div>
          </template>
          <template v-else-if="field.type === 'number'">
            <a-input-number
              :value="model[field.code]"
              size="small"
              style="width: 100%"
              :placeholder="field.placeholder || `请输入${field.name}`"
              @update:value="(v) => setValue(field.code, v)"
            />
          </template>
          <template v-else-if="field.type === 'textarea'">
            <a-textarea
              :value="model[field.code]"
              size="small"
              :rows="2"
              :placeholder="field.placeholder || `请输入${field.name}`"
              @update:value="(v) => setValue(field.code, v)"
            />
          </template>
          <template v-else-if="field.type === 'date'">
            <a-date-picker
              :value="toDayjs(model[field.code])"
              size="small"
              style="width: 100%"
              @change="(_, text) => setValue(field.code, text || '')"
            />
          </template>
          <template v-else-if="field.type === 'datetime'">
            <a-date-picker
              :value="toDayjs(model[field.code])"
              show-time
              size="small"
              style="width: 100%"
              format="YYYY-MM-DD HH:mm:ss"
              @change="(_, text) => setValue(field.code, text || '')"
            />
          </template>
          <template v-else-if="field.type === 'radio'">
            <a-radio-group
              :value="model[field.code]"
              size="small"
              @update:value="(v) => setValue(field.code, v)"
            >
              <a-radio v-for="opt in optionsOf(field)" :key="opt" :value="opt">{{ opt }}</a-radio>
            </a-radio-group>
          </template>
          <template v-else-if="field.type === 'checkbox'">
            <a-checkbox-group
              :value="asArray(model[field.code])"
              @update:value="(v) => setValue(field.code, v)"
            >
              <a-checkbox v-for="opt in optionsOf(field)" :key="opt" :value="opt">{{
                opt
              }}</a-checkbox>
            </a-checkbox-group>
          </template>
          <template v-else>
            <a-input
              :value="model[field.code]"
              size="small"
              :placeholder="field.placeholder || `请输入${field.name}`"
              @update:value="(v) => setValue(field.code, v)"
            />
          </template>
        </div>
      </a-col>
    </a-row>
    <a-empty v-else description="本步未关联过程记录模板" :image="false" />
  </div>
</template>

<script setup>
import dayjs from 'dayjs'
import {
  isProcessFormSystemField,
  processFormSystemKeyLabel,
  resolveProcessFormSystemValue,
} from '@/utils/processFormSystemField'

const props = defineProps({
  fields: { type: Array, default: () => [] },
  model: { type: Object, default: () => ({}) },
  systemCtx: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:model'])

function isSystem(field) {
  return isProcessFormSystemField(field)
}

function fieldLabel(field) {
  if (field.unit) return `${field.name}（${field.unit}）`
  return field.name || field.code
}

/** 一行 4 个；长文本 / 多选整行 */
function fieldSpan(field) {
  if (field?.type === 'textarea' || field?.type === 'checkbox') return 24
  return 6
}

function optionsOf(field) {
  if (Array.isArray(field.options) && field.options.length) return field.options
  if (Array.isArray(field.optionRows)) return field.optionRows.map((o) => o.value).filter(Boolean)
  return []
}

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : []
}

function toDayjs(value) {
  if (!value) return null
  const d = dayjs(value)
  return d.isValid() ? d : null
}

function displaySystem(field) {
  return resolveProcessFormSystemValue(field.systemKey, props.systemCtx)
}

function setValue(code, value) {
  emit('update:model', { ...props.model, [code]: value })
}
</script>

<style scoped lang="less">
.step-report-fields {
  width: 100%;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field-label {
  font-size: 13px;
  color: #4e5969;
  line-height: 20px;
}

.req {
  color: #f53f3f;
  margin-right: 2px;
}

.sys-tag {
  margin-left: 6px;
}

.field-hint {
  font-size: 12px;
  color: #86909c;
  line-height: 18px;
}
</style>
