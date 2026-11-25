<template>
  <div class="tpl-panel">
    <div class="toolbar-row">
      <a-button type="primary" size="small" @click="openCreate">新建模板</a-button>
      <span class="hint"
        >一期模板只配：出勤 / 投料 / 产出 / 化验 / 能耗停时 / 文本；班次时段决定自动汇总窗口</span
      >
    </div>

    <div class="table-card">
      <a-table :columns="columns" :data-source="rows" row-key="id" size="small" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'workshop'">
            {{ record.workshop ? workshopLabel[record.workshop] : '通用（未绑定）' }}
          </template>
          <template v-else-if="column.key === 'sections'">
            {{ (record.sections || []).filter((s) => s.enabled !== false).length }} 个区块
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="8">
              <a class="link" @click="openEdit(record)">编辑</a>
              <a class="link" @click="handleDup(record)">复制</a>
              <a
                v-if="record.id !== 'tpl-generic'"
                class="link danger"
                @click="handleDelete(record)"
              >
                删除
              </a>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <a-drawer
      v-model:open="open"
      :title="editingId ? '编辑交班模板' : '新建交班模板'"
      placement="right"
      :width="720"
      destroy-on-close
      @close="open = false"
    >
      <div class="drawer-basic-card">
        <div class="section-title">基本信息</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="12">
              <a-form-item label="模板名称" required>
                <a-input v-model:value="form.name" size="small" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="绑定车间">
                <a-select
                  v-model:value="form.workshop"
                  allow-clear
                  size="small"
                  placeholder="不绑定=通用"
                  :options="workshopOptions"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="说明" class="remark-item">
                <a-input v-model:value="form.remark" size="small" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="白班时段">
                <a-space>
                  <a-input
                    v-model:value="form.shiftWindows.day.start"
                    size="small"
                    style="width: 72px"
                  />
                  <span>~</span>
                  <a-input
                    v-model:value="form.shiftWindows.day.end"
                    size="small"
                    style="width: 72px"
                  />
                </a-space>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="夜班时段">
                <a-space>
                  <a-input
                    v-model:value="form.shiftWindows.night.start"
                    size="small"
                    style="width: 72px"
                  />
                  <span>~</span>
                  <a-input
                    v-model:value="form.shiftWindows.night.end"
                    size="small"
                    style="width: 72px"
                  />
                </a-space>
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <div class="section-title-out">
        区块
        <a-dropdown>
          <a-button size="small">添加区块</a-button>
          <template #overlay>
            <a-menu @click="({ key }) => addSection(key)">
              <a-menu-item v-for="opt in sectionTypeOptions" :key="opt.value">
                {{ opt.label }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>

      <div v-for="(sec, idx) in form.sections" :key="sec.id" class="sec-card">
        <div class="sec-head">
          <a-space>
            <a-tag>{{ sectionTypeLabel[sec.type] || sec.type }}</a-tag>
            <a-input v-model:value="sec.title" size="small" style="width: 160px" />
            <a-switch
              v-model:checked="sec.enabled"
              checked-children="开"
              un-checked-children="关"
            />
          </a-space>
          <a-button type="link" size="small" danger @click="form.sections.splice(idx, 1)">
            移除
          </a-button>
        </div>
        <div v-if="sec.type === 'text'" class="field-row">
          <span class="lbl">文本键</span>
          <a-input v-model:value="sec.textKey" size="small" style="width: 160px" />
        </div>
        <div v-else class="mini-tip">{{ sectionHint(sec.type) }}</div>
      </div>

      <template #footer>
        <a-space>
          <a-button @click="open = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
        </a-space>
      </template>
    </a-drawer>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { WORKSHOP_LABEL, WORKSHOP_OPTIONS } from '@/store/shiftEnergyReportStore'
import {
  DEFAULT_SHIFT_WINDOWS,
  SECTION_TYPE_OPTIONS,
  createSection,
  deleteShiftReportTemplate,
  duplicateShiftReportTemplate,
  listShiftReportTemplates,
  saveShiftReportTemplate,
  shiftReportTemplateState,
} from '@/store/shiftReportTemplateStore'

const workshopOptions = WORKSHOP_OPTIONS
const workshopLabel = WORKSHOP_LABEL
const sectionTypeOptions = SECTION_TYPE_OPTIONS
const sectionTypeLabel = Object.fromEntries(SECTION_TYPE_OPTIONS.map((o) => [o.value, o.label]))

const open = ref(false)
const editingId = ref('')
const saving = ref(false)
const form = reactive(emptyForm())

const columns = [
  { title: '模板名称', dataIndex: 'name', key: 'name', width: 180 },
  { title: '绑定车间', key: 'workshop', width: 140 },
  { title: '区块', key: 'sections', width: 100 },
  { title: '说明', dataIndex: 'remark', key: 'remark', ellipsis: true },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 140 },
  { title: '操作', key: 'action', width: 160, fixed: 'right' },
]

const rows = computed(() => {
  void shiftReportTemplateState.templates
  return listShiftReportTemplates()
})

function sectionHint(type) {
  const map = {
    attendance: '填写应到/实到人数',
    feed_summary: '按班次时段自动汇总投料过账',
    output_summary: '按班次时段自动汇总产出过账',
    assay_summary: '按班次时段自动汇总化验单',
    energy: '手工填写用电/蒸汽/故障停时',
  }
  return map[type] || ''
}

function emptyForm() {
  return {
    name: '',
    workshop: undefined,
    remark: '',
    shiftWindows: JSON.parse(JSON.stringify(DEFAULT_SHIFT_WINDOWS)),
    sections: [
      createSection('attendance'),
      createSection('feed_summary'),
      createSection('output_summary'),
      createSection('assay_summary'),
      createSection('energy'),
      createSection('text', { title: '异常情况', textKey: 'abnormalities' }),
    ],
  }
}

function openCreate() {
  editingId.value = ''
  Object.assign(form, emptyForm())
  open.value = true
}

function openEdit(record) {
  editingId.value = record.id
  Object.assign(form, {
    name: record.name,
    workshop: record.workshop || undefined,
    remark: record.remark || '',
    shiftWindows: JSON.parse(JSON.stringify(record.shiftWindows || DEFAULT_SHIFT_WINDOWS)),
    sections: JSON.parse(JSON.stringify(record.sections || [])),
  })
  open.value = true
}

function addSection(type) {
  form.sections.push(createSection(type))
}

function handleDup(record) {
  try {
    duplicateShiftReportTemplate(record.id)
    message.success('已复制模板')
  } catch (err) {
    message.error(err?.message || '复制失败')
  }
}

function handleDelete(record) {
  Modal.confirm({
    title: '确认删除该模板？',
    content: record.name,
    okText: '删除',
    okType: 'danger',
    onOk: () => {
      try {
        deleteShiftReportTemplate(record.id)
        message.success('已删除')
      } catch (err) {
        message.error(err?.message || '删除失败')
      }
    },
  })
}

async function handleSave() {
  saving.value = true
  try {
    saveShiftReportTemplate(
      {
        name: form.name,
        workshop: form.workshop || '',
        remark: form.remark,
        shiftWindows: form.shiftWindows,
        sections: form.sections,
      },
      editingId.value || undefined,
    )
    message.success('保存成功')
    open.value = false
  } catch (err) {
    message.error(err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="less">
.tpl-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toolbar-row,
.table-card {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
}
.toolbar-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 48px;
}
.hint {
  font-size: 13px;
  color: #86909c;
}
.link {
  color: #1677ff;
  cursor: pointer;
  &.danger {
    color: #ff4d4f;
  }
}
.drawer-basic-card {
  margin-bottom: 16px;
  padding: 12px 16px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}
.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
}
.section-title-out {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
}
.sec-card {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}
.sec-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.lbl {
  color: #4e5969;
  font-size: 13px;
}
.mini-tip {
  font-size: 12px;
  color: #86909c;
}
</style>
