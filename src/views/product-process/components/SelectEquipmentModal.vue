<template>
  <a-modal
    :open="open"
    title="选择设备"
    :width="1080"
    :mask-closable="false"
    destroy-on-close
    class="select-equipment-modal"
    @cancel="handleCancel"
  >
    <a-form layout="inline" class="search-form horizontal-form">
      <a-row :gutter="[12, 8]" style="width: 100%">
        <a-col :span="8">
          <a-form-item label="关键字">
            <a-input
              v-model:value="keyword"
              allow-clear
              size="small"
              placeholder="名称 / 编码"
              @press-enter="handleSearch"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="分类">
            <a-select
              v-model:value="category"
              allow-clear
              size="small"
              placeholder="全部"
              :options="categoryOpts"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item>
            <a-space>
              <a-button type="primary" size="small" @click="handleSearch">搜索</a-button>
              <a-button size="small" @click="handleReset">清空</a-button>
            </a-space>
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>

    <div class="picker-body">
      <div class="table-panel">
        <a-table
          :row-selection="rowSelection"
          :columns="columns"
          :data-source="pagedList"
          :custom-row="customRow"
          row-key="id"
          size="small"
          bordered
          :pagination="false"
          :scroll="{ x: 860, y: 320 }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'index'">
              {{ (pagination.current - 1) * pagination.pageSize + index + 1 }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag v-if="record.status" :color="statusColor(record.status)">
                {{ record.status }}
              </a-tag>
              <span v-else>—</span>
            </template>
            <template v-else>
              {{ record[column.dataIndex] || '—' }}
            </template>
          </template>
        </a-table>
        <div class="table-pagination">
          <a-pagination
            v-model:current="pagination.current"
            v-model:page-size="pagination.pageSize"
            :total="filteredList.length"
            size="small"
            show-size-changer
            :page-size-options="['10', '20', '50']"
            :show-total="(t) => `共 ${t} 条`"
          />
        </div>
      </div>

      <div class="selected-panel">
        <div class="selected-head">
          <span class="selected-title">已选 {{ selectedRows.length }} 项</span>
          <a-button
            v-if="selectedRows.length"
            type="link"
            size="small"
            class="clear-btn"
            @click="clearSelection"
          >
            清空
          </a-button>
        </div>
        <div v-if="selectedRows.length" class="selected-list">
          <div v-for="item in selectedRows" :key="item.id" class="selected-item">
            <span class="selected-name" :title="item.label">{{ item.label }}</span>
            <a-button type="text" size="small" class="remove-btn" @click="removeSelected(item.id)">
              <CloseOutlined />
            </a-button>
          </div>
        </div>
        <a-empty v-else :image="false" description="请从左侧选择" class="selected-empty" />
      </div>
    </div>

    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" @click="handleConfirm">确定 ({{ selectedRows.length }})</a-button>
    </template>
  </a-modal>
</template>

<script>
export default { name: 'SelectEquipmentModal' }
</script>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { equipmentState, formatDeviceLabel, listDevices } from '@/store/equipmentStore'
import { EQUIPMENT_CATEGORY_OPTIONS, EQUIPMENT_STATUS } from '@/mock/equipmentSeed'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** 已选设备 id */
  selected: { type: Array, default: () => [] },
  /** 限定可选 id；空=全部未报废 */
  allowIds: { type: Array, default: null },
  /** 限定分类 */
  categoryFilter: { type: String, default: '' },
  multiple: { type: Boolean, default: true },
})

const emit = defineEmits(['update:open', 'confirm'])

const keyword = ref('')
const appliedKeyword = ref('')
const category = ref(undefined)
const selectedRowKeys = ref([])
const selectedRows = ref([])
const pagination = reactive({ current: 1, pageSize: 10 })

const categoryOpts = EQUIPMENT_CATEGORY_OPTIONS

const allDevices = computed(() => {
  void equipmentState.devices
  let list = listDevices().filter((d) => d.status !== EQUIPMENT_STATUS.SCRAPPED)
  // null = 不限制；[] = 无可选项（与「有数组但为空」区分）
  const allow = Array.isArray(props.allowIds) ? props.allowIds.filter(Boolean) : null
  if (allow) {
    const set = new Set(allow)
    list = list.filter((d) => set.has(d.id))
  }
  return list.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    category: d.category,
    model: d.model,
    location: d.location,
    status: d.status,
    label: formatDeviceLabel(d) || d.name,
  }))
})

const columns = [
  { title: '序号', key: 'index', width: 56, align: 'center' },
  { title: '设备名称', dataIndex: 'name', width: 140, ellipsis: true },
  { title: '编码', dataIndex: 'code', width: 110 },
  { title: '分类', dataIndex: 'category', width: 100 },
  { title: '型号', dataIndex: 'model', width: 120, ellipsis: true },
  { title: '位置', dataIndex: 'location', width: 140, ellipsis: true },
  { title: '状态', key: 'status', dataIndex: 'status', width: 90 },
]

function statusColor(status) {
  if (status === EQUIPMENT_STATUS.IN_USE) return 'success'
  if (status === EQUIPMENT_STATUS.REPAIRING) return 'error'
  if (status === EQUIPMENT_STATUS.IDLE) return 'warning'
  return 'default'
}

const filteredList = computed(() => {
  const kw = String(appliedKeyword.value || '')
    .trim()
    .toLowerCase()
  const cat = category.value || props.categoryFilter || ''
  return allDevices.value.filter((row) => {
    if (cat && row.category !== cat) return false
    if (!kw) return true
    return (
      String(row.name || '')
        .toLowerCase()
        .includes(kw) ||
      String(row.code || '')
        .toLowerCase()
        .includes(kw) ||
      String(row.category || '')
        .toLowerCase()
        .includes(kw)
    )
  })
})

const pagedList = computed(() => {
  const start = (pagination.current - 1) * pagination.pageSize
  return filteredList.value.slice(start, start + pagination.pageSize)
})

function applySingle(record) {
  if (!record) {
    selectedRowKeys.value = []
    selectedRows.value = []
    return
  }
  selectedRowKeys.value = [record.id]
  selectedRows.value = [record]
}

const rowSelection = computed(() => ({
  type: props.multiple ? 'checkbox' : 'radio',
  selectedRowKeys: selectedRowKeys.value,
  preserveSelectedRowKeys: true,
  onChange: (keys, rows) => {
    if (!props.multiple) {
      const key = keys[keys.length - 1]
      const row = rows.find((r) => r.id === key) || allDevices.value.find((r) => r.id === key)
      applySingle(row)
      return
    }
    selectedRowKeys.value = keys
    const map = new Map(selectedRows.value.map((r) => [r.id, r]))
    rows.forEach((r) => map.set(r.id, r))
    selectedRows.value = keys
      .map((key) => map.get(key) || allDevices.value.find((r) => r.id === key))
      .filter(Boolean)
  },
}))

function toggleRow(record) {
  const key = record.id
  if (!props.multiple) {
    applySingle(selectedRowKeys.value[0] === key ? null : record)
    return
  }
  const idx = selectedRowKeys.value.indexOf(key)
  if (idx >= 0) {
    selectedRowKeys.value = selectedRowKeys.value.filter((k) => k !== key)
    selectedRows.value = selectedRows.value.filter((r) => r.id !== key)
  } else {
    selectedRowKeys.value = [...selectedRowKeys.value, key]
    selectedRows.value = [...selectedRows.value, record]
  }
}

function customRow(record) {
  return {
    style: { cursor: 'pointer' },
    onClick: (e) => {
      const target = e.target
      if (
        target?.closest?.('.ant-checkbox-wrapper') ||
        target?.closest?.('.ant-checkbox') ||
        target?.closest?.('.ant-radio-wrapper') ||
        target?.closest?.('.ant-radio') ||
        target?.closest?.('input')
      ) {
        return
      }
      toggleRow(record)
    },
  }
}

watch(
  () => props.open,
  (val) => {
    if (!val) return
    const ids = (props.selected || []).map((id) => String(id || '').trim()).filter(Boolean)
    const rows = ids.map(
      (id) =>
        allDevices.value.find((r) => r.id === id) || {
          id,
          name: id,
          code: '',
          category: '',
          model: '',
          location: '',
          status: '',
          label: id,
        },
    )
    selectedRowKeys.value = rows.map((r) => r.id)
    selectedRows.value = rows
    keyword.value = ''
    appliedKeyword.value = ''
    category.value = props.categoryFilter || undefined
    pagination.current = 1
  },
)

watch(
  () => filteredList.value.length,
  () => {
    const maxPage = Math.max(1, Math.ceil(filteredList.value.length / pagination.pageSize) || 1)
    if (pagination.current > maxPage) pagination.current = maxPage
  },
)

function handleSearch() {
  appliedKeyword.value = keyword.value
  pagination.current = 1
}

function handleReset() {
  keyword.value = ''
  appliedKeyword.value = ''
  category.value = props.categoryFilter || undefined
  pagination.current = 1
}

function removeSelected(id) {
  selectedRowKeys.value = selectedRowKeys.value.filter((k) => k !== id)
  selectedRows.value = selectedRows.value.filter((r) => r.id !== id)
}

function clearSelection() {
  selectedRowKeys.value = []
  selectedRows.value = []
}

function handleCancel() {
  emit('update:open', false)
}

function handleConfirm() {
  emit(
    'confirm',
    selectedRows.value.map((r) => r.id),
  )
  emit('update:open', false)
}
</script>

<style lang="less" scoped>
.search-form {
  margin-bottom: 12px;
  width: 100%;
}

.picker-body {
  display: flex;
  gap: 12px;
  height: 400px;
  max-height: calc(86vh - 220px);
  min-height: 320px;
}

.table-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.table-pagination {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

.selected-panel {
  width: 240px;
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  overflow: hidden;
}

.selected-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
  flex-shrink: 0;
}

.selected-title {
  font-weight: 600;
  font-size: 13px;
  color: #333;
}

.clear-btn {
  padding: 0;
  height: auto;
}

.selected-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}

.selected-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  margin-bottom: 6px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
}

.selected-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  flex-shrink: 0;
  color: rgba(0, 0, 0, 0.45);

  &:hover {
    color: #ff4d4f;
  }
}

.selected-empty {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
