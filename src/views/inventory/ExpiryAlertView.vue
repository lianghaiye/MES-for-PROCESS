<template>
  <div class="process-batch-page">
    <div class="filter-card">
      <a-form layout="inline" class="horizontal-form">
        <a-form-item label="预警">
          <a-select v-model:value="kind" size="small" :options="kindOptions" style="width: 140px" />
        </a-form-item>
        <a-form-item label="物料">
          <span class="item-select"><MasterItemSelect v-model="itemId" placeholder="全部" /></span>
        </a-form-item>
      </a-form>
    </div>
    <div class="table-card">
      <div class="toolbar">
        <span>临期 {{ soonCount }} 批，已过期 {{ expiredCount }} 批</span>
        <span class="hint">临期按主数据提前天数计算。已过期批次不能投料、不能发货。</span>
      </div>
      <a-table
        :columns="columns"
        :data-source="rows"
        row-key="id"
        size="small"
        :pagination="{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (total) => `共 ${total} 条`,
        }"
        :locale="{ emptyText: '暂无临期或过期批次' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'item'">{{ itemLabel(record.itemId) }}</template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{
              BATCH_STATUS_LABEL[record.status] || '—'
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'alert'">
            <a-tag :color="record.alertType === 'expired' ? 'error' : 'warning'">
              {{ record.alertType === 'expired' ? '已过期' : '临期' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'remain'">{{ record.alertText }}</template>
          <template v-else-if="column.key === 'loc'">{{ tankName(record.locationId) }}</template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { itemLabel } from '@/store/processFormulaStore'
import MasterItemSelect from '@/views/product-process/components/MasterItemSelect.vue'
import {
  BATCH_STATUS_LABEL,
  findProcessItem,
  listMaterialBatches,
  listTanks,
} from '@/store/materialBatchStore'
import { findMasterItemByCode } from '@/utils/stockAlertDisplay'
import { resolveExpiryAlert } from '@/utils/expiryAlert'
import '@/styles/process-batch-page.less'

const kind = ref('all')
const itemId = ref(undefined)
const kindOptions = [
  { label: '全部预警', value: 'all' },
  { label: '临期', value: 'soon' },
  { label: '已过期', value: 'expired' },
]
const columns = [
  { title: '批次号', dataIndex: 'batchNo', width: 160 },
  { title: '物料', key: 'item' },
  { title: '状态', key: 'status', width: 90 },
  { title: '数量', dataIndex: 'qty', align: 'right', width: 90 },
  { title: '失效日期', dataIndex: 'expiryDate', width: 120 },
  { title: '预警', key: 'alert', width: 90 },
  { title: '剩余', key: 'remain', width: 120 },
  { title: '提前天数', dataIndex: 'leadDays', width: 100 },
  { title: '位置', key: 'loc', width: 120 },
]

function statusColor(status) {
  if (status === 'released') return 'success'
  if (status === 'rejected' || status === 'expired') return 'error'
  return 'warning'
}

function tankName(id) {
  return listTanks().find((tank) => tank.id === id)?.name || '—'
}

function classify(batch) {
  if (!(Number(batch.qty) > 0)) return null
  const item = findProcessItem(batch.itemId)
  const master = findMasterItemByCode(item?.code)
  const alert = master?.item?.alert
  const hint = resolveExpiryAlert(batch.expiryDate, alert)
  if (hint.type === 'soon' || hint.type === 'expired') {
    const days = Number(alert?.expiryAlertDays)
    return {
      alertType: hint.type,
      alertText: hint.text,
      leadDays: Number.isFinite(days) && days > 0 ? `${days} 天` : '—',
      sortRemain: hint.remain ?? 0,
    }
  }
  const expiry = String(batch.expiryDate || '')
  const today = dayjs().format('YYYY-MM-DD')
  if ((expiry && expiry < today) || batch.status === 'expired') {
    const remain = /^\d{4}-\d{2}-\d{2}$/.test(expiry)
      ? dayjs(expiry).startOf('day').diff(dayjs(today).startOf('day'), 'day')
      : null
    return {
      alertType: 'expired',
      alertText: remain != null && remain < 0 ? `已过期 ${Math.abs(remain)} 天` : '已过期',
      leadDays: '—',
      sortRemain: remain ?? -9999,
    }
  }
  return null
}

const warned = computed(() =>
  listMaterialBatches()
    .map((batch) => {
      const hit = classify(batch)
      return hit ? { ...batch, ...hit } : null
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.alertType !== b.alertType) return a.alertType === 'expired' ? -1 : 1
      return a.sortRemain - b.sortRemain
    }),
)

const rows = computed(() =>
  warned.value.filter((row) => {
    if (itemId.value && row.itemId !== itemId.value) return false
    if (kind.value !== 'all' && row.alertType !== kind.value) return false
    return true
  }),
)

const soonCount = computed(() => warned.value.filter((row) => row.alertType === 'soon').length)
const expiredCount = computed(
  () => warned.value.filter((row) => row.alertType === 'expired').length,
)
</script>

<style scoped>
.hint {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.item-select {
  display: inline-block;
  width: 220px;
}
</style>
