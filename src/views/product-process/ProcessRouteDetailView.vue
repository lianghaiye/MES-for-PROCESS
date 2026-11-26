<template>
  <div class="process-route-detail-page">
    <a-spin :spinning="loading">
      <template v-if="record">
        <div class="page-header">
          <div class="header-left">
            <span class="page-title">{{ record.name }}</span>
            <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
            <span class="sub-code">{{ record.code }}</span>
          </div>
          <a-space class="header-actions" :size="8">
            <a-button size="small" :disabled="record.status === '已归档'" @click="openEdit">
              编辑
            </a-button>
            <a-button
              v-if="record.status === '使用中' || record.status === '新建'"
              size="small"
              @click="handleArchive"
            >
              归档
            </a-button>
            <a-button v-if="record.status === '已归档'" size="small" @click="handleUnarchive">
              取消归档
            </a-button>
            <a-button size="small" @click="handleClone">克隆</a-button>
            <a-button size="small" @click="goBack">返回列表</a-button>
          </a-space>
        </div>

        <DetailSectionCard title="基本信息">
          <DetailInfoGrid :meta-items="basicMeta" :fields="basicFields" flush />
        </DetailSectionCard>

        <DetailSectionCard v-if="isEquipmentMode" title="设备顺序">
          <a-table
            :columns="unitCols"
            :data-source="unitRows"
            row-key="key"
            size="small"
            bordered
            :pagination="false"
            :locale="{ emptyText: '还没有设备' }"
          />
        </DetailSectionCard>

        <DetailSectionCard v-else title="路线拓扑">
          <p class="topo-summary">{{ topologySummary }}</p>
          <a-tabs v-model:active-key="topoTab" class="detail-tabs detail-tabs-pill">
            <a-tab-pane key="grid" tab="网格（含连线）">
              <ProcessRouteTopologyGridEditor :nodes="record.nodes || []" readonly />
            </a-tab-pane>
            <a-tab-pane key="preview" tab="拓扑预览">
              <ProcessRouteTopologyPreview :nodes="record.nodes || []" />
            </a-tab-pane>
            <a-tab-pane key="list" tab="节点列表">
              <a-table
                class="node-table"
                :columns="nodeCols"
                :data-source="nodeRows"
                row-key="id"
                size="small"
                bordered
                :pagination="false"
                :locale="{ emptyText: '还没有节点' }"
              />
            </a-tab-pane>
          </a-tabs>
        </DetailSectionCard>
      </template>
      <a-empty v-else-if="!loading" description="未找到该工艺路线" />
    </a-spin>
  </div>
</template>

<script>
export default { name: 'ProcessRouteDetailView' }
</script>

<script setup>
import DetailSectionCard from '@/components/DetailSectionCard.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { useTabs } from '@/composables/useTabs'
import { openCreateTab } from '@/utils/openCreateTab'
import {
  getProcessRouteById,
  archiveProcessRoute,
  unarchiveProcessRoute,
  cloneProcessRoute,
} from '@/store/processRouteStore'
import { formatApplyScopeLabel } from '@/utils/processRouteGrid'
import { formatTopologySummary, normalizeRouteNodes } from '@/utils/processRouteTopology'
import { deviceLabelById } from '@/store/equipmentStore'
import { ROUTE_MODE_EQUIPMENT } from '@/constants/processRouteMode'
import { resolveRouteEditMode } from '@/store/processMesSettingsStore'
import DetailInfoGrid from './components/DetailInfoGrid.vue'
import ProcessRouteTopologyPreview from './components/ProcessRouteTopologyPreview.vue'
import ProcessRouteTopologyGridEditor from './components/ProcessRouteTopologyGridEditor.vue'

const route = useRoute()
const router = useRouter()
const { openTab } = useTabs()
const loading = ref(false)
const record = ref(null)
const topoTab = ref('grid')

function display(val) {
  return val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '—'
}

const basicMeta = computed(() => {
  const r = record.value || {}
  return [
    { key: 'status', label: '状态', value: display(r.status) },
    { key: 'creator', label: '创建人', value: display(r.creator) },
    { key: 'createdAt', label: '创建日期', value: display(r.createdAt) },
    { key: 'updater', label: '更新人', value: display(r.updater) },
    { key: 'updatedAt', label: '更新日期', value: display(r.updatedAt) },
  ]
})

const basicFields = computed(() => {
  const r = record.value || {}
  return [
    { key: 'code', label: '路线编码', value: display(r.code) },
    { key: 'name', label: '路线名称', value: display(r.name) },
    { key: 'applyScope', label: '适用范围', value: formatApplyScopeLabel(r.applyScope) },
    {
      key: 'productDisplay',
      label: '适用对象',
      value: display(r.productDisplay || r.itemName || r.categoryName),
    },
    { key: 'remark', label: '备注', value: display(r.remark), fullRow: true },
  ]
})

const isEquipmentMode = computed(() => resolveRouteEditMode(record.value) === ROUTE_MODE_EQUIPMENT)
const topologySummary = computed(() => formatTopologySummary(record.value?.nodes || []))

const nodeCols = [
  { title: '路径', dataIndex: 'pathText', width: 80 },
  { title: '支线', dataIndex: 'branchName', width: 100 },
  { title: '节点', dataIndex: 'name', width: 120 },
  { title: '分出节点', dataIndex: 'forkText', width: 120 },
  { title: '汇入节点', dataIndex: 'joinText', width: 120 },
  { title: '设备', dataIndex: 'equipmentText' },
]

const nodeRows = computed(() => {
  const list = normalizeRouteNodes(record.value?.nodes || [])
  const byId = new Map(list.map((n) => [n.id, n]))
  return list.map((n) => ({
    ...n,
    pathText: n.pathKind === 'main' ? '主线' : n.pathKind === 'sink' ? '汇合点' : '支线',
    branchName: n.branchName || '—',
    forkText: n.forkAfterNodeId ? byId.get(n.forkAfterNodeId)?.name || n.forkAfterNodeId : '—',
    joinText: n.joinToNodeId ? byId.get(n.joinToNodeId)?.name || n.joinToNodeId : '—',
    equipmentText: (n.equipmentIds || []).map((id) => deviceLabelById(id) || id).join('、') || '—',
  }))
})

const unitCols = [
  { title: '顺序', dataIndex: 'seq', width: 70, align: 'center' },
  { title: '设备', dataIndex: 'equipmentText' },
]

const unitRows = computed(() =>
  (record.value?.units || []).map((unit, index) => ({
    key: `${unit.equipmentId || 'unit'}-${index}`,
    seq: index + 1,
    equipmentText: deviceLabelById(unit.equipmentId) || '—',
  })),
)

function statusColor(status) {
  if (status === '使用中') return 'processing'
  if (status === '已归档') return 'warning'
  return 'default'
}

function reloadRecord() {
  record.value = getProcessRouteById(route.params.id)
}

function openEdit() {
  if (!record.value?.id) return
  if (record.value.status === '已归档') {
    message.warning('已归档的工艺路线不可编辑，请先取消归档')
    return
  }
  openCreateTab(router, openTab, {
    path: `/product-process/routing/${record.value.id}/edit`,
    title: `编辑工艺路线 ${record.value.code || record.value.name || ''}`.trim(),
    query: {
      returnTo: route.fullPath,
      returnTitle: record.value.name || record.value.code || '路线详情',
    },
  })
}

function handleArchive() {
  if (!record.value) return
  Modal.confirm({
    title: '确认归档',
    content: `确定归档工艺路线「${record.value.name}」吗？归档后不可用于新工单下发。`,
    onOk: () => {
      const res = archiveProcessRoute(record.value.id)
      if (!res.ok) {
        message.warning(res.message)
        return
      }
      message.success('已归档')
      reloadRecord()
    },
  })
}

function handleUnarchive() {
  if (!record.value) return
  const res = unarchiveProcessRoute(record.value.id)
  if (!res.ok) message.warning(res.message)
  else {
    message.success('已取消归档')
    reloadRecord()
  }
}

function handleClone() {
  if (!record.value) return
  const res = cloneProcessRoute(record.value.id)
  if (!res.ok) {
    message.warning(res.message)
    return
  }
  message.success(`已克隆为 ${res.route.code}`)
  router.push(`/product-process/routing/${res.route.id}`)
}

function goBack() {
  router.push('/product-process/routing')
}

watch(
  () => route.params.id,
  (id) => {
    loading.value = true
    record.value = getProcessRouteById(id)
    loading.value = false
  },
  { immediate: true },
)
</script>

<style scoped lang="less">
.topo-summary {
  margin: 0 0 8px;
  font-size: 13px;
  color: #4e5969;
  line-height: 22px;
}

.node-table {
  margin-top: 12px;
}

.process-route-detail-page {
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
  font-size: 18px;
  font-weight: 600;
}

.sub-code {
  color: #888;
  font-size: 13px;
}
</style>
