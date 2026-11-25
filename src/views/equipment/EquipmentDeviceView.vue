<template>
  <div class="eq-page">
    <div class="filter-card">
      <a-form layout="inline" class="filter-form horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="设备编码">
              <a-input v-model:value="filters.code" allow-clear size="small" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="设备名称">
              <a-input v-model:value="filters.name" allow-clear size="small" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="设备类型">
              <a-select
                v-model:value="filters.category"
                allow-clear
                size="small"
                placeholder="全部"
                :options="EQUIPMENT_CATEGORY_OPTIONS"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="设备状态">
              <a-select
                v-model:value="filters.status"
                allow-clear
                size="small"
                placeholder="全部"
                :options="EQUIPMENT_STATUS_OPTIONS"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item>
              <a-space>
                <a-button type="primary" size="small" @click="handleSearch">
                  <SearchOutlined />
                  查询
                </a-button>
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
        新增设备
      </a-button>
      <a-button type="text" size="small" @click="handleSearch">
        <ReloadOutlined />
      </a-button>
    </div>

    <div class="table-card">
      <a-table
        :columns="columns"
        :data-source="pagedList"
        row-key="id"
        size="small"
        bordered
        :pagination="false"
        :scroll="{ x: 1780 }"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">{{ rowIndex(index) }}</template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
          </template>
          <template v-else-if="column.key === 'nominalCapacity'">
            {{ volumeText(record.nominalCapacity, record.capacityUnit) }}
          </template>
          <template v-else-if="column.key === 'workingCapacity'">
            {{ volumeText(record.workingCapacity, record.capacityUnit) }}
          </template>
          <template v-else-if="column.key === 'occupyStatus'">
            <a-tag v-if="record.occupyStatus" :color="occupyColor(record.occupyStatus)">
              {{ record.occupyStatus }}
            </a-tag>
            <template v-else>—</template>
          </template>
          <template v-else-if="column.key === 'asStockLocation'">
            <a-tag v-if="record.asStockLocation" color="processing">是</a-tag>
            <span v-else>—</span>
          </template>
          <template v-else-if="column.key === 'stockKeeperName'">
            {{ record.asStockLocation && record.stockKeeperName ? record.stockKeeperName : '—' }}
          </template>
          <template v-else-if="column.key === 'inventoryLocationId'">
            <span v-if="record.asStockLocation && record.inventoryLocationId">{{
              locationLabel(record.inventoryLocationId)
            }}</span>
            <span v-else>—</span>
          </template>
          <template v-else-if="column.key === 'workCenterId'">
            {{ formatWorkCenterLabel(record.workCenterId) || '—' }}
          </template>
          <template v-else-if="column.key === 'category'">
            <a-tag>{{ record.category }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button type="link" size="small" danger @click="handleDelete(record)"
                >删除</a-button
              >
            </a-space>
          </template>
          <template v-else>
            {{ cell(record, column) }}
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
          :show-total="(t) => `共 ${t} 条`"
        />
      </div>
    </div>

    <DeviceFormModal v-model:open="modalOpen" :record="editRecord" @saved="tick++" />
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_OCCUPY_STATUS,
  EQUIPMENT_STATUS,
  EQUIPMENT_STATUS_OPTIONS,
} from '@/mock/equipmentSeed'
import { deleteDevice, equipmentState, listDevices } from '@/store/equipmentStore'
import { getStockLocation } from '@/store/materialBatchStore'
import { formatWorkCenterLabel } from '@/store/workCenterStore'
import DeviceFormModal from './components/DeviceFormModal.vue'

const filters = reactive({ code: '', name: '', category: undefined, status: undefined })
const applied = ref({ ...filters })
const pagination = reactive({ current: 1, pageSize: 10 })
const tick = ref(0)
const modalOpen = ref(false)
const editRecord = ref(null)

const columns = [
  { title: '序号', key: 'index', width: 56, align: 'center', fixed: 'left' },
  { title: '设备编码', dataIndex: 'code', width: 130, fixed: 'left' },
  { title: '设备名称', dataIndex: 'name', width: 140, ellipsis: true },
  { title: '设备类型', key: 'category', width: 110 },
  { title: '型号', dataIndex: 'model', width: 110 },
  { title: '工作中心', key: 'workCenterId', width: 120, ellipsis: true },
  { title: '位置', dataIndex: 'location', width: 100 },
  { title: '设备状态', key: 'status', width: 90 },
  { title: '库存存放点', key: 'asStockLocation', width: 100, align: 'center' },
  { title: '库存责任人', key: 'stockKeeperName', width: 100 },
  { title: '公称容积', key: 'nominalCapacity', width: 110, align: 'right' },
  { title: '工作容积', key: 'workingCapacity', width: 110, align: 'right' },
  { title: '占釜状态', key: 'occupyStatus', width: 90 },
  { title: '占用批次', dataIndex: 'occupiedBatchNo', width: 120, ellipsis: true },
  { title: '库存位置', key: 'inventoryLocationId', width: 140, ellipsis: true },
  { title: '责任人', dataIndex: 'responsible', width: 90 },
  { title: '投用日期', dataIndex: 'installDate', width: 110 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' },
]

const filteredList = computed(() => {
  void tick.value
  void equipmentState.devices.length
  return listDevices(applied.value)
})

const pagedList = computed(() => {
  const start = (pagination.current - 1) * pagination.pageSize
  return filteredList.value.slice(start, start + pagination.pageSize)
})

function rowIndex(index) {
  return (pagination.current - 1) * pagination.pageSize + index + 1
}

function cell(record, column) {
  const v = record[column.dataIndex]
  return v != null && String(v).trim() !== '' ? v : '—'
}

function statusColor(status) {
  if (status === EQUIPMENT_STATUS.IN_USE) return 'success'
  if (status === EQUIPMENT_STATUS.REPAIRING) return 'error'
  if (status === EQUIPMENT_STATUS.IDLE) return 'warning'
  return 'default'
}

function occupyColor(status) {
  if (status === EQUIPMENT_OCCUPY_STATUS.CLEAN) return 'success'
  if (status === EQUIPMENT_OCCUPY_STATUS.OCCUPIED) return 'processing'
  if (status === EQUIPMENT_OCCUPY_STATUS.WAIT_DISCHARGE) return 'warning'
  return 'default'
}

function volumeText(value, unit) {
  if (value == null || value === '') return '—'
  return `${value} ${unit || ''}`.trim()
}

function locationLabel(locationId) {
  const loc = getStockLocation(locationId)
  if (!loc) return locationId
  return loc.code ? `${loc.name}（${loc.code}）` : loc.name
}

function handleSearch() {
  applied.value = { ...filters }
  pagination.current = 1
}

function handleReset() {
  filters.code = ''
  filters.name = ''
  filters.category = undefined
  filters.status = undefined
  handleSearch()
}

function openCreate() {
  editRecord.value = null
  modalOpen.value = true
}

function openEdit(record) {
  editRecord.value = { ...record }
  modalOpen.value = true
}

function handleDelete(record) {
  Modal.confirm({
    title: '确认删除该设备？',
    content: `${record.code} ${record.name}`,
    onOk() {
      const res = deleteDevice(record.id)
      if (!res.ok) {
        message.warning(res.message)
        return
      }
      message.success('已删除')
      tick.value += 1
    },
  })
}
</script>

<style lang="less" scoped>
@import './equipment-page.less';
</style>
