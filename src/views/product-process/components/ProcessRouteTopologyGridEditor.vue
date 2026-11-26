<template>
  <div class="topo-grid-shell" :class="{ readonly }">
    <div class="route-editor-layout">
      <!-- 左：工序库，拖入画板格 -->
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
              @click="pendingProcessId = proc.id"
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

      <!-- 中：大画板 -->
      <div class="center-panel panel-box">
        <div class="box-title">{{ readonly ? '工艺路线' : '配置工艺路线' }}</div>
        <div v-if="!readonly" class="grid-tip">
          支线落在两个主线格之间；子支在父支右下、汇入最底。无汇合点时不默认汇入。×：先清工序再删格。
        </div>
        <div v-if="!readonly" class="board-toolbar">
          <a-space :size="8" wrap>
            <a-button size="small" type="primary" @click="addMain">添加主线格</a-button>
            <a-button size="small" @click="addBranch">添加支线节点</a-button>
            <a-button size="small" @click="addSink">添加汇合点</a-button>
            <a-button size="small" @click="relayout">重新排布</a-button>
            <a-divider type="vertical" />
            <span class="tool-label">连线</span>
            <a-radio-group v-model:value="linkMode" size="small" button-style="solid">
              <a-radio-button value="">选择</a-radio-button>
              <a-radio-button value="fork">设分出</a-radio-button>
              <a-radio-button value="join">设汇入</a-radio-button>
            </a-radio-group>
            <a-divider type="vertical" />
            <span class="tool-label">视图</span>
            <a-button size="small" title="缩小" @click="zoomOut">－</a-button>
            <span class="zoom-label">{{ zoomPercent }}%</span>
            <a-button size="small" title="放大" @click="zoomIn">＋</a-button>
            <a-button size="small" @click="resetView">复位</a-button>
          </a-space>
        </div>

        <div
          ref="areaRef"
          class="grid-area"
          :class="{ 'is-panning': isPanning }"
          @wheel.prevent="onCanvasWheel"
          @mousedown="onPanStart"
        >
          <div class="grid-viewport" :style="viewportStyle">
            <div class="grid-board" :style="boardStyle">
              <svg class="edge-layer" :width="boardPixelW" :height="boardPixelH" aria-hidden="true">
                <defs>
                  <marker
                    id="topo-grid-arrow-main"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill="#307068" />
                  </marker>
                  <marker
                    id="topo-grid-arrow-dash"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill="#86909c" />
                  </marker>
                  <marker
                    id="topo-grid-arrow-return"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill="#d46b08" />
                  </marker>
                </defs>
                <g v-for="edge in paintedEdges" :key="edge.id">
                  <path
                    :d="edge.d"
                    fill="none"
                    :stroke="edgeStroke(edge.kind)"
                    :stroke-width="edge.kind === 'main' ? 2.5 : 2"
                    :stroke-dasharray="edgeDash(edge.kind)"
                    :marker-end="edgeMarker(edge.kind)"
                  />
                  <text
                    v-if="edge.kind === 'return' && edge.label"
                    :x="edge.labelX"
                    :y="edge.labelY"
                    class="return-edge-label"
                  >
                    {{ edge.label }}
                  </text>
                </g>
              </svg>

              <div
                v-for="cell in laidOut"
                :key="cell.id"
                class="grid-cell"
                :class="[
                  cell.pathKind,
                  {
                    filled: Boolean(cell.processId),
                    selected: selectedId === cell.id,
                    'link-from': linkFromId === cell.id,
                  },
                ]"
                :style="cellStyle(cell)"
                @click="onCellClick(cell)"
                @dragover.prevent
                @drop="onDrop(cell, $event)"
              >
                <div class="cell-tag">{{ pathKindLabel(cell.pathKind) }}</div>
                <template v-if="cell.processId">
                  <div class="cell-name">{{ cell.name || '—' }}</div>
                  <div class="cell-meta">{{ equipmentShort(cell) }}</div>
                  <div v-if="(cell.returns || []).length" class="cell-meta">有回流</div>
                </template>
                <div v-else class="cell-placeholder">拖入工序</div>
                <!-- 有工序先清空；空格再删整格（主线/支线）；汇合点仅清空工序 -->
                <button
                  v-if="!readonly && (cell.pathKind === 'main' || cell.pathKind === 'branch')"
                  type="button"
                  class="cell-del"
                  :title="
                    cell.processId
                      ? '清空工序'
                      : cell.pathKind === 'branch'
                        ? '删除支线格'
                        : '删除主线格'
                  "
                  @click.stop="onDeleteClick(cell)"
                >
                  ×
                </button>
                <button
                  v-else-if="!readonly && cell.processId"
                  type="button"
                  class="cell-del"
                  title="清空工序"
                  @click.stop="clearProcess(cell.id)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右：工序信息 + 本格配置 + 文件 -->
      <div class="right-column">
        <div class="right-panel panel-box">
          <div class="box-title">工序信息</div>
          <template v-if="selected">
            <div class="info-body">
              <div class="info-meta-card">
                <div class="info-row">
                  <span class="k">工序名称</span>
                  <span class="v">{{ selectedProcess?.name || selected.name || '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="k">工序编号</span>
                  <span class="v">{{ selectedProcess?.code || '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="k">工序分类</span>
                  <span class="v">{{ selectedProcess?.category || '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="k">路径</span>
                  <span class="v">{{ pathKindLabel(selected.pathKind) }}</span>
                </div>
                <div class="info-row">
                  <span class="k">位置</span>
                  <span class="v"
                    >列 {{ selected.gridCol || '—' }}，行 {{ selected.gridRow || '—' }}</span
                  >
                </div>
                <div class="info-row">
                  <span class="k">操作说明</span>
                  <span class="v">{{ selectedProcess?.instruction || '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="k">调度策略</span>
                  <span class="v">手动调度</span>
                </div>
              </div>

              <div v-if="!readonly" class="info-section">
                <div class="info-section-title">路径与连线</div>
                <div class="info-field">
                  <div class="field-label">路径类型</div>
                  <a-select
                    :value="selected.pathKind"
                    size="small"
                    class="field-control"
                    :options="ROUTE_PATH_OPTIONS"
                    @change="onPathKindChange"
                  />
                </div>
                <div v-if="selected.pathKind === 'branch'" class="info-field">
                  <div class="field-label">支线名</div>
                  <a-input
                    :value="selected.branchName"
                    size="small"
                    class="field-control"
                    placeholder="如氟渣洗涤"
                    @change="(e) => patchSelected({ branchName: e.target.value })"
                  />
                </div>
                <div v-if="selected.pathKind === 'branch'" class="info-field">
                  <div class="field-label">分出节点</div>
                  <a-select
                    :value="selected.forkAfterNodeId || undefined"
                    allow-clear
                    size="small"
                    class="field-control"
                    :options="forkOptions(selected)"
                    placeholder="分出节点"
                    @change="onForkAfterChange"
                  />
                </div>
                <div
                  v-if="selected.pathKind === 'branch' || selected.pathKind === 'main'"
                  class="info-field"
                >
                  <div class="field-label">汇入节点</div>
                  <a-select
                    :value="selected.joinToNodeId || undefined"
                    allow-clear
                    size="small"
                    class="field-control"
                    :options="joinOptions(selected)"
                    :placeholder="selected.pathKind === 'main' ? '可选：汇入汇合点' : '汇入节点'"
                    @change="(v) => patchSelected({ joinToNodeId: v || null })"
                  />
                </div>
                <!-- 回流与路径连线同区，放在删除按钮上方便于先配回流再删格 -->
                <div class="info-field">
                  <div class="field-label">回流</div>
                  <div
                    v-for="(item, index) in selected.returns || []"
                    :key="`ret-${index}`"
                    class="return-line"
                  >
                    <template v-if="!readonly">
                      <a-input
                        :value="item.stream"
                        size="small"
                        placeholder="液、渣、母液"
                        class="return-stream"
                        @change="(e) => onReturnStream(index, e.target.value)"
                      />
                      <a-select
                        :value="item.toNodeId || undefined"
                        size="small"
                        show-search
                        option-filter-prop="label"
                        placeholder="回到哪一格"
                        :options="returnTargetOptions"
                        class="return-target"
                        @change="(v) => onReturnTarget(index, v)"
                      />
                      <a-button type="link" size="small" danger @click="removeReturn(index)"
                        >删除</a-button
                      >
                    </template>
                    <template v-else>{{ formatReturnLine(item) }}</template>
                  </div>
                  <a-button v-if="!readonly" size="small" class="return-add" @click="addReturn"
                    >添加回流</a-button
                  >
                  <div class="field-hint">渣、母液等要回到前面某一格时写在这里。</div>
                </div>
                <div
                  v-if="
                    !readonly && (selected.pathKind === 'main' || selected.pathKind === 'branch')
                  "
                  class="info-field"
                >
                  <a-button size="small" danger block @click="onDeleteClick(selected)">
                    {{
                      selected.processId
                        ? '清空工序'
                        : selected.pathKind === 'branch'
                          ? '删除支线格'
                          : '删除主线格'
                    }}
                  </a-button>
                </div>
              </div>

              <div class="info-section">
                <div class="info-section-title">本格配置</div>
                <div class="info-field">
                  <div class="field-label">设备分类</div>
                  <a-select
                    v-if="!readonly"
                    :value="selected.equipmentCategory || undefined"
                    allow-clear
                    show-search
                    size="small"
                    option-filter-prop="label"
                    placeholder="设备分类"
                    :options="equipmentCategoryOpts"
                    class="field-control"
                    @change="onEquipmentCategoryChange"
                  />
                  <div v-else class="field-value">{{ selected.equipmentCategory || '—' }}</div>
                </div>
                <div class="info-field">
                  <div class="field-label">候选设备</div>
                  <EquipmentSearchSelect
                    v-if="!readonly"
                    :model-value="selected.equipmentIds || []"
                    :multiple="true"
                    :options="cellEquipmentOptions"
                    :allow-ids="cellEquipmentAllowIds"
                    :category-filter="selected.equipmentCategory || ''"
                    placeholder="候选设备（可多选）"
                    :max-tag-count="2"
                    class="field-control"
                    @change="onEquipmentChange"
                  />
                  <div v-else class="field-value">{{ equipmentShort(selected) }}</div>
                  <div class="field-hint">
                    本路线该工序可用的候选设备，可多选；执行时再以产线设备为准。
                  </div>
                </div>

                <div class="info-field">
                  <div class="field-label">转移条件</div>
                  <a-checkbox
                    v-if="!readonly"
                    :checked="Boolean(selected.transferCustom)"
                    class="transfer-check"
                    @change="onTransferCustomChange"
                  >
                    本路线单独设置
                  </a-checkbox>
                  <a-textarea
                    :value="transferDraft"
                    size="small"
                    :rows="3"
                    :disabled="readonly || !selected.transferCustom"
                    placeholder="未填写"
                    class="field-control"
                    @change="onTransferChange"
                  />
                  <div class="field-hint">{{ transferHint }}</div>
                </div>

                <!-- 按化验方案逐行：门禁 + 本路线质检 -->
                <div class="info-field assay-override-block">
                  <div class="field-label">化验方案（本路线）</div>
                  <template v-if="assayOverrideRows.length">
                    <div
                      v-for="row in assayOverrideRows"
                      :key="row.qcConfigId"
                      class="assay-override-row"
                    >
                      <div class="assay-name">{{ row.scheme.name || row.qcConfigId }}</div>
                      <div class="assay-controls">
                        <div class="assay-ctrl">
                          <span class="assay-ctrl-label">质检</span>
                          <a-select
                            v-if="!readonly"
                            :value="row.qcOverride"
                            size="small"
                            class="assay-select"
                            :options="routeQcOverrideOpts"
                            @change="(v) => onAssayQcOverrideChange(row.qcConfigId, v)"
                          />
                          <span v-else class="field-value">{{
                            row.qcOverride === 'off' ? '本路线不检' : '继承工序'
                          }}</span>
                        </div>
                        <div class="assay-ctrl">
                          <span class="assay-ctrl-label">门禁</span>
                          <a-select
                            v-if="!readonly"
                            :value="row.gateMode"
                            size="small"
                            class="assay-select"
                            :options="routeAssayGateOptions(row.scheme.gateMode)"
                            :disabled="row.qcOverride === 'off'"
                            @change="(v) => onAssayGateChange(row.qcConfigId, v)"
                          />
                          <span v-else class="field-value">{{ formatAssayGateLabel(row) }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="field-hint">每个化验方案可单独设本路线是否质检与门禁。</div>
                  </template>
                  <div v-else-if="selected.processId" class="field-hint">该工序未配置化验方案</div>
                  <div v-else class="field-hint">请先拖入工序</div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="right-empty">请点击画板中的格子</div>
        </div>

        <div class="right-panel panel-box file-config-panel">
          <div class="box-title">文件配置</div>
          <template v-if="selected">
            <a-form v-if="!readonly" layout="vertical" size="small" class="file-form">
              <a-form-item label="工艺文件">
                <a-select
                  :value="selected.processFileId || undefined"
                  allow-clear
                  show-search
                  size="small"
                  placeholder="请选择 工艺文件"
                  :options="docOpts"
                  :filter-option="filterDocOption"
                  @change="(v) => patchSelected({ processFileId: v || '' })"
                />
              </a-form-item>
            </a-form>
            <div v-else class="file-readonly-line">工艺文件：{{ selectedProcessFileName }}</div>
          </template>
          <div v-else class="right-empty compact">请先选择格子</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default { name: 'ProcessRouteTopologyGridEditor' }
</script>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  ROUTE_PATH_OPTIONS,
  ROUTE_PATH_MAIN,
  ROUTE_PATH_BRANCH,
  ROUTE_PATH_SINK,
  createRouteNode,
  normalizeRouteNodes,
  autoLayoutTopologyGrid,
  buildTopologyGridEdges,
  removeRouteNode,
  countBranchesByForkMain,
  buildAssayOverrideRows,
  upsertAssayOverride,
  routeAssayGateOptions,
} from '@/utils/processRouteTopology'
import {
  getActiveProcessCategories,
  getProcessesByCategory,
  getProcessById,
  formatProcessGate,
} from '@/store/processConfigStore'
import { getEnabledProcessDocs, getProcessDocById } from '@/store/processDocStore'
import { EQUIPMENT_CATEGORY_OPTIONS, EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
import { equipmentState, formatDeviceLabel, listDevices } from '@/store/equipmentStore'
import { ROUTE_QC_OVERRIDE_OPTIONS } from '@/utils/processRouteGrid'
import EquipmentSearchSelect from './EquipmentSearchSelect.vue'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['update:nodes'])

/** 基准尺寸；实际格子/间距 = 基准 × zoom（内容缩放，不是画布 CSS scale） */
const BASE_CELL_W = 148
const BASE_CELL_H = 96
const BASE_GAP_X = 48
const BASE_EXTRA_GAP_X = 72
const BASE_GAP_Y = 40
const BASE_PAD = 28
/** 内容区至少预留的列/行（无格时也撑开） */
const MIN_COLS = 7
const MIN_ROWS = 4

const selectedId = ref('')
const linkMode = ref('')
const linkFromId = ref('')
const pendingProcessId = ref('')
const dragProcessId = ref('')
const leftWidth = ref(220)
const activeCategory = ref('')
const areaRef = ref(null)
const areaSize = ref({ w: 0, h: 0 })
let areaObserver = null

/** 内容缩放 + 平移（格子真实变大变小） */
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2
const ZOOM_STEP = 0.1
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
let panLast = { x: 0, y: 0 }

const cellW = computed(() => BASE_CELL_W * zoom.value)
const cellH = computed(() => BASE_CELL_H * zoom.value)
const gapX = computed(() => BASE_GAP_X * zoom.value)
const extraGapX = computed(() => BASE_EXTRA_GAP_X * zoom.value)
const gapY = computed(() => BASE_GAP_Y * zoom.value)
const pad = computed(() => BASE_PAD * zoom.value)

const zoomPercent = computed(() => Math.round(zoom.value * 100))
/** 仅平移；缩放靠改 cellW/cellH，不 scale 整块画布 */
const viewportStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px)`,
  transformOrigin: '0 0',
  willChange: 'transform',
}))

function clampZoom(z) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(z.toFixed(2))))
}

function zoomIn() {
  zoom.value = clampZoom(zoom.value + ZOOM_STEP)
}

function zoomOut() {
  zoom.value = clampZoom(zoom.value - ZOOM_STEP)
}

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

/** 滚轮：放大/缩小格子尺寸，指针下内容锚点尽量不动 */
function onCanvasWheel(e) {
  const rect = areaRef.value?.getBoundingClientRect()
  if (!rect) return
  const old = zoom.value
  const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1
  const next = clampZoom(old * factor)
  if (next === old) return
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  const contentX = cx - panX.value
  const contentY = cy - panY.value
  const ratio = next / old
  zoom.value = next
  panX.value = cx - contentX * ratio
  panY.value = cy - contentY * ratio
}

/** 空白处拖拽平移（点在格子上不触发，避免和点选冲突） */
function onPanStart(e) {
  if (e.button !== 0) return
  if (e.target?.closest?.('.grid-cell')) return
  isPanning.value = true
  panLast = { x: e.clientX, y: e.clientY }
  window.addEventListener('mousemove', onPanMove)
  window.addEventListener('mouseup', onPanEnd)
}

function onPanMove(e) {
  if (!isPanning.value) return
  panX.value += e.clientX - panLast.x
  panY.value += e.clientY - panLast.y
  panLast = { x: e.clientX, y: e.clientY }
}

function onPanEnd() {
  isPanning.value = false
  window.removeEventListener('mousemove', onPanMove)
  window.removeEventListener('mouseup', onPanEnd)
}

const activeCategories = computed(() => getActiveProcessCategories())
const galleryCols = computed(() => {
  if (leftWidth.value >= 320) return 5
  if (leftWidth.value >= 260) return 4
  return 3
})
const currentProcesses = computed(() => getProcessesByCategory(activeCategory.value))

watch(
  activeCategories,
  (cats) => {
    if (!cats.length) return
    if (!cats.includes(activeCategory.value)) activeCategory.value = cats[0]
  },
  { immediate: true },
)

const laidOut = computed(() => autoLayoutTopologyGrid(props.nodes || []))
const selected = computed(() => laidOut.value.find((n) => n.id === selectedId.value) || null)
const selectedProcess = computed(() =>
  selected.value?.processId ? getProcessById(selected.value.processId) : null,
)

const edgePack = computed(() => buildTopologyGridEdges(props.nodes || []))
const maxCol = computed(() => Math.max(MIN_COLS, ...laidOut.value.map((n) => n.gridCol || 1), 1))
const maxRow = computed(() => Math.max(MIN_ROWS, ...laidOut.value.map((n) => n.gridRow || 1), 1))
/** 各主线下支线数量，用于列间距加宽 */
const branchCountByFork = computed(() => countBranchesByForkMain(laidOut.value))

/**
 * 列间距：主线块内已用多列承载并行支线/错位子节点；
 * 仅在「该列是某主线所在列且并行支线≥2」时略加宽，避免主线箭头视觉过挤。
 */
function gapAfterCol(col) {
  const main = laidOut.value.find(
    (n) => n.pathKind === ROUTE_PATH_MAIN && Number(n.gridCol) === Number(col),
  )
  if (!main) return gapX.value
  const n = branchCountByFork.value.get(main.id) || 0
  if (n <= 1) return gapX.value
  return gapX.value + Math.min(n - 1, 2) * (extraGapX.value / 2)
}

function colLeftX(col) {
  let x = pad.value
  for (let c = 1; c < col; c += 1) {
    x += cellW.value + gapAfterCol(c)
  }
  return x
}

const contentW = computed(() => {
  const cols = maxCol.value
  let w = pad.value * 2
  for (let c = 1; c <= cols; c += 1) {
    w += cellW.value
    if (c < cols) w += gapAfterCol(c)
  }
  return w
})
const contentH = computed(
  () => pad.value * 2 + maxRow.value * cellH.value + (maxRow.value - 1) * gapY.value,
)
/** 内容区随 zoom 变大；格子少时也至少有一块可拖区域 */
const boardPixelW = computed(() =>
  Math.max(contentW.value, areaSize.value.w || 0, 720 * zoom.value),
)
const boardPixelH = computed(() =>
  Math.max(contentH.value, areaSize.value.h || 0, 420 * zoom.value),
)
const boardStyle = computed(() => ({
  width: `${boardPixelW.value}px`,
  height: `${boardPixelH.value}px`,
  // 格子内字号随内容缩放
  '--topo-zoom': String(zoom.value),
}))

function cellOrigin(col, row) {
  return {
    x: colLeftX(col || 1),
    y: pad.value + ((row || 1) - 1) * (cellH.value + gapY.value),
  }
}

function cellStyle(cell) {
  const { x, y } = cellOrigin(cell.gridCol || 1, cell.gridRow || 1)
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${cellW.value}px`,
    height: `${cellH.value}px`,
  }
}

function cellCenter(id) {
  const n = laidOut.value.find((x) => x.id === id)
  if (!n) return null
  const { x, y } = cellOrigin(n.gridCol || 1, n.gridRow || 1)
  return { x: x + cellW.value / 2, y: y + cellH.value / 2 }
}

/**
 * 汇入线走「汇合点上方总线」；回流走格子右侧外轨，与主线/汇入区分。
 */
function buildEdgePath(e, from, to, laneIndex) {
  const cw = cellW.value
  const ch = cellH.value
  const gy = gapY.value
  const fromBottom = from.y + ch / 2 - 6
  const toTop = to.y - ch / 2 + 6
  if (e.kind === 'main') {
    return {
      d: `M ${from.x + cw / 2 - 6} ${from.y} L ${to.x - cw / 2 + 6} ${to.y}`,
    }
  }
  if (e.kind === 'fork' && Math.abs(from.x - to.x) < 8) {
    return { d: `M ${from.x} ${fromBottom} L ${to.x} ${toTop}` }
  }
  if (e.kind === 'branch-chain') {
    if (Math.abs(from.x - to.x) < 8) {
      return { d: `M ${from.x} ${fromBottom} L ${to.x} ${toTop}` }
    }
    const elbowY = from.y + ch / 2 + Math.max(12, gy / 3)
    return {
      d: `M ${from.x} ${fromBottom} L ${from.x} ${elbowY} L ${to.x} ${elbowY} L ${to.x} ${toTop}`,
    }
  }
  if (e.kind === 'join') {
    const sinkTop = to.y - ch / 2
    const busY = sinkTop - Math.max(14, gy / 3) - (laneIndex % 4) * 6
    if (Math.abs(from.x - to.x) < 8) {
      return { d: `M ${from.x} ${fromBottom} L ${to.x} ${toTop}` }
    }
    return {
      d: `M ${from.x} ${fromBottom} L ${from.x} ${busY} L ${to.x} ${busY} L ${to.x} ${toTop}`,
    }
  }
  if (e.kind === 'return') {
    // 回流：从右侧外轨绕回目标，避免与主流程线重叠
    const fromRight = from.x + cw / 2 - 4
    const toRight = to.x + cw / 2 - 4
    const railX = Math.max(fromRight, toRight) + 28 * zoom.value + (laneIndex % 5) * 14 * zoom.value
    const labelX = railX + 4
    const labelY = (from.y + to.y) / 2
    return {
      d: `M ${fromRight} ${from.y} L ${railX} ${from.y} L ${railX} ${to.y} L ${toRight} ${to.y}`,
      labelX,
      labelY,
    }
  }
  const midY = (from.y + to.y) / 2
  return {
    d: `M ${from.x} ${fromBottom} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${toTop}`,
  }
}

function edgeStroke(kind) {
  if (kind === 'main' || kind === 'branch-chain') return '#307068'
  if (kind === 'return') return '#d46b08'
  return '#86909c'
}

function edgeDash(kind) {
  if (kind === 'main' || kind === 'branch-chain') return undefined
  if (kind === 'return') return '5 4'
  return '6 4'
}

function edgeMarker(kind) {
  if (kind === 'main' || kind === 'branch-chain') return 'url(#topo-grid-arrow-main)'
  if (kind === 'return') return 'url(#topo-grid-arrow-return)'
  return 'url(#topo-grid-arrow-dash)'
}

const paintedEdges = computed(() => {
  const edges = edgePack.value.edges || []
  let joinLane = 0
  let returnLane = 0
  return edges
    .map((e) => {
      const from = cellCenter(e.fromId)
      const to = cellCenter(e.toId)
      if (!from || !to) return null
      const lane = e.kind === 'join' ? joinLane++ : e.kind === 'return' ? returnLane++ : 0
      const path = buildEdgePath(e, from, to, lane)
      return { ...e, ...path }
    })
    .filter(Boolean)
})

const equipmentCategoryOpts = EQUIPMENT_CATEGORY_OPTIONS
const routeQcOverrideOpts = ROUTE_QC_OVERRIDE_OPTIONS

/** 当前格：按工序化验方案展开的本路线覆盖行 */
const assayOverrideRows = computed(() =>
  buildAssayOverrideRows(selectedProcess.value, selected.value || {}),
)

const transferDraft = computed(() => {
  if (selected.value?.transferCustom) return selected.value.transferCondition || ''
  return selectedProcess.value?.transferCondition || ''
})

const transferHint = computed(() => {
  if (selected.value?.transferCustom) return '本路线单独设置转移条件'
  return selectedProcess.value?.transferCondition
    ? '当前显示工序默认，未单独设置'
    : '工序未填转移条件'
})

const docOpts = computed(() =>
  (getEnabledProcessDocs() || []).map((d) => ({
    value: d.id,
    label: `${d.code || ''} ${d.name || ''}`.trim(),
  })),
)

const selectedProcessFileName = computed(() => {
  const id = selected.value?.processFileId
  if (!id) return '—'
  const doc = getProcessDocById(id)
  return doc ? `${doc.code || ''} ${doc.name || ''}`.trim() : '—'
})

const cellEquipmentOptions = computed(() => {
  void equipmentState.devices
  const cat = selected.value?.equipmentCategory || ''
  return listDevices({ category: cat || undefined }).filter(
    (d) => d.status !== EQUIPMENT_STATUS.SCRAPPED,
  )
})

const cellEquipmentAllowIds = computed(() => cellEquipmentOptions.value.map((d) => d.id))

const returnTargetOptions = computed(() =>
  laidOut.value
    .filter((n) => n.id !== selectedId.value && n.processId)
    .map((n) => ({
      value: n.id,
      label: `${n.name || n.id}（列${n.gridCol}/行${n.gridRow}）`,
    })),
)

function pathKindLabel(kind) {
  if (kind === ROUTE_PATH_BRANCH) return '支线'
  if (kind === ROUTE_PATH_SINK) return '汇合'
  return '主线'
}

function equipmentShort(cell) {
  const ids = cell?.equipmentIds || []
  if (!ids.length) return '—'
  const label = formatDeviceLabel(ids[0]) || ids[0]
  return ids.length > 1 ? `${label} 等${ids.length}台` : label
}

function formatReturnLine(item) {
  const target = laidOut.value.find((n) => n.id === item.toNodeId)
  return `${item.stream || '—'} → ${target?.name || item.toNodeId || '—'}`
}

/** 分出可选：主线 / 支线 / 汇合点（支线再分出时选上级支线） */
function forkOptions(record) {
  return laidOut.value
    .filter((n) => n.id !== record.id)
    .map((n) => ({
      value: n.id,
      label: `${n.name || `空格(${n.gridCol},${n.gridRow})`}（${pathKindLabel(n.pathKind)}）`,
    }))
}

/** 汇入优先汇合点；无汇合点时仍可选其它格，但不自动默认主线 */
function joinOptions(record) {
  return laidOut.value
    .filter((n) => n.id !== record.id)
    .map((n) => ({
      value: n.id,
      label: `${n.name || `空格(${n.gridCol},${n.gridRow})`}（${pathKindLabel(n.pathKind)}）`,
    }))
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

function commit(list) {
  emit('update:nodes', autoLayoutTopologyGrid(normalizeRouteNodes(list || laidOut.value)))
}

function patchSelected(partial) {
  if (!selectedId.value) return
  commit(laidOut.value.map((n) => (n.id === selectedId.value ? { ...n, ...partial } : { ...n })))
}

function applyProcessToCell(cellId, processId) {
  const proc = getProcessById(processId)
  if (!proc) return
  commit(
    laidOut.value.map((n) => {
      if (n.id !== cellId) return { ...n }
      return {
        ...n,
        processId: proc.id,
        name: proc.name || '',
        equipmentIds:
          Array.isArray(proc.equipmentIds) && proc.equipmentIds.length
            ? [...proc.equipmentIds]
            : n.equipmentIds || [],
        equipmentCategory: n.equipmentCategory || '',
        // 换工序后清空旧方案覆盖，避免串到其它工序的 qcConfigId
        assayOverrides: [],
        gateCustom: false,
        gateMode: '',
        qcOverride: 'inherit',
      }
    }),
  )
  selectedId.value = cellId
}

function onDragStart(proc, event) {
  dragProcessId.value = proc.id
  pendingProcessId.value = proc.id
  event.dataTransfer?.setData('text/plain', proc.id)
  event.dataTransfer.effectAllowed = 'copy'
}

function onDrop(cell, event) {
  event.preventDefault()
  const id = event.dataTransfer?.getData('text/plain') || dragProcessId.value
  if (!id || props.readonly) return
  applyProcessToCell(cell.id, id)
  dragProcessId.value = ''
}

function onCellClick(cell) {
  if (props.readonly) {
    selectedId.value = cell.id
    return
  }
  if (linkMode.value === 'fork' || linkMode.value === 'join') {
    if (!linkFromId.value) {
      // 设分出：起点须是支线；设汇入：起点可以是支线或主线
      const canStartFork = linkMode.value === 'fork' && cell.pathKind === ROUTE_PATH_BRANCH
      const canStartJoin =
        linkMode.value === 'join' &&
        (cell.pathKind === ROUTE_PATH_BRANCH || cell.pathKind === ROUTE_PATH_MAIN)
      if (!canStartFork && !canStartJoin) {
        selectedId.value = cell.id
        return
      }
      linkFromId.value = cell.id
      selectedId.value = cell.id
      return
    }
    const list = laidOut.value.map((n) => ({ ...n }))
    const source = list.find((n) => n.id === linkFromId.value)
    if (source && cell.id !== source.id) {
      if (linkMode.value === 'fork') source.forkAfterNodeId = cell.id
      else source.joinToNodeId = cell.id
      commit(list)
    }
    linkFromId.value = ''
    return
  }
  // 点选工序后点空格放入
  if (pendingProcessId.value && !cell.processId) {
    applyProcessToCell(cell.id, pendingProcessId.value)
    return
  }
  selectedId.value = cell.id
}

function onPathKindChange(pathKind) {
  const patch = { pathKind }
  if (pathKind !== ROUTE_PATH_BRANCH) {
    // 主控关支线：清空仅支线字段；主线仍可保留汇入
    patch.branchName = ''
    patch.branchLineId = ''
    patch.forkAfterNodeId = null
  }
  if (pathKind === ROUTE_PATH_SINK) {
    // 汇合点不设汇入
    patch.joinToNodeId = null
  }
  if (pathKind !== ROUTE_PATH_SINK) patch.joinMode = ''
  else patch.joinMode = selected.value?.joinMode || 'all'
  patchSelected(patch)
}

function onEquipmentCategoryChange(val) {
  patchSelected({ equipmentCategory: val || '', equipmentIds: [] })
}

function onEquipmentChange(ids) {
  patchSelected({ equipmentIds: Array.isArray(ids) ? ids : [] })
}

function addReturn() {
  const returns = [...(selected.value?.returns || []), { stream: '', toNodeId: '' }]
  patchSelected({ returns })
}

function removeReturn(index) {
  const returns = [...(selected.value?.returns || [])]
  returns.splice(index, 1)
  patchSelected({ returns })
}

function onReturnStream(index, stream) {
  const returns = [...(selected.value?.returns || [])]
  if (!returns[index]) return
  returns[index] = { ...returns[index], stream }
  patchSelected({ returns })
}

function onReturnTarget(index, toNodeId) {
  const returns = [...(selected.value?.returns || [])]
  if (!returns[index]) return
  returns[index] = { ...returns[index], toNodeId: toNodeId || '' }
  patchSelected({ returns })
}

/** 只读展示某方案行门禁 */
function formatAssayGateLabel(row) {
  if (row.qcOverride === 'off') return '—'
  if (row.gateMode === 'inherit') {
    return `跟随方案（${formatProcessGate(row.scheme?.gateMode) || '—'}）`
  }
  return formatProcessGate(row.gateMode) || row.gateMode || '—'
}

/** 改某方案本路线质检；不检时清空该行门禁覆盖 */
function onAssayQcOverrideChange(qcConfigId, qcOverride) {
  const next = upsertAssayOverride(selected.value?.assayOverrides, qcConfigId, {
    qcOverride: qcOverride === 'off' ? 'off' : 'inherit',
    ...(qcOverride === 'off' ? { gateMode: 'inherit' } : {}),
  })
  // 写过方案覆盖后，整格旧字段不再作为真源
  patchSelected({
    assayOverrides: next,
    gateCustom: false,
    gateMode: '',
    qcOverride: 'inherit',
  })
}

/** 改某方案本路线门禁 */
function onAssayGateChange(qcConfigId, gateMode) {
  const next = upsertAssayOverride(selected.value?.assayOverrides, qcConfigId, {
    gateMode: gateMode || 'inherit',
    qcOverride: 'inherit',
  })
  patchSelected({
    assayOverrides: next,
    gateCustom: false,
    gateMode: '',
    qcOverride: 'inherit',
  })
}

function onTransferCustomChange(e) {
  const checked = Boolean(e?.target?.checked)
  if (!checked) {
    patchSelected({ transferCustom: false, transferCondition: '' })
  } else {
    patchSelected({
      transferCustom: true,
      transferCondition:
        selected.value?.transferCondition || selectedProcess.value?.transferCondition || '',
    })
  }
}

function onTransferChange(e) {
  patchSelected({ transferCondition: e?.target?.value || '' })
}

function addMain() {
  const list = [...laidOut.value]
  const col =
    Math.max(0, ...list.filter((n) => n.pathKind === ROUTE_PATH_MAIN).map((n) => n.gridCol || 0)) +
    1
  const node = createRouteNode({
    pathKind: ROUTE_PATH_MAIN,
    gridCol: col,
    gridRow: 1,
  })
  list.push(node)
  commit(list)
  selectedId.value = node.id
}

/**
 * 新增支线节点：
 * - 选中主线：新开一条并行支线（分出=该主线）
 * - 选中支线：再分出下级支线（分出=该支线，新 branchLineId；右下错位；默认同汇入）
 */
function addBranch() {
  const list = [...laidOut.value]
  const sel = selected.value
  const sinks = list.filter((n) => n.pathKind === ROUTE_PATH_SINK)

  let forkId = null
  let joinToNodeId = null
  let hintCol = 1
  let hintRow = 2

  if (sel?.pathKind === ROUTE_PATH_MAIN) {
    forkId = sel.id
    // 无汇合点时不默认把主线当成汇入
    joinToNodeId = sinks[0]?.id || null
    hintCol = (Number(sel.gridCol) || 1) + 1
    hintRow = 2
  } else if (sel?.pathKind === ROUTE_PATH_BRANCH) {
    // 分出节点必须是当前支线，而不是它的上游主线
    forkId = sel.id
    // 仅继承已有汇入，或画布上已有的汇合点；绝不回落到主线
    const parentJoinIsSink =
      sel.joinToNodeId &&
      list.some((n) => n.id === sel.joinToNodeId && n.pathKind === ROUTE_PATH_SINK)
    joinToNodeId = (parentJoinIsSink ? sel.joinToNodeId : null) || sinks[0]?.id || null
    hintCol = (Number(sel.gridCol) || 1) + 1
    hintRow = (Number(sel.gridRow) || 2) + 1
  } else {
    message.warning('请先选择主线格或支线格，再添加支线节点')
    return
  }

  // 不传 branchLineId → 新开一条支线线，汇合线从该线首格单独画出
  const node = createRouteNode({
    pathKind: ROUTE_PATH_BRANCH,
    forkAfterNodeId: forkId,
    joinToNodeId,
    gridCol: hintCol,
    gridRow: hintRow,
  })
  commit([...list, node])
  selectedId.value = node.id
}

function addSink() {
  const node = createRouteNode({
    pathKind: ROUTE_PATH_SINK,
    name: '压滤',
    joinMode: 'all',
    gridCol: Math.max(1, Math.ceil(maxCol.value / 2)),
    gridRow: maxRow.value + 1,
  })
  commit([...laidOut.value, node])
  selectedId.value = node.id
}

function relayout() {
  commit(autoLayoutTopologyGrid(laidOut.value, { force: true }))
}

function clearProcess(id) {
  commit(
    laidOut.value.map((n) =>
      n.id === id
        ? {
            ...n,
            processId: '',
            name: '',
            equipmentIds: [],
            returns: [],
            processFileId: '',
            gateCustom: false,
            gateMode: '',
            transferCustom: false,
            transferCondition: '',
            qcOverride: 'inherit',
            assayOverrides: [],
          }
        : n,
    ),
  )
}

/**
 * 删除两段式：有工序 → 只清空工序；空格 → 再删整格。
 */
function onDeleteClick(cell) {
  if (!cell || props.readonly) return
  if (cell.processId) {
    clearProcess(cell.id)
    message.success('已清空工序')
    return
  }
  removeCell(cell.id)
}

/**
 * 删除主线/支线空格：清掉分出/汇入/回流引用；主线删除后列序压紧。
 */
function removeCell(id) {
  if (!id || props.readonly) return
  const target = laidOut.value.find((n) => n.id === id)
  if (!target || (target.pathKind !== ROUTE_PATH_MAIN && target.pathKind !== ROUTE_PATH_BRANCH)) {
    return
  }
  // 至少保留 1 个主线格，避免画布被删空后无法继续配置
  if (target.pathKind === ROUTE_PATH_MAIN) {
    const mainCount = laidOut.value.filter((n) => n.pathKind === ROUTE_PATH_MAIN).length
    if (mainCount <= 1) {
      message.warning('至少保留一个主线格')
      return
    }
  }
  const next = removeRouteNode(laidOut.value, id)
  emit('update:nodes', next)
  if (selectedId.value === id) selectedId.value = next[0]?.id || ''
  if (linkFromId.value === id) linkFromId.value = ''
  message.success(target.pathKind === ROUTE_PATH_BRANCH ? '已删除支线格' : '已删除主线格')
}

/**
 * 改分出节点：跟到新分出点右下；若分出是支线，则独立成线（branchLineId=自身），才能单独画汇合线。
 */
function onForkAfterChange(v) {
  const forkId = v || null
  const patch = { forkAfterNodeId: forkId }
  const fork = laidOut.value.find((n) => n.id === forkId)
  if (fork?.pathKind === ROUTE_PATH_BRANCH && selected.value?.id) {
    // 从支线再分出必须是新支线线，不能沿用上游的 branchLineId
    patch.branchLineId = selected.value.id
  }
  patchSelected(patch)
}

function startResize(event) {
  const startX = event.clientX
  const startW = leftWidth.value
  const onMove = (e) => {
    leftWidth.value = Math.min(400, Math.max(180, startW + (e.clientX - startX)))
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

watch(linkMode, () => {
  linkFromId.value = ''
})

// 默认选中第一格，方便右侧展示
watch(
  laidOut,
  (list) => {
    if (!list.length) {
      selectedId.value = ''
      return
    }
    if (!list.some((n) => n.id === selectedId.value)) {
      selectedId.value = list[0].id
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (!areaRef.value || typeof ResizeObserver === 'undefined') return
  areaObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    const { width, height } = entry.contentRect
    areaSize.value = { w: Math.floor(width), h: Math.floor(height) }
  })
  areaObserver.observe(areaRef.value)
})

onBeforeUnmount(() => {
  areaObserver?.disconnect()
  areaObserver = null
  onPanEnd()
})
</script>

<style scoped lang="less">
.topo-grid-shell {
  width: 100%;
  height: min(72vh, 760px);
}

.route-editor-layout {
  display: flex;
  align-items: stretch;
  gap: 0;
  width: 100%;
  height: 100%;
  min-height: 560px;
}

.panel-box {
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.box-title {
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  border-bottom: 1px solid #e5e6eb;
}

.left-panel {
  flex-shrink: 0;
  min-height: 0;
  height: 100%;
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

.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  margin-left: 6px;
  margin-right: 10px;
  height: 100%;
}

.grid-tip {
  margin: 0;
  padding: 8px 12px 0;
  font-size: 12px;
  color: #86909c;
}

.board-toolbar {
  padding: 8px 12px;
}

.tool-label {
  font-size: 13px;
  color: #4e5969;
}

.zoom-label {
  min-width: 44px;
  text-align: center;
  font-size: 12px;
  color: #4e5969;
}

.grid-area {
  flex: 1;
  overflow: hidden;
  padding: 8px 12px 12px;
  min-height: 0;
  cursor: grab;
  user-select: none;
}

.grid-area.is-panning {
  cursor: grabbing;
}

.grid-viewport {
  position: relative;
  width: max-content;
  height: max-content;
}

.grid-board {
  position: relative;
  box-sizing: border-box;
  background: #f7f8fa;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.return-edge-label {
  fill: #d46b08;
  font-size: calc(11px * var(--topo-zoom, 1));
  pointer-events: none;
}

.edge-layer {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  pointer-events: none;
}

.grid-cell {
  position: absolute;
  z-index: 1;
  box-sizing: border-box;
  padding: calc(8px * var(--topo-zoom, 1));
  background: #fff;
  border: 1px dashed #c9cdd4;
  border-radius: calc(8px * var(--topo-zoom, 1));
  cursor: pointer;
}

.grid-cell.filled {
  border-style: solid;
  border-color: #a9c6c2;
}

.grid-cell.main.filled {
  border-color: #307068;
}

.grid-cell.sink {
  background: #fffbe6;
  border-color: #d48806;
}

.grid-cell.selected {
  box-shadow: inset 0 0 0 2px #307068;
}

.grid-cell.link-from {
  box-shadow: inset 0 0 0 2px #d48806;
}

.cell-tag {
  display: inline-block;
  margin-bottom: calc(4px * var(--topo-zoom, 1));
  padding: 0 calc(6px * var(--topo-zoom, 1));
  border-radius: 4px;
  background: #e5e6eb;
  color: #4e5969;
  font-size: calc(11px * var(--topo-zoom, 1));
}

.grid-cell.main .cell-tag {
  background: #e7f3f1;
  color: #307068;
}

.cell-name {
  font-size: calc(13px * var(--topo-zoom, 1));
  font-weight: 600;
  color: #307068;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-meta {
  margin-top: 2px;
  font-size: calc(11px * var(--topo-zoom, 1));
  color: #86909c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-placeholder {
  margin-top: calc(12px * var(--topo-zoom, 1));
  text-align: center;
  font-size: calc(12px * var(--topo-zoom, 1));
  color: #c9cdd4;
}

.cell-del {
  position: absolute;
  top: 2px;
  right: 4px;
  border: none;
  background: transparent;
  color: #ff4d4f;
  cursor: pointer;
}

.right-column {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
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
  font-size: 13px;
  line-height: 22px;
}

.info-row .k {
  color: #4e5969;
}

.info-row .v {
  color: #1f2329;
  word-break: break-word;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}

.info-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  color: #1f2329;
}

.field-control {
  width: 100%;
}

.field-hint {
  font-size: 12px;
  color: #86909c;
  line-height: 18px;
}

.field-value {
  font-size: 13px;
  color: #1f2329;
}

.return-line {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}

.return-stream {
  width: 88px;
}

.return-target {
  flex: 1;
  min-width: 0;
}

.return-add {
  align-self: flex-start;
}

.assay-override-block {
  margin-top: 4px;
}

.assay-override-row {
  margin-bottom: 10px;
  padding: 8px 10px;
  background: #fafafa;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
}

.assay-name {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}

.assay-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.assay-ctrl {
  display: flex;
  align-items: center;
  gap: 8px;
}

.assay-ctrl-label {
  width: 36px;
  flex-shrink: 0;
  font-size: 12px;
  color: #4e5969;
}

.assay-select {
  flex: 1;
  min-width: 0;
}

.transfer-check {
  margin-bottom: 4px;
}

.right-empty {
  padding: 24px 12px;
  text-align: center;
  color: #86909c;
  font-size: 13px;
}

.right-empty.compact {
  padding: 12px;
}

.file-form {
  padding: 12px 14px 4px;
}

.file-readonly-line {
  padding: 12px 14px;
  font-size: 13px;
  color: #1f2329;
}

.readonly .grid-cell {
  cursor: default;
}
</style>
