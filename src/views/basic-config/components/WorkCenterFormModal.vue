<template>
  <a-modal
    :open="open"
    :title="record?.id ? '编辑工作中心' : '新增工作中心'"
    :width="720"
    :mask-closable="false"
    destroy-on-close
    @cancel="handleCancel"
  >
    <div class="modal-basic-card">
      <div class="section-title">基本信息</div>
      <a-form layout="inline" class="horizontal-form" :model="form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="8">
            <a-form-item label="编码" required>
              <a-input v-model:value="form.code" size="small" placeholder="如 WC-ACID-01" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="名称" required>
              <a-input v-model:value="form.name" size="small" placeholder="如 酸浸一线" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="机构类型" required>
              <a-select
                v-model:value="form.orgType"
                size="small"
                placeholder="请选择"
                :options="orgTypeOptions"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="上级机构">
              <a-select
                v-model:value="form.parentId"
                size="small"
                allow-clear
                show-search
                option-filter-prop="label"
                placeholder="不选则为顶级"
                :options="parentOptions"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="负责人">
              <a-input v-model:value="form.manager" size="small" placeholder="选填" allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="状态">
              <a-switch
                v-model:checked="statusEnabled"
                checked-children="启用"
                un-checked-children="禁用"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注" class="remark-item">
              <a-textarea v-model:value="form.remark" :rows="2" size="small" placeholder="选填" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>
    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  ORG_TYPE_OPTIONS,
  addWorkCenter,
  listParentCandidateOptions,
  updateWorkCenter,
  workCenterState,
} from '@/store/workCenterStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  record: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'saved'])

const saving = ref(false)
const form = reactive(emptyForm())
const orgTypeOptions = ORG_TYPE_OPTIONS

const statusEnabled = computed({
  get: () => form.status === '启用',
  set: (val) => {
    form.status = val ? '启用' : '禁用'
  },
})

const parentOptions = computed(() => {
  void workCenterState.centers
  return listParentCandidateOptions(props.record?.id || '')
})

function emptyForm() {
  return {
    code: '',
    name: '',
    orgType: 'workshop',
    parentId: undefined,
    manager: '',
    status: '启用',
    remark: '',
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    if (props.record?.id) {
      Object.assign(form, {
        code: props.record.code || '',
        name: props.record.name || '',
        orgType: props.record.orgType || 'workshop',
        parentId: props.record.parentId || undefined,
        manager: props.record.manager || '',
        status: props.record.status || '启用',
        remark: props.record.remark || '',
      })
    } else {
      Object.assign(form, emptyForm())
    }
  },
)

function handleCancel() {
  emit('update:open', false)
}

async function handleSave() {
  saving.value = true
  try {
    const payload = {
      ...form,
      parentId: form.parentId || '',
    }
    if (props.record?.id) {
      updateWorkCenter(props.record.id, payload)
    } else {
      addWorkCenter(payload)
    }
    message.success('保存成功')
    emit('saved')
    emit('update:open', false)
  } catch (err) {
    message.error(err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="less">
.modal-basic-card {
  padding: 12px 16px;
  border: 1px solid var(--divider, #e5e6eb);
  border-radius: 8px;
  background: #fff;
}
.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
</style>
