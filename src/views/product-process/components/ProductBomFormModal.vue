<template>
  <a-modal
    :open="open"
    :title="isEdit ? '编辑 BOM' : '新增 BOM'"
    width="640px"
    :mask-closable="false"
    destroy-on-close
    @cancel="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      layout="horizontal"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="horizontal-form"
    >
      <a-form-item label="BOM名称" name="bomName">
        <a-input v-model:value="form.bomName" placeholder="请输入 BOM 名称" />
      </a-form-item>
      <a-form-item label="关联物品" name="masterId" value-prop-name="modelValue">
        <MasterItemSelect placeholder="请选择产品或物料" @select="onMasterSelect" />
      </a-form-item>
      <a-form-item label="物品类型">
        <a-tag :color="form.itemType === 'product' ? 'blue' : 'cyan'">
          {{ form.itemType === 'product' ? '产品' : '物料' }}
        </a-tag>
      </a-form-item>
      <a-form-item v-if="isEdit" label="BOM版本">
        <span>{{ editRecord?.version }}</span>
        <span class="version-hint">（待发布状态保存后不自动升版）</span>
      </a-form-item>
      <a-form-item v-else label="初始版本">
        <span>{{ previewVersion }}</span>
      </a-form-item>
      <a-form-item label="备注" name="remark">
        <a-textarea v-model:value="form.remark" :rows="3" placeholder="选填" />
      </a-form-item>
      <a-alert
        type="info"
        show-icon
        message="保存后状态为「待发布」，需审核发布后方可用于生产；同一产品/物料同时仅允许一个「生效」版本。"
        class="form-tip"
      />
    </a-form>
    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" :loading="saving" @click="handleOk">保存</a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import MasterItemSelect from '@/views/product-process/components/MasterItemSelect.vue'
import { saveProductBom } from '@/store/productBomStore'
import { formatBomVersion, getBomVersionYear, nextSubVersionForYear } from '@/utils/bomVersion'

const props = defineProps({
  open: { type: Boolean, default: false },
  editRecord: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'saved'])

const formRef = ref()
const saving = ref(false)
const isEdit = computed(() => !!props.editRecord?.id)

const form = reactive({
  bomName: '',
  masterId: undefined,
  itemId: undefined,
  itemType: 'product',
  itemName: '',
  itemCode: '',
  remark: '',
})

const rules = {
  bomName: [{ required: true, message: '请输入 BOM 名称' }],
  masterId: [{ required: true, message: '请选择关联物品' }],
}

const previewVersion = computed(() => {
  const year = getBomVersionYear()
  const sub = nextSubVersionForYear([], year)
  return formatBomVersion(year, sub)
})

function onMasterSelect(item) {
  if (!item) {
    form.masterId = undefined
    form.itemId = undefined
    form.itemName = ''
    form.itemCode = ''
    return
  }
  form.masterId = item.id
  form.itemType = item.itemType === '物料' ? 'material' : 'product'
  form.itemId = item.id
  form.itemName = item.name
  form.itemCode = item.code
  if (!form.bomName) form.bomName = `${item.name} BOM`
}

function resetForm() {
  form.bomName = ''
  form.masterId = undefined
  form.itemId = undefined
  form.itemType = 'product'
  form.itemName = ''
  form.itemCode = ''
  form.remark = ''
}

watch(
  () => props.open,
  (v) => {
    if (!v) return
    if (props.editRecord) {
      const r = props.editRecord
      form.bomName = r.bomName
      form.masterId = r.itemId
      form.itemId = r.itemId
      form.itemType = r.itemType
      form.itemName = r.itemName
      form.itemCode = r.itemCode
      form.remark = r.remark || ''
    } else {
      resetForm()
    }
  },
)

function handleCancel() {
  emit('update:open', false)
}

async function handleOk() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const itemId = form.masterId || form.itemId
    const payload = {
      bomName: form.bomName,
      itemType: form.itemType,
      itemId,
      itemName: form.itemName,
      itemCode: form.itemCode,
      remark: form.remark,
    }
    const res = saveProductBom(isEdit.value ? props.editRecord.id : null, payload)
    if (res?.error) {
      message.warning(res.error)
      return
    }
    if (res.versionUpgraded) {
      message.success(
        `已生成新版本 ${res.record.version}（待发布），当前生效版本保持不变，审核发布后新版本才生效`,
      )
    } else {
      message.success(isEdit.value ? '已保存' : '已创建，状态为待发布，可在列表中审核发布')
    }
    emit('saved')
    emit('update:open', false)
  } finally {
    saving.value = false
  }
}
</script>

<style lang="less" scoped>
.version-hint {
  margin-left: 8px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.form-tip {
  margin-top: 8px;
}
</style>
