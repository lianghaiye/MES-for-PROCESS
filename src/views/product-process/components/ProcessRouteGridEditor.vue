<template>
  <div class="route-editor-layout" :class="{ 'is-readonly': readonly }">
    <div class="editor-main">
      <!-- 左侧：工序分类 + 工序列表 -->
      <div v-if="!readonly" class="left-panel panel-box" :style="{ width: `${leftWidth}px` }">
        <div class="box-title">工序</div>
        <ul class="category-list">
          <li
            v-for="cat in activeCategories"
            :key="cat"
            class="category-item"
            :class="{ active: activeCategory === cat }"
            @click="activeCategory = cat"
          >
            {{ cat }}
          </li>
        </ul>
        <div class="process-gallery-box">
          <div
            class="process-gallery"
            :style="{ gridTemplateColumns: `repeat(${galleryCols}, 1fr)` }"
          >
            <div
              v-for="proc in currentProcesses"
              :key="proc.id"
              class="process-tile"
              :class="{ active: pendingProcessId === proc.id }"
              draggable="true"
              :title="proc.name"
              @click="selectPendingProcess(proc)"
              @dragstart="onDragStart(proc, $event)"
            >
              {{ proc.name }}
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="!readonly"
        class="resize-handle"
        title="拖动调整宽度"
        @mousedown.prevent="startResize"
      />

      <!-- 中间：配置工艺路线 -->
      <div class="center-panel panel-box">
        <div class="box-title">{{ readonly ? '工艺路线' : '配置工艺路线' }}</div>
        <div v-if="!readonly" class="grid-tip">
          从左到右是主线，同一列的多行同时进行。每格选工序，再在右侧挂设备。渣、母液要回到前面某一格时，在右侧写回流。最大并行
          {{ MAX_ROUTE_PARALLEL }}，最大步数 {{ MAX_ROUTE_STEPS }}。
        </div>
        <div class="grid-area">
          <div class="grid-scroll">
            <div class="grid-header">
              <div class="corner-cell" />
              <div v-for="col in stepCount" :key="`h-${col}`" class="step-ctrl">
                <div class="step-ctrl-row">
                  <button
                    v-if="!readonly"
                    type="button"
                    class="ctrl-btn ctrl-minus"
                    :disabled="stepCount <= 1"
                    title="删除本步"
                    @click="removeStepAtIndex(col - 1)"
                  >
                    <MinusOutlined />
                  </button>
                  <span class="ctrl-label">第{{ col }}步</span>
                  <button
                    v-if="!readonly"
                    type="button"
                    class="ctrl-btn ctrl-plus"
                    :disabled="stepCount >= MAX_ROUTE_STEPS"
                    title="在此之后插入一步"
                    @click="insertStepAt(col - 1)"
                  >
                    <PlusOutlined />
                  </button>
                </div>
              </div>
            </div>
            <template v-for="row in rowCount" :key="`r-${row}`">
              <div class="grid-row">
                <div class="row-ctrl">
                  <button
                    v-if="!readonly"
                    type="button"
                    class="ctrl-btn ctrl-plus"
                    :disabled="rowCount >= MAX_ROUTE_PARALLEL"
                    title="在此之后插入一行"
                    @click="insertRowAt(row - 1)"
                  >
                    <PlusOutlined />
                  </button>
                  <span class="ctrl-label">{{ row }}</span>
                  <button
                    v-if="!readonly"
                    type="button"
                    class="ctrl-btn ctrl-minus"
                    :disabled="rowCount <= 1"
                    title="删除本行"
                    @click="removeRowAtIndex(row - 1)"
                  >
                    <MinusOutlined />
                  </button>
                </div>
                <div
                  v-for="col in stepCount"
                  :key="`${row}-${col}`"
                  class="grid-cell"
                  :class="{
                    selected: isSelected(col - 1, row - 1),
                    filled: hasCell(col - 1, row - 1),
                  }"
                  @click="onCellClick(col - 1, row - 1)"
                  @dragover="onCellDragOver"
                  @drop="onDrop(col - 1, row - 1, $event)"
                >
                  <template v-if="getCellProcess(col - 1, row - 1)">
                    <div class="cell-tile">
                      <CloseOutlined
                        v-if="!readonly"
                        class="cell-remove"
                        @click.stop="removeCell(col - 1, row - 1)"
                      />
                      <span class="cell-name">{{ getCellProcess(col - 1, row - 1).name }}</span>
                      <span v-if="cellEquipmentText(col - 1, row - 1)" class="cell-equip">{{
                        cellEquipmentText(col - 1, row - 1)
                      }}</span>
                      <span v-if="cellHasReturn(col - 1, row - 1)" class="cell-return">有回流</span>
                    </div>
                  </template>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 右侧：工序信息 + 文件配置（各自独立盒子） -->
      <div class="right-column">
        <div class="right-panel panel-box">
          <div class="box-title">工序信息</div>
          <template v-if="selectedMeta">
            <div class="info-body">
              <div class="info-meta-card">
                <div class="info-row">
                  <span class="k">工序名称</span>
                  <span class="v">{{ selectedMeta.processName || '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="k">工序编号</span>
                  <span class="v">{{ selectedMeta.processCode || '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="k">工序分类</span>
                  <span class="v">{{ selectedMeta.category || '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="k">关联设备</span>
                  <span class="v">{{ selectedMeta.equipmentText || '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="k">默认执行</span>
                  <span class="v">{{ selectedMeta.responsibleText || '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="k">操作说明</span>
                  <span class="v">{{ selectedMeta.instruction || '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="k">所属步骤</span>
                  <span class="v">{{ selectedStepPosText }}</span>
                </div>
                <div class="info-row">
                  <span class="k">调度策略</span>
                  <span class="v">{{ selectedMeta.dispatchStrategyLabel || '手动调度' }}</span>
                </div>
              </div>

              <div class="info-section">
                <div class="info-section-title">本格配置</div>
                <div class="info-field">
                  <div class="field-label">设备分类</div>
                  <a-select
                    v-if="!readonly"
                    :value="selectedMeta.equipmentCategory || undefined"
                    allow-clear
                    show-search
                    size="small"
                    option-filter-prop="label"
                    placeholder="设备分类"
                    :options="equipmentCategoryOpts"
                    class="field-control"
                    @change="onEquipmentCategoryChange"
                  />
                  <div v-else class="field-value">{{ selectedMeta.equipmentCategory || '—' }}</div>
                </div>
                <div class="info-field">
                  <div class="field-label">候选设备</div>
                  <EquipmentSearchSelect
                    v-if="!readonly"
                    :model-value="selectedMeta.equipmentIds || []"
                    :options="cellEquipmentOptions"
                    :allow-ids="cellEquipmentAllowIds"
                    :category-filter="selectedMeta.equipmentCategory || ''"
                    placeholder="候选设备（可多选）"
                    :max-tag-count="2"
                    class="field-control"
                    @change="onEquipmentChange"
                  />
                  <div v-else class="field-value">{{ selectedEquipmentLabel }}</div>
                  <div class="field-hint">
                    本路线该工序可用的候选设备，可多选；执行时再以产线设备为准。
                  </div>
                </div>

                <div class="info-field">
                  <div class="field-label">回流</div>
                  <div
                    v-for="(item, index) in selectedMeta.returns"
                    :key="`${item.toStep}-${item.toRow}-${index}`"
                    class="return-line"
                  >
                    <template v-if="!readonly">
                      <a-input
                        :value="item.stream"
                        size="small"
                        placeholder="液、渣、母液"
                        class="return-stream"
                        @change="(event) => onReturnStream(index, event.target.value)"
                      />
                      <a-select
                        :value="returnValue(item)"
                        size="small"
                        show-search
                        option-filter-prop="label"
                        placeholder="回到哪一格"
                        :options="returnTargetOptions"
                        class="return-target"
                        @change="(value) => onReturnTarget(index, value)"
                      />
                      <a-button
                        type="link"
                        size="small"
                        danger
                        class="return-del"
                        @click="removeReturn(index)"
                        >删除</a-button
                      >
                    </template>
                    <template v-else>{{ formatReturnLine(item) }}</template>
                  </div>
                  <a-button v-if="!readonly" size="small" class="return-add" @click="addReturn"
                    >添加回流</a-button
                  >
                  <div v-if="!selectedMeta.returns.length && readonly" class="field-value">—</div>
                  <div class="field-hint">渣、母液等要回到前面某一格时写在这里。</div>
                </div>

                <div class="info-field">
                  <div class="field-label">门禁</div>
                  <a-select
                    v-if="!readonly"
                    :value="selectedMeta.gateChoice"
                    size="small"
                    class="field-control"
                    :options="routeGateOpts"
                    @change="onGateChange"
                  />
                  <div v-else class="field-value">{{ selectedMeta.effectiveGateLabel }}</div>
                  <div class="field-hint">{{ gateHint }}</div>
                </div>

                <div class="info-field">
                  <div class="field-label">转移条件</div>
                  <a-checkbox
                    v-if="!readonly"
                    :checked="selectedMeta.transferCustom"
                    class="transfer-check"
                    @change="onTransferCustomChange"
                  >
                    本路线单独设置
                  </a-checkbox>
                  <a-textarea
                    :value="selectedMeta.transferDraft"
                    size="small"
                    :rows="3"
                    :disabled="readonly || !selectedMeta.transferCustom"
                    placeholder="未填写"
                    class="field-control"
                    @change="onTransferChange"
                  />
                  <div class="field-hint">{{ transferHint }}</div>
                </div>

                <div v-if="selectedMeta.masterHasQc" class="info-field">
                  <div class="field-label">本路线质检</div>
                  <a-select
                    v-if="!readonly"
                    :value="selectedMeta.qcOverride"
                    size="small"
                    class="field-control"
                    :options="routeQcOverrideOpts"
                    @change="onQcOverrideChange"
                  />
                  <div v-else class="field-value">
                    {{ formatRouteQcOverrideLabel(selectedMeta.qcOverride) }}
                  </div>
                  <div class="field-hint">{{ selectedQcOverrideHint }}</div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="right-empty">请点击网格中的工序</div>
        </div>

        <div class="right-panel panel-box file-config-panel">
          <div class="box-title">文件配置</div>
          <template v-if="selectedMeta">
            <a-form v-if="!readonly" layout="vertical" size="small" class="file-form">
              <a-form-item label="工艺文件">
                <a-select
                  :value="selectedMeta.processFileId"
                  allow-clear
                  show-search
                  size="small"
                  placeholder="请选择 工艺文件"
                  :options="docOpts"
                  :filter-option="filterDocOption"
                  @change="onDocChange"
                />
              </a-form-item>
            </a-form>
            <div v-else class="file-readonly-line">
              <span class="file-readonly-label">工艺文件：</span>
              <a
                v-if="selectedMeta.processFileId && selectedProcessFileName !== '—'"
                class="file-link"
                @click.prevent="openProcessDocDetail"
                >{{ selectedProcessFileName }}</a
              >
              <span v-else class="file-readonly-empty">—</span>
            </div>
          </template>
          <div v-else class="right-empty compact">请先选择工序</div>
        </div>
      </div>
    </div>

    <a-modal
      v-model:open="docDetailOpen"
      title="工艺文件详情"
      :footer="null"
      destroy-on-close
      width="480px"
    >
      <a-descriptions v-if="docDetail" bordered size="small" :column="1">
        <a-descriptions-item label="文件编号">{{ docDetail.code || '—' }}</a-descriptions-item>
        <a-descriptions-item label="文件名称">{{ docDetail.name || '—' }}</a-descriptions-item>
        <a-descriptions-item label="版本">{{ docDetail.version || '—' }}</a-descriptions-item>
        <a-descriptions-item label="分类">{{ docDetail.category || '—' }}</a-descriptions-item>
        <a-descriptions-item label="状态">{{ docDetail.status || '—' }}</a-descriptions-item>
      </a-descriptions>
      <a-empty v-else description="未找到该工艺文件" />
    </a-modal>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { CloseOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons-vue'
import {
  getActiveProcessCategories,
  getProcessesByCategory,
  getProcessById,
  PROCESS_GATE_OPTIONS,
  PROCESS_GATE_INHERIT,
} from '@/store/processConfigStore'
import { getEnabledProcessDocs, getProcessDocById } from '@/store/processDocStore'
import {
  deviceLabelById,
  equipmentState,
  formatDeviceLabel,
  listDevices,
} from '@/store/equipmentStore'
import { EQUIPMENT_CATEGORY_OPTIONS, EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
import EquipmentSearchSelect from '@/views/product-process/components/EquipmentSearchSelect.vue'
import {
  MAX_ROUTE_PARALLEL,
  MAX_ROUTE_STEPS,
  normalizeGrid,
  getSelectedCellMeta,
  insertStepAfter,
  insertRowAfter,
  removeStepAt,
  removeRowAt,
  syncStepPolicies,
  insertStepPolicyAfter,
  removeStepPolicyAt,
  countProcessesInStep,
  normalizeRouteQcOverride,
  normalizeCellReturns,
  normalizeCellEquipmentIds,
  normalizeRouteCell,
  formatCellReturn,
  formatRouteQcOverrideLabel,
  ROUTE_QC_OVERRIDE_OPTIONS,
  ROUTE_QC_INHERIT,
  ROUTE_QC_OFF,
} from '@/utils/processRouteGrid'

const equipmentCategoryOpts = EQUIPMENT_CATEGORY_OPTIONS

const props = defineProps({
  grid: { type: Array, default: () => [] },
  stepPolicies: { type: Array, default: () => [] },
  selectedStep: { type: Number, default: -1 },
  selectedRow: { type: Number, default: -1 },
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:grid',
  'update:stepPolicies',
  'update:selectedStep',
  'update:selectedRow',
])

const activeCategories = computed(() => getActiveProcessCategories())
const activeCategory = ref('')
const pendingProcessId = ref('')
const dragProcessId = ref('')
const leftWidth = ref(220)

/** 拖宽后磁贴列数：窄 3 列，加宽后 4 列，再宽 5 列 */
const galleryCols = computed(() => {
  if (leftWidth.value >= 320) return 5
  if (leftWidth.value >= 260) return 4
  return 3
})

const localGrid = ref(normalizeGrid(props.grid))
const localPolicies = ref(syncStepPolicies(props.grid, props.stepPolicies))

watch(
  activeCategories,
  (cats) => {
    if (!cats.length) {
      activeCategory.value = ''
      return
    }
    if (!cats.includes(activeCategory.value)) activeCategory.value = cats[0]
  },
  { immediate: true },
)

watch(
  () => props.grid,
  (v) => {
    localGrid.value = normalizeGrid(v)
    localPolicies.value = syncStepPolicies(v, props.stepPolicies)
  },
  { deep: true },
)

watch(
  () => props.stepPolicies,
  (v) => {
    localPolicies.value = syncStepPolicies(localGrid.value, v)
  },
  { deep: true },
)

const stepCount = computed(() => localGrid.value.length || 1)
const rowCount = computed(() => Math.max(1, localGrid.value[0]?.length || 1))

const currentProcesses = computed(() => getProcessesByCategory(activeCategory.value))

const docOpts = computed(() =>
  getEnabledProcessDocs().map((d) => ({
    label: d.name,
    value: d.id,
  })),
)

const selectedMeta = computed(() => {
  if (props.selectedStep < 0 || props.selectedRow < 0) return null
  return getSelectedCellMeta(localGrid.value, props.selectedStep, props.selectedRow)
})

const selectedStepPosText = computed(() => {
  const m = selectedMeta.value
  if (!m) return '—'
  return `第${m.stepNo}步，行号：${m.rowNo}，列号：${m.colNo}`
})

const selectedProcessFileName = computed(() => {
  const id = selectedMeta.value?.processFileId
  if (!id) return '—'
  return getProcessDocById(id)?.name || docOpts.value.find((d) => d.value === id)?.label || '—'
})

const routeQcOverrideOpts = ROUTE_QC_OVERRIDE_OPTIONS

const routeGateOpts = computed(() => {
  const current = selectedMeta.value?.defaultGateLabel || '记录 · 技术员判定'
  return [
    { value: PROCESS_GATE_INHERIT, label: `跟随工序默认（${current}）` },
    ...PROCESS_GATE_OPTIONS,
  ]
})

const gateHint = computed(() => {
  const meta = selectedMeta.value
  if (!meta) return ''
  if (meta.gateCustom) return `当前生效：${meta.effectiveGateLabel}，本路线特殊配置`
  return `当前生效：${meta.effectiveGateLabel}，来自工序默认`
})

const transferHint = computed(() => {
  const meta = selectedMeta.value
  if (!meta) return ''
  if (meta.transferCustom) return '当前生效为本路线单独填写的条件'
  return meta.defaultTransfer ? '当前显示工序默认，未单独设置' : '工序未填转移条件'
})

const selectedQcOverrideHint = computed(() => {
  const m = selectedMeta.value
  if (!m?.masterHasQc) return ''
  const mode = normalizeRouteQcOverride(m.qcOverride)
  if (mode === ROUTE_QC_OFF) return '本路线不生成该工序质检任务'
  return '沿用工序主数据的质检配置'
})

const docDetailOpen = ref(false)
const docDetail = ref(null)

function openProcessDocDetail() {
  const id = selectedMeta.value?.processFileId
  if (!id) {
    message.warning('未关联工艺文件')
    return
  }
  docDetail.value = getProcessDocById(id)
  if (!docDetail.value) {
    message.warning('未找到该工艺文件')
    return
  }
  docDetailOpen.value = true
}

function emitGrid() {
  emit('update:grid', normalizeGrid(localGrid.value))
}

function emitPolicies(next = localPolicies.value) {
  const synced = syncStepPolicies(localGrid.value, next)
  localPolicies.value = synced
  emit('update:stepPolicies', synced)
}

function isSelected(step, row) {
  return props.selectedStep === step && props.selectedRow === row
}

function hasCell(step, row) {
  return Boolean(localGrid.value[step]?.[row]?.processId)
}

function getCellProcess(step, row) {
  const cell = localGrid.value[step]?.[row]
  if (!cell?.processId) return null
  const proc = getProcessById(cell.processId)
  return proc ? { ...proc, processFileId: cell.processFileId } : { name: cell.processName }
}

function selectPendingProcess(proc) {
  pendingProcessId.value = proc.id
}

function onDragStart(proc, e) {
  dragProcessId.value = proc.id
  e.dataTransfer?.setData('text/plain', proc.id)
}

function placeProcess(step, row, processId) {
  if (props.readonly) return
  if (!processId) return
  if (step >= MAX_ROUTE_STEPS) {
    message.warning(`最大步数 ${MAX_ROUTE_STEPS}`)
    return
  }
  if (row >= MAX_ROUTE_PARALLEL) {
    message.warning(`最大并行数 ${MAX_ROUTE_PARALLEL}`)
    return
  }
  const proc = getProcessById(processId)
  if (!localGrid.value[step]) localGrid.value[step] = []
  const masterHasQc = Boolean(
    proc?.operations?.opQc ||
    (Array.isArray(proc?.qcConfigs) && proc.qcConfigs.some((c) => c?.enabled !== false)),
  )
  const prev = normalizeRouteCell(localGrid.value[step][row])
  const prevOverride = normalizeRouteQcOverride(prev?.qcOverride)
  const allowed = proc?.equipmentIds || []
  let equipmentIds = normalizeCellEquipmentIds(prev)
  let equipmentCategory = String(prev?.equipmentCategory || '').trim()
  if (allowed.length) {
    const allowSet = new Set(allowed)
    equipmentIds = equipmentIds.filter((id) => allowSet.has(id))
  }
  if (!equipmentIds.length && allowed.length === 1) equipmentIds = [allowed[0]]
  const next = normalizeRouteCell({
    processId,
    processName: proc?.name,
    processFileId: prev?.processFileId || '',
    equipmentCategory,
    equipmentIds,
    returns: Array.isArray(prev?.returns) ? prev.returns.map((item) => ({ ...item })) : [],
  })
  // 仅工序已配质检时保留「本路线不检」；否则清掉覆盖
  if (masterHasQc && prevOverride === ROUTE_QC_OFF) next.qcOverride = ROUTE_QC_OFF
  localGrid.value[step][row] = next
  emitGrid()
  normalizePoliciesForSparseSteps()
  emit('update:selectedStep', step)
  emit('update:selectedRow', row)
}

function onCellClick(step, row) {
  if (props.readonly) {
    emit('update:selectedStep', step)
    emit('update:selectedRow', row)
    return
  }
  if (pendingProcessId.value) {
    placeProcess(step, row, pendingProcessId.value)
    pendingProcessId.value = ''
    return
  }
  emit('update:selectedStep', step)
  emit('update:selectedRow', row)
}

function onCellDragOver(e) {
  if (props.readonly) return
  e.preventDefault()
}

function onDrop(step, row, e) {
  if (props.readonly) return
  const id = e.dataTransfer?.getData('text/plain') || dragProcessId.value
  placeProcess(step, row, id)
  dragProcessId.value = ''
}

function removeCell(step, row) {
  if (localGrid.value[step]) localGrid.value[step][row] = null
  emitGrid()
  normalizePoliciesForSparseSteps()
  if (isSelected(step, row)) {
    emit('update:selectedStep', -1)
    emit('update:selectedRow', -1)
  }
}

function normalizePoliciesForSparseSteps() {
  const next = syncStepPolicies(localGrid.value, localPolicies.value)
  next.forEach((p, i) => {
    if (countProcessesInStep(localGrid.value, i) < 2) {
      p.completionMode = 'all'
    }
  })
  emitPolicies(next)
}

function remapReturns(mapFn) {
  localGrid.value.forEach((step) => {
    ;(step || []).forEach((cell) => {
      if (!cell?.returns?.length) return
      cell.returns = cell.returns.map(mapFn).filter(Boolean)
    })
  })
}

function insertStepAt(afterIndex) {
  if (stepCount.value >= MAX_ROUTE_STEPS) {
    message.warning(`最大步数 ${MAX_ROUTE_STEPS}`)
    return
  }
  localPolicies.value = insertStepPolicyAfter(
    syncStepPolicies(localGrid.value, localPolicies.value),
    afterIndex,
  )
  remapReturns((item) => {
    const toStep = Number(item.toStep) > afterIndex + 1 ? Number(item.toStep) + 1 : item.toStep
    return { ...item, toStep }
  })
  localGrid.value = insertStepAfter(localGrid.value, afterIndex)
  if (props.selectedStep > afterIndex) {
    emit('update:selectedStep', props.selectedStep + 1)
  }
  emitGrid()
  emitPolicies(localPolicies.value)
}

function insertRowAt(afterIndex) {
  if (rowCount.value >= MAX_ROUTE_PARALLEL) {
    message.warning(`最大并行数 ${MAX_ROUTE_PARALLEL}`)
    return
  }
  remapReturns((item) => {
    const toRow = Number(item.toRow) > afterIndex + 1 ? Number(item.toRow) + 1 : item.toRow
    return { ...item, toRow }
  })
  localGrid.value = insertRowAfter(localGrid.value, afterIndex)
  if (props.selectedRow > afterIndex) {
    emit('update:selectedRow', props.selectedRow + 1)
  }
  emitGrid()
}

function stepHasProcess(stepIndex) {
  return (localGrid.value[stepIndex] || []).some((c) => c?.processId)
}

function rowHasProcess(rowIndex) {
  return localGrid.value.some((step) => step?.[rowIndex]?.processId)
}

function removeStepAtIndex(index) {
  if (stepCount.value <= 1) {
    message.warning('至少保留一步')
    return
  }
  const doRemove = () => {
    localPolicies.value = removeStepPolicyAt(
      syncStepPolicies(localGrid.value, localPolicies.value),
      index,
    )
    remapReturns((item) => {
      const toStep = Number(item.toStep)
      if (toStep === index + 1) return null
      if (toStep > index + 1) return { ...item, toStep: toStep - 1 }
      return item
    })
    localGrid.value = removeStepAt(localGrid.value, index)
    if (props.selectedStep === index) {
      emit('update:selectedStep', -1)
      emit('update:selectedRow', -1)
    } else if (props.selectedStep > index) {
      emit('update:selectedStep', props.selectedStep - 1)
    }
    emitGrid()
    emitPolicies(localPolicies.value)
  }
  if (stepHasProcess(index)) {
    Modal.confirm({
      title: '删除步骤',
      content: `第${index + 1}步已配置工序，确定删除？`,
      okType: 'danger',
      onOk: doRemove,
    })
    return
  }
  doRemove()
}

function removeRowAtIndex(index) {
  if (rowCount.value <= 1) {
    message.warning('至少保留一行')
    return
  }
  const doRemove = () => {
    remapReturns((item) => {
      const toRow = Number(item.toRow)
      if (toRow === index + 1) return null
      if (toRow > index + 1) return { ...item, toRow: toRow - 1 }
      return item
    })
    localGrid.value = removeRowAt(localGrid.value, index)
    if (props.selectedRow === index) {
      emit('update:selectedStep', -1)
      emit('update:selectedRow', -1)
    } else if (props.selectedRow > index) {
      emit('update:selectedRow', props.selectedRow - 1)
    }
    emitGrid()
  }
  if (rowHasProcess(index)) {
    Modal.confirm({
      title: '删除行',
      content: `第${index + 1}行已配置工序，确定删除？`,
      okType: 'danger',
      onOk: doRemove,
    })
    return
  }
  doRemove()
}

function cellEquipmentText(step, row) {
  const ids = normalizeCellEquipmentIds(localGrid.value[step]?.[row])
  if (!ids.length) return ''
  void equipmentState.devices
  const first = deviceLabelById(ids[0]) || ids[0]
  return ids.length > 1 ? `${first} +${ids.length - 1}` : first
}

function cellHasReturn(step, row) {
  return normalizeCellReturns(localGrid.value[step]?.[row]?.returns).some((item) => item.toStep)
}

const selectedEquipmentLabel = computed(() => {
  const ids = selectedMeta.value?.equipmentIds || []
  if (!ids.length) return '—'
  return ids.map((id) => deviceLabelById(id) || id).join('、')
})

const cellEquipmentAllowIds = computed(() => {
  void equipmentState.devices
  const proc = selectedMeta.value?.processId ? getProcessById(selectedMeta.value.processId) : null
  const category = selectedMeta.value?.equipmentCategory || ''
  let devices = listDevices().filter((device) => device.status !== EQUIPMENT_STATUS.SCRAPPED)
  if (proc?.equipmentIds?.length) {
    const allowSet = new Set(proc.equipmentIds)
    devices = devices.filter((device) => allowSet.has(device.id))
  }
  if (category) devices = devices.filter((device) => device.category === category)
  return devices.map((device) => device.id)
})

const cellEquipmentOptions = computed(() => {
  void equipmentState.devices
  const allowSet = new Set(cellEquipmentAllowIds.value || [])
  const options = listDevices()
    .filter((device) => device.status !== EQUIPMENT_STATUS.SCRAPPED)
    .filter((device) => allowSet.has(device.id))
    .map((device) => ({ value: device.id, label: formatDeviceLabel(device) }))
  ;(selectedMeta.value?.equipmentIds || []).forEach((id) => {
    if (id && !options.some((item) => item.value === id)) {
      options.unshift({ value: id, label: deviceLabelById(id) || id })
    }
  })
  return options
})

const returnTargetOptions = computed(() => {
  const options = []
  localGrid.value.forEach((step, stepIndex) => {
    ;(step || []).forEach((cell, rowIndex) => {
      if (!cell?.processId) return
      if (stepIndex === props.selectedStep && rowIndex === props.selectedRow) return
      const proc = getProcessById(cell.processId)
      options.push({
        value: `${stepIndex + 1}-${rowIndex + 1}`,
        label:
          `第${stepIndex + 1}列第${rowIndex + 1}行 ${proc?.name || cell.processName || ''}`.trim(),
      })
    })
  })
  return options
})

function returnValue(item) {
  if (!item?.toStep || !item?.toRow) return undefined
  return `${item.toStep}-${item.toRow}`
}

function formatReturnLine(item) {
  return formatCellReturn(localGrid.value, item)
}

function onEquipmentCategoryChange(value) {
  if (props.readonly) return
  patchSelectedCell((cell) => {
    cell.equipmentCategory = value || ''
    const next = normalizeRouteCell(cell)
    const allow = new Set(cellEquipmentAllowIdsFor(next))
    next.equipmentIds = (next.equipmentIds || []).filter((id) => allow.has(id))
    next.equipmentId = next.equipmentIds[0] || ''
    Object.assign(cell, next)
  })
}

function cellEquipmentAllowIdsFor(cell) {
  const proc = cell?.processId ? getProcessById(cell.processId) : null
  const category = cell?.equipmentCategory || ''
  let devices = listDevices().filter((device) => device.status !== EQUIPMENT_STATUS.SCRAPPED)
  if (proc?.equipmentIds?.length) {
    const allowSet = new Set(proc.equipmentIds)
    devices = devices.filter((device) => allowSet.has(device.id))
  }
  if (category) devices = devices.filter((device) => device.category === category)
  return devices.map((device) => device.id)
}

function onEquipmentChange(value) {
  if (props.readonly) return
  const ids = Array.isArray(value) ? value.filter(Boolean) : []
  patchSelectedCell((cell) => {
    cell.equipmentIds = [...ids]
    cell.equipmentId = ids[0] || ''
  })
}

function patchReturn(index, patch) {
  patchSelectedCell((cell) => {
    const returns = normalizeCellReturns(cell.returns)
    if (!returns[index]) return
    returns[index] = { ...returns[index], ...patch }
    cell.returns = returns
  })
}

function onReturnStream(index, value) {
  patchReturn(index, { stream: value })
}

function onReturnTarget(index, value) {
  const [toStep, toRow] = String(value || '')
    .split('-')
    .map((part) => Number(part))
  patchReturn(index, { toStep: toStep || 0, toRow: toRow || 0 })
}

function addReturn() {
  patchSelectedCell((cell) => {
    cell.returns = [...normalizeCellReturns(cell.returns), { stream: '', toStep: 0, toRow: 0 }]
  })
}

function removeReturn(index) {
  patchSelectedCell((cell) => {
    const returns = normalizeCellReturns(cell.returns)
    returns.splice(index, 1)
    cell.returns = returns
  })
}

function onDocChange(docId) {
  if (props.readonly) return
  const step = props.selectedStep
  const row = props.selectedRow
  const cell = localGrid.value[step]?.[row]
  if (!cell) return
  cell.processFileId = docId || ''
  emitGrid()
}

function patchSelectedCell(mutator) {
  const cell = localGrid.value[props.selectedStep]?.[props.selectedRow]
  if (!cell) return
  mutator(cell)
  emitGrid()
}

function onGateChange(value) {
  if (props.readonly) return
  patchSelectedCell((cell) => {
    if (!value || value === PROCESS_GATE_INHERIT) delete cell.gateMode
    else cell.gateMode = value
  })
}

function onTransferCustomChange(event) {
  if (props.readonly) return
  const checked = event?.target?.checked
  patchSelectedCell((cell) => {
    if (!checked) {
      delete cell.transferCustom
      delete cell.transferCondition
      return
    }
    cell.transferCustom = true
    cell.transferCondition = selectedMeta.value?.defaultTransfer || ''
  })
}

function onTransferChange(event) {
  if (props.readonly) return
  patchSelectedCell((cell) => {
    cell.transferCustom = true
    cell.transferCondition = event?.target?.value || ''
  })
}

function onQcOverrideChange(value) {
  if (props.readonly) return
  const step = props.selectedStep
  const row = props.selectedRow
  const cell = localGrid.value[step]?.[row]
  if (!cell) return
  const next = normalizeRouteQcOverride(value)
  if (next === ROUTE_QC_INHERIT) {
    delete cell.qcOverride
  } else {
    cell.qcOverride = next
  }
  emitGrid()
}

function filterDocOption(input, option) {
  const kw = String(input || '')
    .trim()
    .toLowerCase()
  if (!kw) return true
  return String(option?.label || '')
    .toLowerCase()
    .includes(kw)
}

function startResize(e) {
  const startX = e.clientX
  const startW = leftWidth.value
  const onMove = (ev) => {
    leftWidth.value = Math.min(360, Math.max(180, startW + (ev.clientX - startX)))
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
</script>

<style scoped>
.route-editor-layout {
  background: transparent;

  &.is-readonly {
    .editor-main {
      min-height: 360px;
    }

    .center-panel {
      margin-left: 0;
    }
  }
}

.grid-tip {
  padding: 10px 14px 0;
  font-size: 13px;
  line-height: 20px;
  color: #4e5969;
}

.editor-main {
  display: flex;
  align-items: stretch;
  min-height: 520px;
  gap: 0;
}

.panel-box {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  overflow: hidden;
}

.left-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 480px;
}

.resize-handle {
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  align-self: stretch;
  margin: 0 4px;
  border-radius: 3px;
  background: transparent;
}

.resize-handle:hover {
  background: #d7e8e5;
}

.box-title {
  padding: 12px 14px;
  font-weight: 600;
  font-size: 14px;
  line-height: 22px;
  color: #1f2329;
  background: transparent;
  border-bottom: 1px solid #e5e6eb;
}

.category-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  border-bottom: 1px solid #f0f0f0;
  max-height: 160px;
  overflow: auto;
}

.category-item {
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  color: #333;
  transition: background 0.2s;
}

.category-item:hover {
  background: #f5f5f5;
}

.category-item.active {
  background: #e7f2f0;
  color: #307068;
  font-weight: 500;
}

.process-gallery-box {
  flex: 1;
  overflow: auto;
  min-height: 200px;
}

.process-gallery {
  display: grid;
  gap: 8px;
  padding: 10px;
}

.process-tile {
  min-height: 52px;
  border: 1px solid #a9c6c2;
  border-radius: 4px;
  background: #e7f2f0;
  color: #307068;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 6px 4px;
  cursor: grab;
  user-select: none;
  line-height: 1.3;
}

.process-tile.active {
  border-color: #307068;
  box-shadow: 0 0 0 2px rgba(48, 112, 104, 0.25);
  font-weight: 600;
}

.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-left: 6px;
  margin-right: 10px;
}

.grid-area {
  flex: 1;
  overflow: auto;
  padding: 12px;
  min-height: 280px;
}

.grid-scroll {
  min-width: max-content;
}

.grid-header,
.grid-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.corner-cell {
  width: 36px;
  flex-shrink: 0;
}

.step-ctrl {
  width: 110px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 28px;
}

.step-ctrl-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
}

.row-ctrl {
  width: 36px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.ctrl-btn {
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  font-size: 12px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.ctrl-btn :deep(.anticon) {
  font-size: 12px;
  font-weight: 400;
}

.ctrl-plus {
  color: #307068;
}

.ctrl-minus {
  color: #ff4d4f;
}

.ctrl-btn:hover:not(:disabled) {
  opacity: 0.75;
}

.ctrl-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ctrl-label {
  font-size: 12px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  line-height: 1.2;
  text-align: center;
}

.grid-cell {
  width: 120px;
  height: 78px;
  border: 1px dashed #d9d9d9;
  border-radius: 4px;
  background: #fafafa;
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.grid-cell.filled {
  border-style: solid;
  border-color: #a9c6c2;
  background: #fff;
  padding: 4px;
}

.grid-cell.selected {
  border-color: #307068;
  box-shadow: inset 0 0 0 1px #307068;
}

.cell-tile {
  width: 100%;
  height: 100%;
  background: #e7f2f0;
  border: 1px solid #a9c6c2;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 4px;
  gap: 2px;
}

.cell-equip,
.cell-return {
  max-width: 100%;
  overflow: hidden;
  font-size: 10px;
  line-height: 1.2;
  color: #4e5969;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.cell-name {
  font-size: 12px;
  color: #307068;
  text-align: center;
  line-height: 1.2;
}

.cell-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 10px;
  color: #ff4d4f;
  z-index: 1;
}

.right-column {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 480px;
}

.right-panel {
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.right-panel:first-child {
  flex: 1;
  min-height: 0;
}

.file-config-panel {
  flex-shrink: 0;
}

.info-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.info-meta-card {
  padding: 12px 14px;
  background: #fafbfc;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  column-gap: 10px;
  align-items: start;
  font-size: 13px;
  line-height: 22px;
}

.info-row .k {
  color: #4e5969;
  flex-shrink: 0;
}

.info-row .v {
  color: #1f2329;
  min-width: 0;
  word-break: break-word;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.info-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
  line-height: 22px;
}

.info-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: #4e5969;
  line-height: 20px;
}

.field-control {
  width: 100%;
}

.field-value {
  font-size: 13px;
  line-height: 22px;
  color: #1f2329;
  word-break: break-word;
}

.field-hint {
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

.return-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #fafbfc;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
}

.return-stream {
  width: 88px;
  flex-shrink: 0;
}

.return-target {
  flex: 1;
  min-width: 140px;
}

.return-del {
  padding-inline: 0;
}

.return-add {
  align-self: flex-start;
}

.transfer-check {
  align-self: flex-start;
}

.file-form {
  padding: 4px 14px 14px;
}

.file-readonly-line {
  padding: 4px 14px 14px;
  font-size: 13px;
  line-height: 22px;
  color: rgba(0, 0, 0, 0.88);
}

.file-readonly-label {
  color: rgba(0, 0, 0, 0.65);
}

.file-readonly-empty {
  color: rgba(0, 0, 0, 0.45);
}

.file-link {
  color: #307068;
  cursor: pointer;
  word-break: break-all;

  &:hover {
    color: #4e8a82;
  }
}

.right-empty {
  color: #999;
  font-size: 13px;
  text-align: center;
  padding: 40px 16px;
}

.right-empty.compact {
  padding: 8px 12px 16px;
}
</style>
