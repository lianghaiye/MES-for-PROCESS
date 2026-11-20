<template>
  <div class="process-config-detail-page">
    <a-spin :spinning="loading">
      <template v-if="record">
        <div class="page-header">
          <div class="header-left">
            <span class="page-title">{{ record.name }}</span>
            <a-tag :color="statusColor(record.status)">{{ record.status || '—' }}</a-tag>
            <span class="sub-code">{{ record.code }}</span>
          </div>
          <a-space class="header-actions" :size="8">
            <a-button type="primary" size="small" @click="openEdit">编辑</a-button>
            <a-button size="small" @click="goBack">返回列表</a-button>
          </a-space>
        </div>

        <DetailSectionCard title="基本信息">
          <DetailInfoGrid :meta-items="basicMeta" :fields="basicFields" flush />
        </DetailSectionCard>

        <DetailSectionCard title="关联设备">
          <a-table
            :columns="equipmentColumns"
            :data-source="equipmentRows"
            :pagination="false"
            size="small"
            bordered
            row-key="id"
            :locale="{ emptyText: '还没有关联设备' }"
            :scroll="{ x: 860 }"
          >
            <template #bodyCell="{ column, record: row }">
              <template v-if="column.key === 'status'">
                <a-tag v-if="row.status !== '—'" :color="equipmentStatusColor(row.status)">
                  {{ row.status }}
                </a-tag>
                <span v-else>—</span>
              </template>
            </template>
          </a-table>
        </DetailSectionCard>

        <DetailSectionCard title="工艺参数">
          <a-table
            :columns="paramColumns"
            :data-source="paramRows"
            :pagination="false"
            size="small"
            bordered
            row-key="key"
            :locale="{ emptyText: '还没有参数' }"
          />
        </DetailSectionCard>

        <DetailSectionCard title="化验方案">
          <a-table
            :columns="assayColumns"
            :data-source="assayRows"
            :pagination="false"
            size="small"
            bordered
            row-key="id"
            :locale="{ emptyText: '未配置，执行时不显示化验入口' }"
          >
            <template #bodyCell="{ column, record: row }">
              <template v-if="column.key === 'gateMode'">
                <a-tag :color="row.gateMode === 'hard' || row.hardGate ? 'warning' : 'processing'">
                  {{ row.gateMode === 'hard' || row.hardGate ? '硬门禁' : '记录' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'allowMultiple'">
                {{ row.allowMultiple ? '是' : '否' }}
              </template>
            </template>
          </a-table>
        </DetailSectionCard>

        <DetailSectionCard title="过程记录">
          <p class="section-hint">
            开启后，批次执行本工序时需填写过程记录（进批记录）。未开启则只确认参数/投料。
          </p>
          <DetailInfoGrid :fields="formTemplateFields" flush />
        </DetailSectionCard>
      </template>
      <a-empty v-else-if="!loading" description="未找到该工序" />
    </a-spin>
  </div>
</template>

<script>
export default { name: 'ProcessConfigDetailView' }
</script>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DetailSectionCard from '@/components/DetailSectionCard.vue'
import DetailInfoGrid from '@/views/product-process/components/DetailInfoGrid.vue'
import {
  getProcessById,
  formatProcessResponsible,
  formatProcessGate,
} from '@/store/processConfigStore'
import { getProcessFormTemplateById } from '@/store/processFormTemplateStore'
import { countRoutesReferencingProcess } from '@/store/processRouteStore'
import { getDeviceById, formatDeviceLabel } from '@/store/equipmentStore'
import { EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
import { useTabs } from '@/composables/useTabs'
import { openCreateTab } from '@/utils/openCreateTab'
import { qcBizScopeLabel } from '@/constants/qcBizScopeLabel'
import { assayTypeLabel } from '@/utils/qcProcessConfig'

const route = useRoute()
const router = useRouter()
const { openTab } = useTabs()
const loading = ref(false)
const record = ref(null)

function display(val) {
  return val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '—'
}

function statusColor(status) {
  if (status === '使用中') return 'success'
  if (status === '停用' || status === '已归档') return 'default'
  return 'processing'
}

function equipmentStatusColor(status) {
  if (status === EQUIPMENT_STATUS.IN_USE) return 'success'
  if (status === EQUIPMENT_STATUS.REPAIRING) return 'error'
  if (status === EQUIPMENT_STATUS.IDLE) return 'warning'
  return 'default'
}

const formTemplateEnabled = computed(() => Boolean(record.value?.formTemplateId))

const formTemplateText = computed(() => {
  const id = record.value?.formTemplateId
  if (!id) return '—'
  const tpl = getProcessFormTemplateById(id)
  if (!tpl) return id
  return tpl.code ? `${tpl.name}（${tpl.code}）` : tpl.name || id
})

const formTemplateFields = computed(() => [
  {
    key: 'enabled',
    label: '关联过程记录',
    value: formTemplateEnabled.value ? '是' : '否',
  },
  {
    key: 'template',
    label: '记录模板',
    value: formTemplateEnabled.value ? formTemplateText.value : '—',
  },
])

const refCount = computed(() => countRoutesReferencingProcess(record.value?.id))

const basicMeta = computed(() => {
  const r = record.value || {}
  return [
    { key: 'status', label: '状态', value: display(r.status) },
    { key: 'creator', label: '创建人', value: display(r.creator) },
    { key: 'createdAt', label: '创建时间', value: display(r.createdAt) },
    { key: 'updater', label: '更新人', value: display(r.updater) },
    { key: 'updatedAt', label: '更新时间', value: display(r.updatedAt) },
    { key: 'refCount', label: '被引用数', value: String(refCount.value ?? 0) },
  ]
})

const basicFields = computed(() => {
  const r = record.value || {}
  return [
    { key: 'code', label: '工序编码', value: display(r.code) },
    { key: 'name', label: '工序名称', value: display(r.name) },
    { key: 'category', label: '工序分类', value: display(r.category) },
    { key: 'resourceType', label: '资源类型', value: display(r.resourceType || '岗位') },
    { key: 'defaultExecutors', label: '默认执行', value: formatProcessResponsible(r) || '—' },
    { key: 'gateMode', label: '门禁', value: formatProcessGate(r.gateMode) || '—' },
    {
      key: 'transferCondition',
      label: '转移条件',
      value: display(r.transferCondition),
      fullRow: true,
    },
    {
      key: 'instruction',
      label: '操作说明',
      value: display(r.instruction),
      fullRow: true,
    },
  ]
})

const equipmentColumns = [
  { title: '序号', dataIndex: 'seq', width: 64, align: 'center' },
  { title: '设备分类', dataIndex: 'category', width: 120 },
  { title: '允许设备', dataIndex: 'equipmentText', width: 220, ellipsis: true },
  { title: '型号', dataIndex: 'model', width: 120, ellipsis: true },
  { title: '位置', dataIndex: 'location', width: 140, ellipsis: true },
  { title: '状态', key: 'status', width: 90 },
]

const equipmentRows = computed(() =>
  (record.value?.equipmentIds || []).map((id, index) => {
    const device = getDeviceById(id)
    return {
      id: id || `eq-${index}`,
      seq: index + 1,
      category: display(device?.category),
      equipmentText: device ? formatDeviceLabel(device) || device.name : id || '—',
      model: display(device?.model),
      location: display(device?.location),
      status: display(device?.status),
    }
  }),
)

const paramColumns = [
  { title: '参数', dataIndex: 'name', width: 140 },
  { title: '单位', dataIndex: 'unit', width: 100 },
  { title: '设定值', dataIndex: 'target', width: 100, align: 'right' },
  { title: '下限', dataIndex: 'min', width: 100, align: 'right' },
  { title: '上限', dataIndex: 'max', width: 100, align: 'right' },
]

const paramRows = computed(() =>
  (record.value?.params || []).map((param, index) => ({
    key: `${param.name}-${index}`,
    name: display(param.name),
    unit: display(param.unit),
    target: param.target ?? '—',
    min: param.min ?? '—',
    max: param.max ?? '—',
  })),
)

const assayColumns = [
  { title: '业务类型', dataIndex: 'bizScopeLabel', width: 120 },
  { title: '化验类型', dataIndex: 'assayTypeLabel', width: 140 },
  { title: '门禁', key: 'gateMode', width: 120 },
  { title: '可多次', key: 'allowMultiple', width: 80, align: 'center' },
]

const assayRows = computed(() =>
  (record.value?.qcConfigs || []).map((row) => ({
    ...row,
    bizScopeLabel: qcBizScopeLabel(row.bizScope),
    assayTypeLabel: assayTypeLabel(row.assayType, row.bizScope) || row.name || '—',
  })),
)

function reload() {
  const id = route.params.id
  record.value = getProcessById(id)
}

watch(
  () => route.params.id,
  () => {
    loading.value = true
    reload()
    loading.value = false
  },
  { immediate: true },
)

function goBack() {
  router.push('/product-process/process-config')
}

function openEdit() {
  if (!record.value?.id) return
  openCreateTab(router, openTab, {
    path: `/product-process/process-config/${record.value.id}/edit`,
    title: `编辑工序 ${record.value.code || record.value.name || ''}`.trim(),
    query: {
      returnTo: route.fullPath,
      returnTitle: record.value.name || record.value.code || '工序详情',
    },
  })
}
</script>

<style lang="less" scoped>
.process-config-detail-page {
  margin: -12px;
  padding: 12px;
  background: var(--page-bg, #f0f2f5);
  min-height: calc(100% + 24px);

  :deep(.detail-section-card) {
    margin-bottom: 8px;
  }

  :deep(.detail-section-card:last-child) {
    margin-bottom: 0;
  }
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  padding: 10px 16px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-actions {
  flex-shrink: 0;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2329;
  line-height: 28px;
}

.sub-code {
  color: #86909c;
  font-size: 13px;
}

.section-hint {
  margin: 0 0 8px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
}
</style>
