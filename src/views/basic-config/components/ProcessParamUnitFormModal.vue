<template>
  <a-modal
    :open="open"
    :title="isEdit ? '编辑工艺参数单位' : '新增工艺参数单位'"
    :width="520"
    :mask-closable="false"
    destroy-on-close
    @cancel="handleCancel"
  >
    <div class="modal-basic-card">
      <a-form layout="inline" class="horizontal-form" :model="form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="24">
            <a-form-item label="单位符号" required>
              <a-input v-model:value="form.name" size="small" placeholder="如 ℃、min、rpm" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="类别" required>
              <a-select
                v-model:value="form.category"
                size="small"
                placeholder="请选择"
                :options="categoryOptions"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注" class="remark-item">
              <a-textarea v-model:value="form.remark" size="small" :rows="2" placeholder="选填" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>
    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" :loading="saving" @click="handleOk">保存</a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PARAM_UNIT_CATEGORIES, saveProcessParamUnit } from '@/store/processParamUnitStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  record: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'saved'])

const saving = ref(false)
const isEdit = computed(() => Boolean(props.record?.id))
const categoryOptions = PARAM_UNIT_CATEGORIES.map((item) => ({ label: item, value: item }))
const form = reactive({ name: '', category: undefined, remark: '' })

watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.name = props.record?.name || ''
    form.category = props.record?.category || undefined
    form.remark = props.record?.remark || ''
  },
)

function handleCancel() {
  emit('update:open', false)
}

function handleOk() {
  saving.value = true
  const result = saveProcessParamUnit(form, props.record?.id)
  saving.value = false
  if (!result.ok) {
    message.warning(result.message)
    return Promise.reject(new Error(result.message))
  }
  message.success('保存成功')
  emit('saved')
  emit('update:open', false)
  return undefined
}
</script>
