<template>
  <div class="process-config-page">
    <div class="filter-card">
      <a-form :model="filters" layout="inline" class="filter-form horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="工序名称">
              <a-input
                v-model:value="filters.name"
                allow-clear
                size="small"
                placeholder="请输入 工序名称"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="工序分类">
              <a-select
                v-model:value="filters.category"
                allow-clear
                size="small"
                placeholder="请选择 工序分类"
                :options="categoryOpts"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="状态">
              <a-select
                v-model:value="filters.status"
                allow-clear
                size="small"
                placeholder="请选择 状态"
                :options="statusOpts"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="8">
            <a-form-item class="filter-actions-item">
              <a-space>
                <a-button type="primary" size="small" @click="handleSearch">
                  <SearchOutlined />
                  搜索
                </a-button>
                <a-button size="small" @click="handleReset">
                  <DeleteOutlined />
                  清空
                </a-button>
              </a-space>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <div class="toolbar-row">
      <a-space>
        <a-button type="primary" size="small" @click="openCreate">
          <PlusOutlined />
          新增
        </a-button>
        <a-button size="small" @click="importOpen = true">导入</a-button>
        <a-button size="small" @click="historyOpen = true">导入导出历史</a-button>
      </a-space>
      <a-space :size="4" class="toolbar-icons">
        <a-tooltip title="刷新">
          <a-button type="text" size="small" @click="handleSearch">
            <ReloadOutlined />
          </a-button>
        </a-tooltip>
        <TableColumnSettingButton @click="columnDrawerOpen = true" />
      </a-space>
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
          <template v-else-if="column.key === 'name'">
            {{ record.name || '—' }}
          </template>
          <template v-else-if="column.key === 'category'">
            {{ record.category || '—' }}
          </template>
          <template v-else-if="column.key === 'resourceType'">
            {{ record.resourceType || '岗位' }}
          </template>
          <template v-else-if="column.key === 'responsible'">
            <span v-if="formatProcessResponsible(record)">{{
              formatProcessResponsible(record)
            }}</span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.key === 'equipment'">
            <span v-if="formatProcessEquipment(record)" :title="formatProcessEquipment(record)">{{
              formatProcessEquipment(record)
            }}</span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.key === 'params'">
            <span v-if="formatProcessParams(record)" :title="formatProcessParams(record)">{{
              formatProcessParams(record)
            }}</span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.key === 'formTemplate'">
            <span v-if="formTemplateText(record)" :title="formTemplateText(record)">{{
              formTemplateText(record)
            }}</span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.key === 'assay'">
            <span v-if="assaySchemeText(record)" :title="assaySchemeText(record)">{{
              assaySchemeText(record)
            }}</span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.key === 'gate'">
            <a-tag :color="record.gateMode === 'hard' ? 'warning' : 'default'">{{
              formatProcessGate(record.gateMode)
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'transfer'">
            <span v-if="record.transferCondition" :title="record.transferCondition">{{
              record.transferCondition
            }}</span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.key === 'refCount'">
            {{ countRoutesReferencingProcess(record.id) }}
          </template>
          <template v-else-if="column.key === 'creator'">
            {{ record.creator || '—' }}
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ record.createdAt || '—' }}
          </template>
          <template v-else-if="column.key === 'updater'">
            {{ record.updater || '—' }}
          </template>
          <template v-else-if="column.key === 'updatedAt'">
            {{ record.updatedAt || '—' }}
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-space :size="8">
              <a @click="openEdit(record)">编辑</a>
              <a class="danger-link" @click="confirmDelete(record)">删除</a>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <TableColumnSettingDrawer
      v-model:open="columnDrawerOpen"
      v-model:settings="columnSettings"
      :default-settings="defaultColumnSettings"
    />

    <ImportExcelModal
      v-model:open="importOpen"
      :import-def="processRouteBundleImportDef"
      @done="handleSearch"
    />
    <ImportExportHistoryModal v-model:open="historyOpen" />
  </div>
</template>

<script>
export default { name: 'ProcessConfigView' }
</script>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { DeleteOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import TableColumnSettingDrawer from '@/components/TableColumnSettingDrawer.vue'
import TableColumnSettingButton from '@/components/TableColumnSettingButton.vue'
import { useTableColumnSettings } from '@/composables/useTableColumnSettings'
import { useTabs } from '@/composables/useTabs'
import { openCreateTab } from '@/utils/openCreateTab'
import { findCreatePageByListPath } from '@/config/createPages'
import {
  processConfigState,
  filterProcessConfig,
  deleteProcessConfig,
  PROCESS_STATUS,
  formatProcessResponsible,
  formatProcessEquipment,
  formatProcessGate,
  formatProcessParams,
} from '@/store/processConfigStore'
import { countRoutesReferencingProcess } from '@/store/processRouteStore'
import { getActiveCategoryOptions } from '@/store/processCategoryStore'
import { getProcessFormTemplateById } from '@/store/processFormTemplateStore'
import { assayTypeLabel, normalizeProcessQcConfigs } from '@/utils/qcProcessConfig'
import ImportExcelModal from '@/components/ImportExcelModal.vue'
import ImportExportHistoryModal from '@/components/ImportExportHistoryModal.vue'
import { processRouteBundleImportDef } from '@/utils/importDefs/processRouteBundleImport'

const router = useRouter()
const { openTab } = useTabs()
const processConfigCreatePage = findCreatePageByListPath('/product-process/process-config')
const importOpen = ref(false)
const historyOpen = ref(false)
const filters = reactive({
  name: '',
  category: undefined,
  status: undefined,
})
const applied = reactive({
  name: '',
  category: undefined,
  status: undefined,
})

const categoryOpts = computed(() => getActiveCategoryOptions())
const statusOpts = PROCESS_STATUS.map((v) => ({ label: v, value: v }))

const allBaseColumns = [
  { title: '序号', key: 'index', width: 56, align: 'center', fixed: 'left' },
  { title: '状态', key: 'status', width: 88, fixed: 'left' },
  { title: '工序编码', key: 'code', width: 130, fixed: 'left' },
  { title: '工序名称', key: 'name', dataIndex: 'name', width: 110 },
  { title: '工序分类', key: 'category', dataIndex: 'category', width: 100 },
  { title: '资源类型', key: 'resourceType', width: 90 },
  { title: '默认执行', key: 'responsible', width: 100 },
  { title: '关联设备', key: 'equipment', width: 180, ellipsis: true },
  { title: '工艺参数', key: 'params', width: 160, ellipsis: true },
  { title: '过程记录', key: 'formTemplate', width: 140, ellipsis: true },
  { title: '化验方案', key: 'assay', width: 160, ellipsis: true },
  { title: '门禁', key: 'gate', width: 150 },
  { title: '转移条件', key: 'transfer', width: 160, ellipsis: true },
  { title: '被引用数', key: 'refCount', width: 90, align: 'right' },
  { title: '创建人', key: 'creator', dataIndex: 'creator', width: 100 },
  { title: '创建时间', key: 'createdAt', dataIndex: 'createdAt', width: 150 },
  { title: '更新人', key: 'updater', dataIndex: 'updater', width: 100 },
  { title: '更新时间', key: 'updatedAt', dataIndex: 'updatedAt', width: 150 },
  { title: '操作', key: 'actions', width: 120, fixed: 'right' },
]

const { columnSettings, columnDrawerOpen, displayColumns, tableScrollX, defaultColumnSettings } =
  useTableColumnSettings('process-config-list-v11', allBaseColumns)

function formTemplateText(record) {
  const id = record?.formTemplateId
  if (!id) return ''
  const tpl = getProcessFormTemplateById(id)
  if (!tpl) return id
  return tpl.name || tpl.code || id
}

function assaySchemeText(record) {
  const list = normalizeProcessQcConfigs(record?.qcConfigs || [])
  if (!list.length) return ''
  return list
    .map((row) => row.name || assayTypeLabel(row.assayType, row.bizScope))
    .filter(Boolean)
    .join('、')
}

const filteredList = computed(() => filterProcessConfig(processConfigState.processes, applied))

function handleSearch() {
  applied.name = filters.name.trim()
  applied.category = filters.category
  applied.status = filters.status
}

function handleReset() {
  filters.name = ''
  filters.category = undefined
  filters.status = undefined
  handleSearch()
}

function openCreate() {
  openCreateTab(router, openTab, {
    path: processConfigCreatePage.newPath,
    title: processConfigCreatePage.title,
  })
}

function openEdit(record) {
  if (!record?.id) return
  openCreateTab(router, openTab, {
    path: `/product-process/process-config/${record.id}/edit`,
    title: `编辑工序 ${record.code || record.name || ''}`.trim(),
  })
}

function goDetail(record) {
  router.push(`/product-process/process-config/${record.id}`)
}

function confirmDelete(record) {
  Modal.confirm({
    title: '确认删除',
    content: `确定删除工序「${record.name}」吗？`,
    okType: 'danger',
    onOk: () => {
      const res = deleteProcessConfig(record.id)
      if (!res.ok) {
        message.warning(res.message)
        return
      }
      message.success('已删除')
    },
  })
}
</script>

<style lang="less" scoped>
.process-config-page {
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

  .link-code {
    color: #307068;
    cursor: pointer;
  }

  .danger-link {
    color: #ff4d4f;
  }

  .thumb {
    width: 36px;
    height: 36px;
    border-radius: 4px;
    object-fit: cover;
  }

  .thumb-placeholder {
    color: #bbb;
  }

  .executor-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .executor-tag {
    margin: 0;
  }

  .muted {
    color: #bbb;
  }
}
</style>
