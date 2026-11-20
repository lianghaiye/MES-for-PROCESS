<template>
  <a-drawer
    :open="open"
    :title="record?.name ? `采集指标 · ${record.name}` : '采集指标详情'"
    placement="right"
    :width="drawerWidth"
    destroy-on-close
    @close="emit('update:open', false)"
  >
    <template v-if="record">
      <div class="section-title">基本信息</div>
      <div class="drawer-basic-card">
        <a-row :gutter="[24, 8]" class="drawer-basic-info">
          <a-col :span="12">
            <span class="info-label">状态：</span>
            <span class="info-value">
              <a-tag :color="record.status === '启用' ? 'success' : 'default'">{{
                record.status || '—'
              }}</a-tag>
              <a-tag v-if="record.isSystem" color="blue">系统</a-tag>
            </span>
          </a-col>
          <a-col :span="12">
            <span class="info-label">指标编码：</span>
            <span class="info-value">{{ record.code || '—' }}</span>
          </a-col>
          <a-col :span="12">
            <span class="info-label">指标名称：</span>
            <span class="info-value">{{ record.name || '—' }}</span>
          </a-col>
          <a-col :span="12">
            <span class="info-label">字段类型：</span>
            <span class="info-value">
              <a-tag :color="fieldTypeTagColor(record.type)">{{
                qcFieldTypeLabel(record.type)
              }}</a-tag>
            </span>
          </a-col>
          <a-col :span="12">
            <span class="info-label">是否必填：</span>
            <span class="info-value">{{ record.required ? '是' : '否' }}</span>
          </a-col>
          <a-col :span="12">
            <span class="info-label">单位：</span>
            <span class="info-value">{{ unitText }}</span>
          </a-col>
          <a-col :span="12">
            <span class="info-label">取值来源：</span>
            <span class="info-value">{{
              record.valueSource === 'system' ? '系统带出' : '手工录入'
            }}</span>
          </a-col>
          <a-col :span="24">
            <span class="info-label">输入提示：</span>
            <span class="info-value">{{ record.placeholder || '—' }}</span>
          </a-col>
          <a-col :span="24">
            <span class="info-label">说明：</span>
            <span class="info-value">{{ record.description || '—' }}</span>
          </a-col>
          <a-col :span="12">
            <span class="info-label">创建人：</span>
            <span class="info-value">{{ record.creator || '—' }}</span>
          </a-col>
          <a-col :span="12">
            <span class="info-label">创建时间：</span>
            <span class="info-value">{{ record.createdAt || '—' }}</span>
          </a-col>
        </a-row>
      </div>

      <template v-if="(record.options || []).length">
        <div class="section-title">选项</div>
        <a-table
          :columns="optionColumns"
          :data-source="optionRows"
          size="small"
          bordered
          :pagination="false"
        />
      </template>

      <template v-if="(record.children || []).length">
        <div class="section-title">子项（{{ record.children.length }}）</div>
        <a-table
          :columns="childColumns"
          :data-source="childRows"
          size="small"
          bordered
          :pagination="false"
        />
      </template>
    </template>
  </a-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { useDrawerWidth } from '@/composables/useDrawerWidth'
import { fieldTypeTagColor, qcFieldTypeLabel } from '@/mock/processFieldLibrary'

defineOptions({ name: 'ProcessFieldLibraryDetailDrawer' })

const props = defineProps({
  open: { type: Boolean, default: false },
  record: { type: Object, default: null },
})

const emit = defineEmits(['update:open'])
const { drawerWidth } = useDrawerWidth('m')

const optionColumns = [{ title: '选项值', dataIndex: 'value' }]
const childColumns = [
  { title: '编码', dataIndex: 'code', width: 120 },
  { title: '名称', dataIndex: 'name' },
  { title: '类型', dataIndex: 'type', width: 90 },
  { title: '单位', dataIndex: 'unit', width: 80 },
]

const optionRows = computed(() =>
  (props.record?.options || []).map((v, i) => ({ key: i, value: v })),
)

const childRows = computed(() =>
  (props.record?.children || []).map((c, i) => ({
    key: c.code || i,
    code: c.code || '—',
    name: c.name || '—',
    type: qcFieldTypeLabel(c.type),
    unit: c.unit || '—',
  })),
)

const unitText = computed(() => {
  const row = props.record
  if (!row?.withUnit && !row?.unit) return '—'
  const unit = String(row.unit || '').trim()
  if (!unit) return '—'
  return row.unitPosition === 'prefix' ? `${unit}（前）` : `${unit}（后）`
})
</script>

<style scoped lang="less">
.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.drawer-basic-card {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.drawer-basic-info {
  .info-label {
    color: #4e5969;
  }
  .info-value {
    color: #1f2329;
  }
}
</style>
