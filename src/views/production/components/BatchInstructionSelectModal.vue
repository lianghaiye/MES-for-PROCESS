<template>
  <a-modal
    :open="open"
    title="选择批次指令"
    width="960px"
    :mask-closable="false"
    destroy-on-close
    @cancel="handleCancel"
  >
    <div class="filter-card">
      <a-form layout="inline" class="filter-form horizontal-form" @submit.prevent="handleSearch">
        <ListFilterBar
          :field-count="4"
          search-text="搜索"
          reset-text="重置"
          @search="handleSearch"
          @reset="handleReset"
        >
          <a-form-item label="批次号">
            <a-input
              v-model:value="filters.batchNo"
              allow-clear
              size="small"
              placeholder="请输入"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="产品">
            <a-input
              v-model:value="filters.productName"
              allow-clear
              size="small"
              placeholder="请输入"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="配方">
            <a-input
              v-model:value="filters.formulaName"
              allow-clear
              size="small"
              placeholder="请输入"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="状态">
            <a-select
              v-model:value="filters.status"
              allow-clear
              size="small"
              placeholder="全部"
              :options="statusOptions"
            />
          </a-form-item>
        </ListFilterBar>
      </a-form>
    </div>

    <div class="picker-body">
      <div class="table-panel">
        <a-table
          :columns="columns"
          :data-source="filteredList"
          row-key="id"
          size="small"
          bordered
          :pagination="{ pageSize: 8, size: 'small', showTotal: (total) => `共 ${total} 条` }"
          :row-selection="rowSelection"
          :scroll="{ x: 720, y: 360 }"
          :custom-row="customRow"
          :locale="{ emptyText: '没有可领料的批次指令' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'product'">{{ productText(record) }}</template>
            <template v-else-if="column.key === 'formula'">{{
              record.formulaName || '—'
            }}</template>
            <template v-else-if="column.key === 'qty'">
              {{ qtyText(record) }}
            </template>
          </template>
        </a-table>
      </div>

      <div class="selected-panel">
        <div class="selected-head">
          <span class="selected-title">已选 {{ selectedRow ? 1 : 0 }} 项</span>
          <a-button
            v-if="selectedRow"
            type="link"
            size="small"
            class="clear-btn"
            @click="clearSelection"
          >
            清空
          </a-button>
        </div>
        <div v-if="selectedRow" class="selected-list">
          <div class="selected-item">
            <div class="selected-item-main">
              <span class="selected-code">{{ selectedRow.batchNo }}</span>
              <span class="selected-name" :title="productText(selectedRow)">
                {{ productText(selectedRow) }}
              </span>
              <span class="selected-meta">{{ selectedRow.formulaName || '—' }}</span>
            </div>
            <a-button type="text" size="small" class="remove-btn" @click="clearSelection">
              <CloseOutlined />
            </a-button>
          </div>
        </div>
        <a-empty v-else :image="false" description="请从左侧选择" class="selected-empty" />
      </div>
    </div>

    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" :disabled="!selectedRow" @click="handleConfirm">确定</a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import ListFilterBar from '@/components/ListFilterBar.vue'
import { ORDER_STATUS_LABEL } from '@/store/batchInstructionStore'
import { itemMasterCard } from '@/store/processFormulaStore'
import { formatNumber } from '@/utils/numberFormat'

const props = defineProps({
  open: { type: Boolean, default: false },
  orders: { type: Array, default: () => [] },
  excludeIds: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
})

const emit = defineEmits(['update:open', 'confirm'])

const filters = reactive({
  batchNo: '',
  productName: '',
  formulaName: '',
  status: undefined,
})
const applied = reactive({
  batchNo: '',
  productName: '',
  formulaName: '',
  status: undefined,
})
const selectedKey = ref('')

const columns = [
  { title: '批次号', dataIndex: 'batchNo', key: 'batchNo', width: 160 },
  { title: '状态', key: 'status', width: 90 },
  { title: '产品', key: 'product', ellipsis: true },
  { title: '配方', key: 'formula', ellipsis: true },
  { title: '批量', key: 'qty', width: 120 },
]

const pool = computed(() => {
  const excluded = new Set((props.excludeIds || []).filter((id) => id && id !== props.selectedId))
  return (props.orders || []).filter((row) => row?.id && !excluded.has(row.id))
})

const statusOptions = computed(() => {
  const keys = [...new Set(pool.value.map((row) => row.status).filter(Boolean))]
  return keys.map((status) => ({ label: statusText(status), value: status }))
})

const filteredList = computed(() => {
  const batchNo = applied.batchNo.trim().toLowerCase()
  const productName = applied.productName.trim().toLowerCase()
  const formulaName = applied.formulaName.trim().toLowerCase()
  return pool.value.filter((row) => {
    if (applied.status && row.status !== applied.status) return false
    if (
      batchNo &&
      !String(row.batchNo || '')
        .toLowerCase()
        .includes(batchNo)
    )
      return false
    if (
      formulaName &&
      !String(row.formulaName || '')
        .toLowerCase()
        .includes(formulaName)
    )
      return false
    if (productName && !productText(row).toLowerCase().includes(productName)) return false
    return true
  })
})

const selectedRow = computed(() => pool.value.find((row) => row.id === selectedKey.value) || null)

const rowSelection = computed(() => ({
  type: 'radio',
  selectedRowKeys: selectedKey.value ? [selectedKey.value] : [],
  onChange: (keys) => {
    selectedKey.value = keys[0] || ''
  },
}))

watch(
  () => props.open,
  (visible) => {
    if (!visible) return
    selectedKey.value = props.selectedId || ''
    handleReset()
  },
)

function statusText(status) {
  return ORDER_STATUS_LABEL[status] || '—'
}

function statusColor(status) {
  if (status === 'running') return 'processing'
  if (status === 'done') return 'success'
  if (status === 'pending_release') return 'warning'
  return 'default'
}

function productText(order) {
  const card = itemMasterCard(order?.itemId)
  const text = `${card.code || ''} ${card.name || ''}`.trim()
  return text || '—'
}

function qtyText(order) {
  if (order?.qty == null || order.qty === '') return '—'
  return `${formatNumber(order.qty, 3, { empty: '—' })} ${order.unit || ''}`.trim()
}

function handleSearch() {
  Object.assign(applied, filters)
}

function handleReset() {
  filters.batchNo = ''
  filters.productName = ''
  filters.formulaName = ''
  filters.status = undefined
  Object.assign(applied, filters)
}

function clearSelection() {
  selectedKey.value = ''
}

function customRow(record) {
  return {
    onClick: () => {
      selectedKey.value = record.id
    },
  }
}

function handleCancel() {
  emit('update:open', false)
}

function handleConfirm() {
  if (!selectedRow.value) {
    message.warning('请选择批次指令')
    return
  }
  emit('confirm', selectedRow.value)
  emit('update:open', false)
}
</script>

<script>
export default { name: 'BatchInstructionSelectModal' }
</script>

<style lang="less" scoped>
.filter-card {
  margin-bottom: 12px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.picker-body {
  display: flex;
  gap: 12px;
  min-height: 420px;
}

.table-panel {
  flex: 1;
  min-width: 0;
}

.selected-panel {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}

.selected-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.selected-title {
  font-size: 13px;
  font-weight: 600;
}

.clear-btn {
  height: auto;
  padding: 0;
}

.selected-list {
  padding: 8px;
}

.selected-item {
  display: flex;
  gap: 4px;
  padding: 8px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
}

.selected-item-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.selected-code {
  font-size: 13px;
  font-weight: 600;
}

.selected-name,
.selected-meta {
  overflow: hidden;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  color: rgba(0, 0, 0, 0.45);

  &:hover {
    color: #ff4d4f;
  }
}

.selected-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
}

:deep(.ant-table-tbody > tr) {
  cursor: pointer;
}
</style>
