<template>
  <div class="production-line-detail-page">
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
            <a-button v-if="record.status === '使用中'" size="small" @click="setStatus('停用')">
              停用
            </a-button>
            <a-button v-else size="small" @click="setStatus('使用中')">启用</a-button>
            <a-button size="small" @click="goBack">返回列表</a-button>
          </a-space>
        </div>

        <DetailSectionCard title="基本信息">
          <DetailInfoGrid :meta-items="basicMeta" :fields="basicFields" flush />
        </DetailSectionCard>

        <DetailSectionCard title="工段">
          <a-table
            :columns="stationColumns"
            :data-source="stationRows"
            :pagination="false"
            size="small"
            bordered
            row-key="id"
            :locale="{ emptyText: '还没有工段' }"
            :scroll="{ x: 1260 }"
          />
        </DetailSectionCard>

        <DetailSectionCard title="产线拓扑">
          <ProductionLineTopologyPreview :stations="record.stations || []" />
        </DetailSectionCard>
      </template>
      <a-empty v-else-if="!loading" description="未找到该产线" />
    </a-spin>
  </div>
</template>

<script>
export default { name: 'ProductionLineDetailView' }
</script>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import DetailSectionCard from '@/components/DetailSectionCard.vue'
import DetailInfoGrid from '@/views/product-process/components/DetailInfoGrid.vue'
import ProductionLineTopologyPreview from '@/views/product-process/components/ProductionLineTopologyPreview.vue'
import { useTabs } from '@/composables/useTabs'
import { findCreatePageByListPath } from '@/config/createPages'
import { openCreateTab } from '@/utils/openCreateTab'
import {
  PRODUCTION_LINE_PATH_BRANCH,
  PRODUCTION_LINE_PATH_OPTIONS,
  formatDeviceLabel,
  formatProductionLineTopology,
  getProductionLineById,
  productionLineState,
  setProductionLineStatus,
} from '@/store/productionLineStore'
import { getDeviceById } from '@/store/equipmentStore'

const route = useRoute()
const router = useRouter()
const { openTab } = useTabs()
const createPage = findCreatePageByListPath('/product-process/production-line')
const loading = ref(false)
const record = ref(null)

function display(val) {
  return val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '—'
}

function statusColor(status) {
  if (status === '使用中') return 'success'
  if (status === '停用') return 'default'
  return 'processing'
}

function pathKindLabel(value) {
  return PRODUCTION_LINE_PATH_OPTIONS.find((item) => item.value === value)?.label || '主线'
}

const basicMeta = computed(() => {
  const r = record.value || {}
  return [
    { key: 'status', label: '状态', value: display(r.status) },
    { key: 'creator', label: '创建人', value: display(r.creator) },
    { key: 'createdAt', label: '创建时间', value: display(r.createdAt) },
    { key: 'updater', label: '更新人', value: display(r.updater) },
    { key: 'updatedAt', label: '更新时间', value: display(r.updatedAt) },
  ]
})

const basicFields = computed(() => {
  const r = record.value || {}
  return [
    { key: 'code', label: '产线编码', value: display(r.code) },
    { key: 'name', label: '产线名称', value: display(r.name) },
    { key: 'workshop', label: '所属车间', value: display(r.workshop) },
    {
      key: 'stationCount',
      label: '工段数',
      value: String((r.stations || []).length || 0),
    },
    {
      key: 'topology',
      label: '拓扑摘要',
      value: formatProductionLineTopology(r) || '—',
      fullRow: true,
    },
    { key: 'remark', label: '备注', value: display(r.remark), fullRow: true },
  ]
})

const stationColumns = [
  { title: '序号', dataIndex: 'seqText', width: 64, align: 'center' },
  { title: '工段名称', dataIndex: 'name', width: 120 },
  { title: '路径', dataIndex: 'pathKindText', width: 80 },
  { title: '支线名称', dataIndex: 'branchName', width: 120 },
  { title: '分出后', dataIndex: 'forkText', width: 90 },
  { title: '汇入前', dataIndex: 'joinText', width: 90 },
  { title: '设备', dataIndex: 'equipmentText', width: 240, ellipsis: true },
  { title: '设备型号', dataIndex: 'equipmentModelText', width: 160, ellipsis: true },
  { title: '岗位', dataIndex: 'positionText', width: 160, ellipsis: true },
]

const stationRows = computed(() =>
  [...(record.value?.stations || [])]
    .sort((a, b) => Number(a.seq) - Number(b.seq))
    .map((st) => {
      const isBranch = st.pathKind === PRODUCTION_LINE_PATH_BRANCH
      const equipmentIds = st.equipmentIds || []
      return {
        id: st.id,
        seqText: isBranch ? '支' : String(st.seq || '—'),
        name: display(st.name),
        pathKindText: pathKindLabel(st.pathKind),
        branchName: isBranch ? display(st.branchName) : '—',
        forkText: isBranch && st.forkAfterSeq ? `#${st.forkAfterSeq}` : '—',
        joinText: isBranch && st.joinBeforeSeq ? `#${st.joinBeforeSeq}` : isBranch ? '末' : '—',
        equipmentText:
          equipmentIds
            .map((id) => formatDeviceLabel(id) || id)
            .filter(Boolean)
            .join('、') || '—',
        equipmentModelText:
          equipmentIds
            .map((id) => getDeviceById(id)?.model)
            .filter((model) => model && String(model).trim())
            .join('、') || '—',
        positionText: (st.positionNames || []).filter(Boolean).join('、') || '—',
      }
    }),
)

function reload() {
  void productionLineState.lines
  record.value = getProductionLineById(route.params.id)
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

watch(
  () => productionLineState.lines,
  () => reload(),
  { deep: true },
)

function goBack() {
  router.push('/product-process/production-line')
}

function openEdit() {
  if (!createPage || !record.value?.id) return
  openCreateTab(router, openTab, {
    path: createPage.newPath,
    title: `编辑产线 ${record.value.code || record.value.name || ''}`.trim(),
    query: {
      id: record.value.id,
      returnTo: route.fullPath,
      returnTitle: record.value.name || record.value.code || '产线详情',
    },
  })
}

function setStatus(status) {
  if (!record.value?.id) return
  const res = setProductionLineStatus(record.value.id, status)
  if (!res.ok) {
    message.warning(res.message)
    return
  }
  message.success(status === '使用中' ? '已启用' : '已停用')
  reload()
}
</script>

<style lang="less" scoped>
.production-line-detail-page {
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
</style>
