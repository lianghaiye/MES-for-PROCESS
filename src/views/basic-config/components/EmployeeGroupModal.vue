<template>
  <FormCreateShell
    :page-mode="pageMode"
    :open="open"
    :title="shellTitle"
    width="1100px"
    @cancel="handleCancel"
    @update:open="(val) => emit('update:open', val)"
  >
    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      layout="inline"
      class="group-form horizontal-form"
    >
      <div class="form-section-box modal-basic-card">
        <div class="section-title">基本信息</div>
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="8" class="field-col">
            <a-form-item label="编码" name="code" required>
              <a-input-group compact>
                <a-input
                  v-model:value="form.code"
                  size="small"
                  placeholder="请输入编码"
                  style="width: calc(100% - 88px)"
                />
                <a-button size="small" @click="genCode">生成编码</a-button>
              </a-input-group>
            </a-form-item>
          </a-col>
          <a-col :span="8" class="field-col">
            <a-form-item label="名称" name="name" required>
              <a-input v-model:value="form.name" size="small" placeholder="请输入名称" />
            </a-form-item>
          </a-col>
          <a-col :span="8" class="field-col">
            <a-form-item label="工作中心" name="workCenterId" required>
              <a-select
                v-model:value="form.workCenterId"
                size="small"
                placeholder="请选择工作中心"
                :options="workCenterOpts"
                show-search
                option-filter-prop="label"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8" class="field-col">
            <a-form-item label="允许生成任务">
              <a-switch v-model:checked="form.allowTaskGen" />
            </a-form-item>
          </a-col>
          <a-col :span="8" class="field-col">
            <a-form-item label="组长参与生产">
              <a-switch v-model:checked="form.leaderParticipates" />
            </a-form-item>
          </a-col>
          <a-col :span="8" class="field-col">
            <a-form-item label="执行人多选">
              <a-switch v-model:checked="form.multiExecutor" />
            </a-form-item>
          </a-col>
          <a-col :span="8" class="field-col">
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
              <a-textarea v-model:value="form.remark" size="small" placeholder="选填" :rows="2" />
            </a-form-item>
          </a-col>
        </a-row>
      </div>

      <div class="form-section-box modal-basic-card">
        <div class="section-head">
          <div class="section-title">组内人员</div>
          <a-button size="small" type="primary" @click="openWorkerPicker">
            <PlusOutlined />
            选择工人
          </a-button>
        </div>
        <p class="section-hint">
          选择工人后自动带出岗位。在列表中勾选「组长」（仅一人）；组内可含不同岗位与早晚班人员。
        </p>
        <a-table
          :columns="workerCols"
          :data-source="form.workers"
          :pagination="false"
          size="small"
          row-key="id"
          :locale="{ emptyText: '请选择工人' }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'seq'">{{ index + 1 }}</template>
            <template v-else-if="column.key === 'position'">
              <span class="readonly-cell">{{ record.position || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'isLeader'">
              <a-checkbox
                :checked="Boolean(record.isLeader)"
                @change="(e) => onLeaderCheck(record, e.target.checked)"
              />
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-button type="link" size="small" danger @click="removeWorker(record.id)">
                删除
              </a-button>
            </template>
          </template>
        </a-table>
      </div>
    </a-form>

    <template #footer>
      <a-button :size="pageMode ? 'small' : 'middle'" @click="handleCancel">
        <CloseOutlined />
        取消
      </a-button>
      <a-button type="primary" :size="pageMode ? 'small' : 'middle'" @click="handleSave">
        <SaveOutlined />
        保存
      </a-button>
    </template>
  </FormCreateShell>

  <SelectPersonModal
    v-if="isActive"
    v-model:open="workerPickerOpen"
    :selected="form.workers.map((w) => w.name)"
    @confirm="onWorkersSelected"
  />
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CloseOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import FormCreateShell from '@/components/FormCreateShell.vue'
import { useFormCreateModal } from '@/composables/useFormCreateModal'
import SelectPersonModal from '@/views/production/components/SelectPersonModal.vue'
import { mockEmployees } from '@/mock/workOrderMaster'
import { addEmployeeGroup, updateEmployeeGroup } from '@/store/employeeGroupStore'
import { listEnabledWorkCenters, workCenterState } from '@/store/workCenterStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  pageMode: { type: Boolean, default: false },
  listPath: { type: String, default: '' },
  record: { type: Object, default: null },
})

const emit = defineEmits(['update:open', 'saved'])

const formRef = ref()
const workerPickerOpen = ref(false)

const form = reactive({
  code: '',
  name: '',
  workCenterId: undefined,
  allowTaskGen: true,
  leaderParticipates: true,
  multiExecutor: true,
  status: '启用',
  remark: '',
  workers: [],
})

const isEdit = computed(() => !!props.record?.id)

const { isActive, shellTitle, handleCancel, closeAfterSave } = useFormCreateModal(props, emit, {
  listPath: '/basic-config/employee-groups',
  getTitle: () => (isEdit.value ? '编辑员工组别' : '新增员工组别'),
})

const rules = {
  code: [{ required: true, message: '请输入编码' }],
  name: [{ required: true, message: '请输入名称' }],
  workCenterId: [{ required: true, message: '请选择工作中心' }],
}

const workCenterOpts = computed(() => {
  void workCenterState.centers
  return listEnabledWorkCenters().map((row) => ({
    value: row.id,
    label: row.name,
  }))
})

const statusEnabled = computed({
  get: () => form.status === '启用',
  set: (val) => {
    form.status = val ? '启用' : '禁用'
  },
})

const workerCols = [
  { title: '#', key: 'seq', width: 56 },
  { title: '工人', dataIndex: 'name', width: 140 },
  { title: '岗位', key: 'position', width: 140 },
  { title: '组长', key: 'isLeader', width: 80, align: 'center' },
  { title: '操作', key: 'actions', width: 80 },
]

function enrichWorker(row) {
  const emp = mockEmployees.find((e) => e.id === row.id || e.name === row.name)
  return {
    id: row.id || emp?.id || `tmp-${row.name}`,
    name: row.name || emp?.name || '',
    position: row.position || emp?.position || '',
    isLeader: Boolean(row.isLeader),
  }
}

watch(
  () => isActive.value,
  (val) => {
    if (!val) return
    if (props.record) {
      Object.assign(form, {
        code: props.record.code,
        name: props.record.name,
        workCenterId: props.record.workCenterId || undefined,
        allowTaskGen: props.record.allowTaskGen,
        leaderParticipates: props.record.leaderParticipates,
        multiExecutor: props.record.multiExecutor,
        status: props.record.status,
        remark: props.record.remark || '',
        workers: (props.record.workers || []).map(enrichWorker),
      })
      // 兼容旧数据：有 leaderId 但未标 isLeader
      if (props.record.leaderId && !form.workers.some((w) => w.isLeader)) {
        form.workers = form.workers.map((w) => ({
          ...w,
          isLeader: w.id === props.record.leaderId,
        }))
      }
    } else {
      Object.assign(form, {
        code: '',
        name: '',
        workCenterId: undefined,
        allowTaskGen: true,
        leaderParticipates: true,
        multiExecutor: true,
        status: '启用',
        remark: '',
        workers: [],
      })
    }
  },
  { immediate: true },
)

function genCode() {
  form.code = `WG${dayjs().format('YYYYMMDD')}${String(Math.floor(Math.random() * 900) + 100)}`
}

function openWorkerPicker() {
  workerPickerOpen.value = true
}

function onWorkersSelected(names) {
  const prevMap = new Map(form.workers.map((w) => [w.name, w]))
  form.workers = names.map((name) => {
    const emp = mockEmployees.find((e) => e.name === name)
    const prev = prevMap.get(name)
    return {
      id: emp?.id || prev?.id || `tmp-${name}`,
      name,
      position: emp?.position || prev?.position || '',
      isLeader: Boolean(prev?.isLeader),
    }
  })
  // 若原组长被移除且无人勾选，不自动指定
}

function onLeaderCheck(record, checked) {
  if (checked) {
    form.workers = form.workers.map((w) => ({
      ...w,
      isLeader: w.id === record.id,
    }))
    return
  }
  // 取消勾选：允许暂时无组长，保存时再校验
  record.isLeader = false
}

function removeWorker(id) {
  form.workers = form.workers.filter((w) => w.id !== id)
}

function resolveLeader() {
  const leader = form.workers.find((w) => w.isLeader)
  return {
    leaderId: leader?.id || '',
    leaderName: leader?.name || '',
  }
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  if (!form.workers.length) {
    message.warning('请至少选择一名工人')
    return
  }
  const leaderCount = form.workers.filter((w) => w.isLeader).length
  if (leaderCount !== 1) {
    message.warning('请在列表中勾选一名组长')
    return
  }
  const { leaderId, leaderName } = resolveLeader()
  const payload = {
    ...form,
    leaderId,
    leaderName,
    workers: form.workers.map((w) => ({
      id: w.id,
      name: w.name,
      position: w.position || '',
      isLeader: Boolean(w.isLeader),
    })),
  }
  if (isEdit.value) {
    updateEmployeeGroup(props.record.id, payload)
    message.success('保存成功')
  } else {
    addEmployeeGroup(payload)
    message.success('保存成功')
  }
  emit('saved')
  closeAfterSave()
}
</script>

<style lang="less" scoped>
.form-section-box {
  margin-bottom: 12px;
  width: 100%;
}

.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;

  .section-title {
    margin-bottom: 0;
  }
}

.section-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #86909c;
  line-height: 1.5;
}

.readonly-cell {
  color: #1f2329;
  font-size: 13px;
}

.group-form {
  width: 100%;

  :deep(.ant-form-item) {
    margin-inline-end: 0;
    margin-bottom: 0;
    width: 100%;
  }

  :deep(.ant-form-item-row) {
    flex-wrap: nowrap;
    align-items: center;
    width: 100%;
  }

  :deep(.ant-form-item-label) {
    flex: 0 0 88px;
    width: 88px;
    max-width: 88px;
    padding: 0;
  }

  :deep(.ant-form-item-label > label) {
    height: auto;
    min-height: 32px;
    line-height: 32px;
    font-size: 14px;
    white-space: nowrap;
  }

  :deep(.ant-form-item-control) {
    flex: 1 1 auto;
    min-width: 0;
    max-width: 100%;
  }

  :deep(.ant-select),
  :deep(.ant-input) {
    width: 100%;
  }

  .remark-item {
    :deep(.ant-form-item-row) {
      align-items: flex-start;
    }

    :deep(.ant-form-item-label > label) {
      height: 32px;
    }
  }
}
</style>
