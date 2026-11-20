<template>
  <div class="route-board">
    <div class="line-switch">
      <a-radio-group v-model:value="lineId" size="small" button-style="solid">
        <a-radio-button v-for="item in lines" :key="item.id" :value="item.id">
          {{ item.name }}
          <span v-if="counts[item.id]" class="line-count">{{ counts[item.id] }}</span>
        </a-radio-button>
      </a-radio-group>
      <span class="line-caption">{{ view.caption }}</span>
    </div>
    <div ref="scrollRef" class="line-scroll">
      <div class="line-fit" :style="{ width: `${fitWidth}px`, height: `${fitHeight}px` }">
        <div class="line-canvas" :style="canvasStyle">
          <svg
            class="line-svg"
            :viewBox="`0 0 ${view.width} ${view.height}`"
            :width="view.width"
            :height="view.height"
          >
            <defs>
              <marker
                :id="markerId('main')"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0 0 L8 4 L0 8 Z" fill="#86909c" />
              </marker>
              <marker
                :id="markerId('slag')"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0 0 L8 4 L0 8 Z" fill="#86909c" />
              </marker>
              <marker
                :id="markerId('recycle')"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0 0 L8 4 L0 8 Z" fill="#307068" />
              </marker>
              <marker
                :id="markerId('filtrate')"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0 0 L8 4 L0 8 Z" fill="#3d9a62" />
              </marker>
            </defs>
            <path
              v-for="(edge, index) in view.edges"
              :key="`${view.id}-e-${index}`"
              :d="edge.d"
              class="line-edge"
              :class="`is-${edge.kind || 'main'}`"
              fill="none"
              :marker-end="`url(#${markerId(edge.kind || 'main')})`"
            />
            <text
              v-for="(edge, index) in labeledEdges"
              :key="`${view.id}-t-${index}`"
              :x="edge.labelX"
              :y="edge.labelY"
              class="edge-label"
            >
              {{ edge.label }}
            </text>
          </svg>
          <div
            v-for="node in view.nodes"
            :key="node.id"
            class="line-node"
            :class="[
              `is-${node.kind}`,
              {
                busy: node.batches.some((row) => !row.pending),
                wait: node.batches.length && node.batches.every((row) => row.pending),
              },
            ]"
            :style="nodeStyle(node)"
          >
            <div class="node-name">{{ node.name }}</div>
            <div v-if="node.kind === 'process'" class="node-batches">
              <button
                v-for="batch in node.batches.slice(0, 3)"
                :key="batch.id"
                type="button"
                class="batch-chip"
                :class="{ pending: batch.pending }"
                @click="openBatch(batch)"
              >
                {{ batch.batchNo }}
              </button>
              <span v-if="node.batches.length > 3" class="batch-more"
                >+{{ node.batches.length - 3 }}</span
              >
              <span v-if="!node.batches.length" class="step-idle">空闲</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTabs } from '@/composables/useTabs'
import { PLANT_LINES } from '@/mock/plantLineLayouts'
import { getFormula } from '@/store/processFormulaStore'
import { currentProcessStep } from '@/utils/processRouteBoard'

const STORAGE_KEY = 'i_doms_active_plant_line'

const props = defineProps({
  orders: { type: Array, default: () => [] },
  preferDetected: { type: Boolean, default: false },
})

const router = useRouter()
const { openTab } = useTabs()
const lines = PLANT_LINES

function matchNode(nodes, stepName) {
  if (!stepName) return null
  return (
    nodes.find(
      (node) =>
        (node.kind === 'process' || node.kind === 'product') &&
        (node.names || [node.name]).includes(stepName),
    ) || null
  )
}

function countOn(line, orders) {
  let count = 0
  for (const order of orders || []) {
    if (order.status !== 'running' && order.status !== 'pending_release') continue
    const step = currentProcessStep(order, getFormula)
    if (matchNode(line.nodes, step?.name)) count += 1
  }
  return count
}

const counts = computed(() =>
  Object.fromEntries(lines.map((line) => [line.id, countOn(line, props.orders)])),
)

function detectLine() {
  let best = ''
  let bestCount = 0
  lines.forEach((line) => {
    const count = counts.value[line.id] || 0
    if (count > bestCount) {
      best = line.id
      bestCount = count
    }
  })
  return best
}

const lineId = ref(localStorage.getItem(STORAGE_KEY) || 'precip')
if (props.preferDetected && detectLine()) lineId.value = detectLine()

watch(lineId, (id) => {
  localStorage.setItem(STORAGE_KEY, id)
})

watch(
  () => props.orders,
  () => {
    if (!props.preferDetected) return
    const found = detectLine()
    if (found) lineId.value = found
  },
)

const view = computed(() => {
  const line = lines.find((item) => item.id === lineId.value) || lines[0]
  const nodes = line.nodes.map((node) => ({ ...node, batches: [] }))
  for (const order of props.orders || []) {
    if (order.status !== 'running' && order.status !== 'pending_release') continue
    const step = currentProcessStep(order, getFormula)
    const node = matchNode(nodes, step?.name)
    if (!node) continue
    node.batches.push({
      id: order.id,
      batchNo: order.batchNo || '—',
      pending: order.status === 'pending_release',
    })
  }
  return { ...line, nodes }
})

const labeledEdges = computed(() => (view.value.edges || []).filter((edge) => edge.label))
const scrollRef = ref(null)
const fitScale = ref(1)
let resizeObserver

function updateFit() {
  const width = scrollRef.value?.clientWidth || 0
  if (!width || !view.value.width) return
  fitScale.value = Math.min(1, width / view.value.width)
}

const fitWidth = computed(() => Math.round(view.value.width * fitScale.value))
const fitHeight = computed(() => Math.round(view.value.height * fitScale.value))
const canvasStyle = computed(() => ({
  width: `${view.value.width}px`,
  height: `${view.value.height}px`,
  transform: `scale(${fitScale.value})`,
}))

onMounted(() => {
  updateFit()
  if (typeof ResizeObserver === 'undefined' || !scrollRef.value) return
  resizeObserver = new ResizeObserver(updateFit)
  resizeObserver.observe(scrollRef.value)
})

onBeforeUnmount(() => resizeObserver?.disconnect())

watch(view, () => updateFit())

function markerId(kind) {
  return `plant-arrow-${view.value.id}-${kind || 'main'}`
}

function nodeStyle(node) {
  return {
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: `${node.w}px`,
    minHeight: `${node.h}px`,
  }
}

function openBatch(batch) {
  const path = `/production/work-orders/${batch.id}`
  openTab(path, batch.batchNo || '批次指令')
  router.push(path)
}
</script>

<style scoped>
.route-board {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.line-switch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.line-count {
  display: inline-block;
  min-width: 16px;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 999px;
  background: #e7f3f1;
  color: #307068;
  font-size: 12px;
  line-height: 16px;
  text-align: center;
}

.line-caption {
  font-size: 12px;
  color: #86909c;
}

.line-scroll {
  overflow-x: auto;
  padding-bottom: 4px;
}

.line-fit {
  position: relative;
}

.line-canvas {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}

.line-svg {
  position: absolute;
  inset: 0;
  display: block;
}

.line-edge {
  stroke: #86909c;
  stroke-width: 1.4;
}

.line-edge.is-recycle {
  stroke: #307068;
}

.line-edge.is-filtrate {
  stroke: #3d9a62;
}

.edge-label {
  fill: #4e5969;
  font-size: 12px;
}

.line-node {
  position: absolute;
  box-sizing: border-box;
  padding: 6px 8px;
  background: #fff;
  border: 1px solid #c9cdd4;
  border-radius: 4px;
}

.line-node.is-feed {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  background: transparent;
  border: none;
  color: #4e5969;
  text-align: center;
}

.line-node.is-product {
  background: #f7f8fa;
}

.line-node.busy {
  background: #f3f8f7;
  border-color: #b7d4cf;
}

.line-node.wait {
  background: #fbf8f2;
  border-color: #f1eadc;
}

.node-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: #1f2329;
  text-align: center;
}

.is-feed .node-name {
  font-size: 12px;
  font-weight: 400;
  color: #4e5969;
}

.node-batches {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  margin-top: 4px;
}

.batch-chip {
  max-width: 100%;
  padding: 0 6px;
  border: 1px solid #b7d4cf;
  border-radius: 999px;
  background: #fff;
  color: #307068;
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
}

.batch-chip.pending {
  border-color: #f1eadc;
  color: #ad6800;
}

.batch-more,
.step-idle {
  font-size: 12px;
  line-height: 20px;
  color: #86909c;
}
</style>
