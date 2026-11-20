<template>
  <div class="production-line-page">
    <div class="filter-card">
      <a-form layout="inline" class="filter-form horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="关键字">
              <a-input
                v-model:value="filters.keyword"
                allow-clear
                size="small"
                placeholder="编码 / 名称 / 车间"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="状态">
              <a-select
                v-model:value="filters.status"
                allow-clear
                size="small"
                placeholder="全部"
                :options="statusOpts"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item>
              <a-space>
                <a-button type="primary" size="small" @click="handleSearch">搜索</a-button>
                <a-button size="small" @click="handleReset">清空</a-button>
              </a-space>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <div class="toolbar-row">
      <a-button type="primary" size="small" @click="openCreate">
        <PlusOutlined />
        新增
      </a-button>
      <TableColumnSettingButton @click="columnDrawerOpen = true" />
    </div>

    <div class="table-card">
      <a-table
        :columns="displayColumns"
        :data-source="filteredList"
        row-key="id"
        size="small"
        bordered
        :scroll="{ x: tableScrollX }"
        :pagination="{
          pageSize: 10,
          size: 'small',
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
        }"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">{{ index + 1 }}</template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === '使用中' ? 'processing' : 'default'">{{
              record.status || '—'
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'code'">
            <a class="link-code" @click="goDetail(record)">{{ record.code || '—' }}</a>
          </template>
          <template v-else-if="column.key === 'stationCount'">
            {{ (record.stations || []).length || 0 }}
          </template>
          <template v-else-if="column.key === 'topology'">
            <span
              v-if="formatProductionLineTopology(record)"
              :title="formatProductionLineTopology(record)"
            >
              {{ formatProductionLineTopology(record) }}
            </span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.key === 'equipment'">
            <span
              v-if="formatProductionLineEquipment(record)"
              :title="formatProductionLineEquipment(record)"
            >
              {{ formatProductionLineEquipment(record) }}
            </span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.key === 'positions'">
            <span v-if="formatProductionLinePositions(record)">{{
              formatProductionLinePositions(record)
            }}</span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-space :size="8">
              <a @click="goDetail(record)">详情</a>
              <a @click="openEdit(record)">编辑</a>
              <a v-if="record.status === '使用中'" @click="setStatus(record, '停用')">停用</a>
              <a v-else @click="setStatus(record, '使用中')">启用</a>
            </a-space>
          </template>
          <template v-else>
            {{ record[column.dataIndex] || '—' }}
          </template>
        </template>
      </a-table>
    </div>

    <TableColumnSettingDrawer
      v-model:open="columnDrawerOpen"
      v-model:settings="columnSettings"
      :default-settings="defaultColumnSettings"
    />
  </div>
</template>

<script>
export default { name: 'ProductionLineView' }
</script>

<script setup>
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import TableColumnSettingButton from '@/components/TableColumnSettingButton.vue'
import TableColumnSettingDrawer from '@/components/TableColumnSettingDrawer.vue'
import { useTableColumnSettings } from '@/composables/useTableColumnSettings'
import { useTabs } from '@/composables/useTabs'
import { findCreatePageByListPath } from '@/config/createPages'
import { openCreateTab } from '@/utils/openCreateTab'
import {
  PRODUCTION_LINE_STATUS,
  formatProductionLineEquipment,
  formatProductionLinePositions,
  formatProductionLineTopology,
  listProductionLines,
  productionLineState,
  setProductionLineStatus,
} from '@/store/productionLineStore'

const router = useRouter()
const { openTab } = useTabs()
const createPage = findCreatePageByListPath('/product-process/production-line')

const filters = reactive({ keyword: '', status: undefined })
const applied = reactive({ keyword: '', status: undefined })

const statusOpts = PRODUCTION_LINE_STATUS.map((v) => ({ label: v, value: v }))

const allBaseColumns = [
  { title: '序号', key: 'index', width: 56, align: 'center' },
  { title: '状态', key: 'status', width: 88 },
  { title: '产线编码', key: 'code', dataIndex: 'code', width: 120 },
  { title: '产线名称', dataIndex: 'name', width: 140 },
  { title: '所属车间', dataIndex: 'workshop', width: 120 },
  { title: '工段数', key: 'stationCount', width: 72, align: 'right' },
  { title: '拓扑', key: 'topology', width: 280, ellipsis: true },
  { title: '关联设备', key: 'equipment', width: 200, ellipsis: true },
  { title: '关联岗位', key: 'positions', width: 160, ellipsis: true },
  { title: '备注', dataIndex: 'remark', width: 140, ellipsis: true },
  { title: '更新时间', dataIndex: 'updatedAt', width: 140 },
  { title: '操作', key: 'actions', width: 150, fixed: 'right' },
]

const { columnSettings, columnDrawerOpen, displayColumns, tableScrollX, defaultColumnSettings } =
  useTableColumnSettings('production-line-list-v3', allBaseColumns)

const filteredList = computed(() => {
  void productionLineState.lines
  return listProductionLines(applied)
})

function handleSearch() {
  applied.keyword = filters.keyword.trim()
  applied.status = filters.status
}

function handleReset() {
  filters.keyword = ''
  filters.status = undefined
  handleSearch()
}

function openCreate() {
  if (!createPage) {
    message.warning('未配置新增页')
    return
  }
  openCreateTab(router, openTab, {
    path: createPage.newPath,
    title: createPage.title,
  })
}

function goDetail(record) {
  if (!record?.id) return
  const path = `/product-process/production-line/${record.id}`
  openTab(path, record.name || record.code || '产线详情')
  router.push(path)
}

function openEdit(record) {
  if (!createPage || !record?.id) return
  openCreateTab(router, openTab, {
    path: createPage.newPath,
    title: `编辑产线 ${record.code || record.name || ''}`.trim(),
    query: { id: record.id },
  })
}

function setStatus(record, status) {
  const res = setProductionLineStatus(record.id, status)
  if (!res.ok) {
    message.warning(res.message)
    return
  }
  message.success(status === '使用中' ? '已启用' : '已停用')
}
</script>

<style scoped lang="less">
.production-line-page {
  .filter-card,
  .table-card {
    background: #fff;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 8px;
  }

  .toolbar-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .muted {
    color: #bbb;
  }

  .link-code {
    color: #1677ff;
    cursor: pointer;
  }
}
</style>
