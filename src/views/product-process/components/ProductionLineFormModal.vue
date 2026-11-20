<template>
  <FormCreateShell
    :page-mode="pageMode"
    :open="open"
    :title="shellTitle"
    width="960px"
    :mask-closable="false"
    @cancel="handleCancel"
    @update:open="(val) => emit('update:open', val)"
  >
    <a-skeleton v-if="pageMode && loading" active :paragraph="{ rows: 10 }" />
    <template v-else>
      <div class="modal-basic-card">
        <div class="section-title">基本信息</div>
        <a-form ref="formRef" :model="form" :rules="rules" layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="8">
              <a-form-item label="产线编码" name="code">
                <a-input
                  v-model:value="form.code"
                  size="small"
                  allow-clear
                  placeholder="留空自动生成"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="产线名称" name="name" required>
                <a-input
                  v-model:value="form.name"
                  size="small"
                  allow-clear
                  placeholder="如酸浸 1# 线"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="所属车间" name="workshop">
                <a-input
                  v-model:value="form.workshop"
                  size="small"
                  allow-clear
                  placeholder="可不填"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="状态" name="status" required>
                <a-select
                  v-model:value="form.status"
                  size="small"
                  :options="statusOpts"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :span="16">
              <a-form-item label="备注" name="remark" class="remark-item">
                <a-input
                  v-model:value="form.remark"
                  size="small"
                  allow-clear
                  placeholder="可不填"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <div class="modal-basic-card station-card">
        <div class="section-head">
          <div class="section-title">工段（有序）</div>
          <a-button size="small" type="primary" @click="addStation">按序添加工段</a-button>
        </div>
        <p class="field-hint">
          设备与岗位挂在工段上。主线按顺序执行；支线须指定从哪个主线工段后分出、汇入哪个主线工段前。
        </p>
        <a-table
          :columns="stationColumns"
          :data-source="form.stations"
          :pagination="false"
          size="small"
          row-key="id"
          :scroll="{ x: 1200 }"
          :locale="{ emptyText: '请按工艺顺序添加工段' }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'seq'">
              <span v-if="record.pathKind === 'branch'" class="muted">支</span>
              <span v-else>{{ record.seq }}</span>
            </template>
            <template v-else-if="column.key === 'name'">
              <a-input v-model:value="record.name" size="small" placeholder="如反应" />
            </template>
            <template v-else-if="column.key === 'pathKind'">
              <a-select
                v-model:value="record.pathKind"
                size="small"
                :options="pathOpts"
                style="width: 100%"
                @change="() => onPathKindChange(record)"
              />
            </template>
            <template v-else-if="column.key === 'branchName'">
              <a-input
                v-if="record.pathKind === 'branch'"
                v-model:value="record.branchName"
                size="small"
                placeholder="支线A"
              />
              <span v-else class="muted">—</span>
            </template>
            <template v-else-if="column.key === 'fork'">
              <a-select
                v-if="record.pathKind === 'branch'"
                v-model:value="record.forkAfterSeq"
                size="small"
                allow-clear
                placeholder="分出后"
                :options="mainSeqOpts"
                style="width: 100%"
              />
              <span v-else class="muted">—</span>
            </template>
            <template v-else-if="column.key === 'join'">
              <a-select
                v-if="record.pathKind === 'branch'"
                v-model:value="record.joinBeforeSeq"
                size="small"
                allow-clear
                placeholder="汇入前"
                :options="mainSeqOpts"
                style="width: 100%"
              />
              <span v-else class="muted">—</span>
            </template>
            <template v-else-if="column.key === 'equipment'">
              <EquipmentSearchSelect
                v-model="record.equipmentIds"
                :options="equipmentOpts"
                placeholder="边搜边选设备"
                :max-tag-count="2"
              />
            </template>
            <template v-else-if="column.key === 'positions'">
              <a-select
                v-model:value="record.positionNames"
                mode="multiple"
                allow-clear
                show-search
                size="small"
                option-filter-prop="label"
                placeholder="岗位"
                :options="positionOpts"
                :max-tag-count="2"
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space :size="4">
                <a-button
                  type="link"
                  size="small"
                  :disabled="index === 0"
                  @click="moveStation(index, -1)"
                  >上移</a-button
                >
                <a-button
                  type="link"
                  size="small"
                  :disabled="index >= form.stations.length - 1"
                  @click="moveStation(index, 1)"
                  >下移</a-button
                >
                <a-button type="link" size="small" danger @click="removeStation(record.id)"
                  >删除</a-button
                >
              </a-space>
            </template>
          </template>
        </a-table>

        <ProductionLineTopologyPreview :stations="form.stations" />
      </div>
    </template>

    <template #footer>
      <a-button :size="pageMode ? 'small' : 'middle'" @click="handleCancel">取消</a-button>
      <a-button
        type="primary"
        :size="pageMode ? 'small' : 'middle'"
        :loading="saving"
        :disabled="loading"
        @click="handleSave"
      >
        保存
      </a-button>
    </template>
  </FormCreateShell>
</template>

<script>
export default { name: 'ProductionLineFormModal' }
</script>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import FormCreateShell from '@/components/FormCreateShell.vue'
import { useFormCreateModal } from '@/composables/useFormCreateModal'
import {
  PRODUCTION_LINE_PATH_BRANCH,
  PRODUCTION_LINE_PATH_MAIN,
  PRODUCTION_LINE_PATH_OPTIONS,
  PRODUCTION_LINE_STATUS,
  addProductionLine,
  createLineStation,
  getProductionLineById,
  updateProductionLine,
} from '@/store/productionLineStore'
import { equipmentState } from '@/store/equipmentStore'
import { EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
import { positionOptions } from '@/store/employeeGroupStore'
import { MOCK_POSITIONS } from '@/mock/processConfigSeed'
import ProductionLineTopologyPreview from '@/views/product-process/components/ProductionLineTopologyPreview.vue'
import EquipmentSearchSelect from '@/views/product-process/components/EquipmentSearchSelect.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  pageMode: { type: Boolean, default: false },
  listPath: { type: String, default: '/product-process/production-line' },
  record: { type: Object, default: null },
  recordId: { type: String, default: '' },
})

const emit = defineEmits(['update:open', 'saved', 'cancel'])
const route = useRoute()

const formRef = ref()
const saving = ref(false)
const loading = ref(false)

const editingId = computed(() => {
  if (props.record?.id) return String(props.record.id)
  if (props.recordId) return String(props.recordId).trim()
  return String(route.query.id || '').trim() || ''
})

const isEdit = computed(() => Boolean(editingId.value))

const { shellTitle, handleCancel, closeAfterSave } = useFormCreateModal(props, emit, {
  listPath: '/product-process/production-line',
  getTitle: () => (isEdit.value ? '编辑产线' : '新增产线'),
})

const form = reactive({
  code: '',
  name: '',
  workshop: '',
  status: '使用中',
  stations: [],
  remark: '',
})

const statusOpts = PRODUCTION_LINE_STATUS.map((v) => ({ label: v, value: v }))
const pathOpts = PRODUCTION_LINE_PATH_OPTIONS
const positionOpts = [...new Set([...(MOCK_POSITIONS || []), ...(positionOptions || [])])].map(
  (name) => ({ label: name, value: name }),
)
const equipmentOpts = computed(() =>
  (equipmentState.devices || [])
    .filter((d) => d.status !== EQUIPMENT_STATUS.SCRAPPED)
    .map((d) => ({
      value: d.id,
      label: d.code ? `${d.name}（${d.code}）` : d.name,
    })),
)

const mainSeqOpts = computed(() =>
  form.stations
    .filter((s) => s.pathKind !== PRODUCTION_LINE_PATH_BRANCH)
    .map((s) => ({
      value: Number(s.seq),
      label: `#${s.seq} ${s.name || '主线工段'}`,
    })),
)

const stationColumns = [
  { title: '顺序', key: 'seq', width: 64 },
  { title: '工段名称', key: 'name', width: 120 },
  { title: '路径', key: 'pathKind', width: 96 },
  { title: '支线名', key: 'branchName', width: 100 },
  { title: '分出点', key: 'fork', width: 140 },
  { title: '汇合点', key: 'join', width: 140 },
  { title: '设备', key: 'equipment', width: 220 },
  { title: '岗位', key: 'positions', width: 160 },
  { title: '操作', key: 'action', width: 160, fixed: 'right' },
]

const rules = {
  name: [{ required: true, message: '请输入产线名称', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

function fillForm(row) {
  form.code = row?.code || ''
  form.name = row?.name || ''
  form.workshop = row?.workshop || ''
  form.status = row?.status || '使用中'
  form.remark = row?.remark || ''
  form.stations = (row?.stations || []).map((st) => createLineStation(st))
}

function nextSeq() {
  return form.stations.reduce((max, st) => Math.max(max, Number(st.seq) || 0), 0) + 1
}

function remapBranchAnchors(beforeMains) {
  const oldSeqById = new Map(beforeMains.map((m) => [m.id, Number(m.seq)]))
  const newSeqById = new Map(
    form.stations
      .filter((s) => s.pathKind !== PRODUCTION_LINE_PATH_BRANCH)
      .map((m) => [m.id, Number(m.seq)]),
  )
  const oldToNew = new Map()
  oldSeqById.forEach((oldSeq, id) => {
    if (newSeqById.has(id)) oldToNew.set(oldSeq, newSeqById.get(id))
  })
  form.stations.forEach((st) => {
    if (st.pathKind !== PRODUCTION_LINE_PATH_BRANCH) return
    if (st.forkAfterSeq != null && oldToNew.has(Number(st.forkAfterSeq))) {
      st.forkAfterSeq = oldToNew.get(Number(st.forkAfterSeq))
    } else if (
      st.forkAfterSeq != null &&
      ![...newSeqById.values()].includes(Number(st.forkAfterSeq))
    ) {
      st.forkAfterSeq = null
    }
    if (st.joinBeforeSeq != null && oldToNew.has(Number(st.joinBeforeSeq))) {
      st.joinBeforeSeq = oldToNew.get(Number(st.joinBeforeSeq))
    } else if (
      st.joinBeforeSeq != null &&
      ![...newSeqById.values()].includes(Number(st.joinBeforeSeq))
    ) {
      st.joinBeforeSeq = null
    }
  })
}

function syncMainSeqByTableOrder() {
  const before = form.stations
    .filter((s) => s.pathKind !== PRODUCTION_LINE_PATH_BRANCH)
    .map((s) => ({ id: s.id, seq: Number(s.seq) }))
  let n = 0
  form.stations.forEach((st) => {
    if (st.pathKind === PRODUCTION_LINE_PATH_BRANCH) return
    n += 1
    st.seq = n
  })
  remapBranchAnchors(before)
  let b = n
  form.stations.forEach((st) => {
    if (st.pathKind !== PRODUCTION_LINE_PATH_BRANCH) return
    b += 1
    st.seq = b
  })
}

function addStation() {
  form.stations.push(
    createLineStation({
      seq: nextSeq(),
      name: '',
      pathKind: PRODUCTION_LINE_PATH_MAIN,
      equipmentIds: [],
      positionNames: [],
    }),
  )
  syncMainSeqByTableOrder()
}

function removeStation(id) {
  form.stations = form.stations.filter((st) => st.id !== id)
  syncMainSeqByTableOrder()
}

function moveStation(index, delta) {
  const next = index + delta
  if (next < 0 || next >= form.stations.length) return
  const list = [...form.stations]
  const [row] = list.splice(index, 1)
  list.splice(next, 0, row)
  form.stations = list
  syncMainSeqByTableOrder()
}

function onPathKindChange(record) {
  if (record.pathKind !== PRODUCTION_LINE_PATH_BRANCH) {
    record.branchName = ''
    record.forkAfterSeq = null
    record.joinBeforeSeq = null
  }
  syncMainSeqByTableOrder()
}

function bootstrap() {
  if (props.pageMode) {
    loading.value = true
    const id = editingId.value
    const row = id ? getProductionLineById(id) : null
    if (id && !row) {
      message.warning('产线不存在或已删除')
      fillForm(null)
    } else {
      fillForm(row)
    }
    loading.value = false
    return
  }
  if (!props.open) return
  fillForm(props.record)
}

watch(
  () => [props.open, props.pageMode, editingId.value, props.record?.id],
  () => {
    if (props.pageMode || props.open) bootstrap()
  },
  { immediate: true },
)

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  const payload = {
    code: form.code,
    name: form.name,
    workshop: form.workshop,
    status: form.status,
    remark: form.remark,
    stations: form.stations.map((st) => createLineStation(st)),
  }
  const res = isEdit.value
    ? updateProductionLine(editingId.value, payload)
    : addProductionLine(payload)
  saving.value = false
  if (!res.ok) {
    message.warning(res.message)
    return
  }
  message.success('保存成功')
  emit('saved')
  closeAfterSave()
}
</script>

<style scoped lang="less">
.modal-basic-card {
  margin-bottom: 12px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;

  &:last-of-type {
    margin-bottom: 0;
  }
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.section-head .section-title {
  margin-bottom: 0;
}

.field-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: #86909c;
}

.muted {
  color: #c9cdd4;
}

.horizontal-form {
  width: 100%;

  :deep(.ant-form-item) {
    width: 100%;
    margin-inline-end: 0;
    margin-bottom: 0;
  }

  :deep(.ant-form-item-label) {
    flex: 0 0 88px;
    width: 88px;
  }
}
</style>
