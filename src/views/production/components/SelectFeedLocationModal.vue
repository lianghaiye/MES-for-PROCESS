<template>
  <a-modal
    :open="open"
    title="选择来源储罐/库位"
    :width="960"
    :mask-closable="false"
    destroy-on-close
    wrap-class-name="select-feed-location-modal-wrap"
    @cancel="close"
  >
    <div class="modal-basic-card filter-card">
      <a-form layout="inline" class="horizontal-form">
        <!-- ListFilterBar 自带「查询 / 清空」，避免空 label 冒出多余冒号 -->
        <ListFilterBar
          :field-count="2"
          search-text="查询"
          reset-text="清空"
          @search="handleSearch"
          @reset="resetFilters"
        >
          <a-form-item label="名称">
            <a-input
              v-model:value="filters.keyword"
              size="small"
              allow-clear
              placeholder="请输入名称"
              @press-enter="handleSearch"
            />
          </a-form-item>
          <a-form-item label="类型">
            <a-select
              v-model:value="filters.kind"
              size="small"
              allow-clear
              placeholder="全部"
              style="width: 140px"
              :options="kindOptions"
            />
          </a-form-item>
        </ListFilterBar>
      </a-form>
    </div>

    <a-table
      size="small"
      bordered
      row-key="value"
      :columns="columns"
      :data-source="filteredRows"
      :pagination="false"
      :scroll="{ x: 900, y: 360 }"
      :row-selection="rowSelection"
      :custom-row="customRow"
      :locale="{ emptyText: emptyText }"
    >
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'index'">
          {{ index + 1 }}
        </template>
        <template v-else-if="column.key === 'kind'">
          {{ record.kind === 'tank' ? '储罐' : '仓库' }}
        </template>
        <template v-else-if="column.key === 'qty'">
          {{ formatQty(record.qty) }} {{ unitLabel }}
        </template>
        <template v-else-if="column.key === 'code'">
          {{ displayText(record.code) }}
        </template>
        <template v-else-if="column.key === 'place'">
          {{ displayText(record.placeText) }}
        </template>
        <template v-else-if="column.key === 'manager'">
          {{ displayText(record.managerText) }}
        </template>
      </template>
    </a-table>

    <template #footer>
      <a-button @click="close">取消</a-button>
      <a-button type="primary" :disabled="!pickedId" @click="confirm">确定</a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import ListFilterBar from '@/components/ListFilterBar.vue'
import { formatNumber } from '@/utils/numberFormat'
import {
  getStockLocation,
  listFeedSourceLocations,
  materialBatchState,
} from '@/store/materialBatchStore'
import { warehouseState } from '@/store/warehouseStore'
import { getDeviceById } from '@/store/equipmentStore'
import { formatWorkCenterLabel } from '@/store/workCenterStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  itemId: { type: String, default: '' },
  order: { type: Object, default: null },
  /** fresh | recycle */
  feedSource: { type: String, default: 'fresh' },
  selectedId: { type: String, default: '' },
  unitLabel: { type: String, default: 'kg' },
})

const emit = defineEmits(['update:open', 'selected'])

/** 表单草稿条件（点查询后才写入 applied） */
const filters = reactive({
  keyword: '',
  kind: undefined,
})

/** 已生效的查询条件 */
const applied = reactive({
  keyword: '',
  kind: undefined,
})

const pickedId = ref('')

const kindOptions = [
  { value: 'tank', label: '储罐' },
  { value: 'silo', label: '仓库' },
]

const columns = [
  { title: '序号', key: 'index', width: 56, align: 'center' },
  { title: '名称', dataIndex: 'name', ellipsis: true, width: 140 },
  { title: '编码', key: 'code', width: 120, ellipsis: true },
  { title: '类型', key: 'kind', width: 80 },
  { title: '位置', key: 'place', width: 160, ellipsis: true },
  { title: '管理员', key: 'manager', width: 100, ellipsis: true },
  { title: '可扣量', key: 'qty', width: 140, align: 'right' },
]

const emptyText = computed(() =>
  props.feedSource === 'recycle' ? '没有可扣的回流库位/储罐' : '没有可扣的线边库位/储罐',
)

/**
 * 补齐库位编码、位置、管理员：
 * - 储罐：优先库存位置 managerName，回落设备 stockKeeperName / responsible
 * - 仓库：仓库主数据 address + managerName（按 id/name/code 匹配）
 */
function resolveLocationMeta(locationId, kind) {
  const tank = getStockLocation(locationId)
  const code = String(tank?.code || locationId || '').trim()
  let placeText = ''
  let managerText = ''

  if (kind === 'tank' || tank?.kind === 'tank') {
    const device = tank?.equipmentId ? getDeviceById(tank.equipmentId) : null
    const centerName = device?.workCenterId ? formatWorkCenterLabel(device.workCenterId) : ''
    placeText = [centerName, device?.location].filter(Boolean).join(' / ')
    // 位置仓管员优先；未同步时回落设备库存责任人 / 设备责任人
    managerText = String(
      tank?.managerName || device?.stockKeeperName || device?.responsible || '',
    ).trim()
  } else {
    // 线边仓/堆场：优先按库位 id，再按名称、编码挂仓库主数据
    const wh =
      warehouseState.warehouses.find((w) => w.id === locationId) ||
      warehouseState.warehouses.find((w) => w.name === tank?.name) ||
      warehouseState.warehouses.find((w) => tank?.code && w.code === tank.code) ||
      null
    placeText = String(wh?.address || wh?.name || tank?.name || '').trim()
    managerText = String(wh?.managerName || tank?.managerName || '').trim()
  }

  return {
    code,
    placeText,
    managerText,
  }
}

const allRows = computed(() => {
  void materialBatchState.batches
  void materialBatchState.tanks
  void warehouseState.warehouses
  if (!props.itemId) return []
  return listFeedSourceLocations(props.itemId, props.order, {
    source: props.feedSource === 'recycle' ? 'recycle' : 'fresh',
  }).map((row) => {
    const tank = getStockLocation(row.value)
    const name =
      String(tank?.name || '').trim() ||
      String(row.label || '')
        .replace(/（[^）]*）\s*$/, '')
        .trim() ||
      row.value
    const meta = resolveLocationMeta(row.value, row.kind)
    return {
      ...row,
      name,
      ...meta,
    }
  })
})

const filteredRows = computed(() => {
  const needle = String(applied.keyword || '')
    .trim()
    .toLowerCase()
  return allRows.value.filter((row) => {
    if (applied.kind && row.kind !== applied.kind) return false
    if (!needle) return true
    const bag =
      `${row.name || ''} ${row.code || ''} ${row.label || ''} ${row.value || ''}`.toLowerCase()
    return bag.includes(needle)
  })
})

const rowSelection = computed(() => ({
  type: 'radio',
  selectedRowKeys: pickedId.value ? [pickedId.value] : [],
  columnWidth: 48,
  onChange: (keys) => {
    pickedId.value = keys?.[0] ? String(keys[0]) : ''
  },
}))

function customRow(record) {
  return {
    onClick: () => {
      pickedId.value = record.value
    },
  }
}

function formatQty(value) {
  return formatNumber(value, 3, { empty: '0' })
}

/** 空值统一显示为 — */
function displayText(value) {
  const text = String(value || '').trim()
  return text || '—'
}

/** 将草稿条件落到已生效条件 */
function handleSearch() {
  applied.keyword = String(filters.keyword || '').trim()
  applied.kind = filters.kind || undefined
}

function resetFilters() {
  filters.keyword = ''
  filters.kind = undefined
  applied.keyword = ''
  applied.kind = undefined
}

function close() {
  emit('update:open', false)
}

function confirm() {
  if (!pickedId.value) return
  const hit = allRows.value.find((row) => row.value === pickedId.value)
  emit('selected', hit || { value: pickedId.value })
  close()
}

watch(
  () => [props.open, props.selectedId],
  ([open]) => {
    if (!open) return
    pickedId.value = String(props.selectedId || '').trim()
    resetFilters()
  },
)
</script>

<style lang="less" scoped>
.filter-card {
  margin-bottom: 12px;
}
</style>

<style lang="less">
.select-feed-location-modal-wrap {
  .ant-modal-body {
    padding-top: 16px;
  }
}
</style>
