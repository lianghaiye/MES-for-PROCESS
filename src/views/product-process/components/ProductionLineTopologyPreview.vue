<template>
  <div v-if="preview.main.length" class="topo-preview">
    <div class="topo-title">产线拓扑</div>

    <div class="topo-stack" :style="{ width: `${canvasWidth}px` }">
      <!-- 主线：内容完整展示，列等高 -->
      <div class="main-row">
        <template v-for="(station, index) in preview.main" :key="station.id">
          <div class="main-col" :style="{ width: `${NODE_W}px` }">
            <div class="topo-node main">
              <div class="node-seq">{{ station.seq }}</div>
              <div class="node-name">{{ station.name || '—' }}</div>
              <div class="node-meta" :title="equipmentText(station)">
                {{ equipmentText(station) }}
              </div>
              <div class="node-meta" :title="positionText(station)">
                {{ positionText(station) }}
              </div>
            </div>
          </div>
          <div
            v-if="index < preview.main.length - 1"
            class="main-arrow"
            :style="{ width: `${ARROW_W}px` }"
          >
            →
          </div>
        </template>
      </div>

      <!-- 支线区：紧贴主线底边；盒子在分出点正下方 -->
      <div
        v-if="preview.branches.length"
        class="branch-zone"
        :style="{ height: `${branchZoneH}px` }"
      >
        <svg class="topo-wires" :width="canvasWidth" :height="branchZoneH" aria-hidden="true">
          <template v-for="br in branchLayouts" :key="`wire-${br.id}`">
            <path
              :d="br.path"
              fill="none"
              stroke="#86909c"
              stroke-width="2"
              stroke-dasharray="5 4"
              marker-end="url(#topo-arrow)"
            />
            <text :x="br.forkLabel.x" :y="br.forkLabel.y" class="wire-label">↓ 分出</text>
            <text :x="br.joinLabel.x" :y="br.joinLabel.y" class="wire-label">
              ↑ {{ br.joinBeforeSeq ? '汇入' : '线末' }}
            </text>
          </template>
          <defs>
            <marker
              id="topo-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#86909c" />
            </marker>
          </defs>
        </svg>

        <div
          v-for="br in branchLayouts"
          :key="br.id"
          class="topo-node branch"
          :style="br.cardStyle"
        >
          <div class="branch-tag">{{ br.branchName || '支线' }}</div>
          <div class="node-name">{{ br.name || '—' }}</div>
          <div class="node-meta" :title="equipmentText(br)">{{ equipmentText(br) }}</div>
          <div class="node-meta" :title="positionText(br)">{{ positionText(br) }}</div>
        </div>
      </div>
    </div>

    <p v-if="preview.branches.length" class="topo-hint">
      支线在分出工段正下方垂直对齐；虚线自主线底边接出，经支线再汇入。
    </p>
  </div>
  <div v-else class="topo-empty">按顺序添加工段后，这里预览主线与支线</div>
</template>

<script>
export default { name: 'ProductionLineTopologyPreview' }
</script>

<script setup>
import { computed } from 'vue'
import { buildProductionLineTopologyPreview, formatDeviceLabel } from '@/store/productionLineStore'

const props = defineProps({
  stations: { type: Array, default: () => [] },
})

const NODE_W = 180
const ARROW_W = 28
const STEP = NODE_W + ARROW_W
const BRANCH_CARD_W = 180
const BRANCH_GAP_Y = 20
const BRANCH_CARD_H = 96
const BRANCH_ROW_H = BRANCH_CARD_H + 20

const preview = computed(() => buildProductionLineTopologyPreview(props.stations))

const mainIndexBySeq = computed(() => {
  const map = new Map()
  preview.value.main.forEach((st, idx) => {
    map.set(Number(st.seq), idx)
  })
  return map
})

const canvasWidth = computed(() => {
  const n = preview.value.main.length
  if (!n) return NODE_W
  return n * NODE_W + (n - 1) * ARROW_W
})

const branchZoneH = computed(() => {
  const n = preview.value.branches.length
  if (!n) return 0
  return BRANCH_GAP_Y + n * BRANCH_ROW_H
})

function nodeLeft(index) {
  return index * STEP
}

function nodeCenterX(index) {
  return nodeLeft(index) + NODE_W / 2
}

const branchLayouts = computed(() => {
  const mains = preview.value.main
  if (!mains.length) return []
  const lastIdx = mains.length - 1

  return preview.value.branches.map((br, bi) => {
    const forkIdxRaw = mainIndexBySeq.value.get(Number(br.forkAfterSeq))
    const joinSeq = br.joinBeforeSeq != null ? Number(br.joinBeforeSeq) : null
    let joinIdx =
      joinSeq != null && mainIndexBySeq.value.has(joinSeq)
        ? mainIndexBySeq.value.get(joinSeq)
        : lastIdx
    const startIdx = forkIdxRaw != null ? forkIdxRaw : 0
    if (joinIdx <= startIdx) joinIdx = Math.min(startIdx + 1, lastIdx)

    const forkX = nodeCenterX(startIdx)
    const joinX = nodeCenterX(joinIdx)
    // 与分出工段左缘对齐 → 正下方垂直平行
    const cardLeft = nodeLeft(startIdx)
    const cardTop = BRANCH_GAP_Y + bi * BRANCH_ROW_H
    const midY = cardTop + BRANCH_CARD_H / 2
    const cardRight = cardLeft + BRANCH_CARD_W
    // 支线区顶 = 主线底边外侧
    const y0 = 1

    const path = [
      `M ${forkX} ${y0}`,
      `L ${forkX} ${cardTop}`,
      `M ${cardRight + 2} ${midY}`,
      `L ${joinX} ${midY}`,
      `L ${joinX} ${y0}`,
    ].join(' ')

    return {
      ...br,
      path,
      forkLabel: { x: forkX + 10, y: 14 },
      joinLabel: { x: joinX + 10, y: 14 },
      cardStyle: {
        left: `${cardLeft}px`,
        top: `${cardTop}px`,
        width: `${BRANCH_CARD_W}px`,
        minHeight: `${BRANCH_CARD_H}px`,
      },
    }
  })
})

function equipmentText(station) {
  const ids = station?.equipmentIds || []
  if (!ids.length) return '设备：—'
  return `设备：${ids.map((id) => formatDeviceLabel(id) || id).join('、')}`
}

function positionText(station) {
  const names = station?.positionNames || []
  if (!names.length) return '岗位：—'
  return `岗位：${names.join('、')}`
}
</script>

<style scoped lang="less">
.topo-preview {
  margin-top: 12px;
  padding: 12px;
  background: #f7f8fa;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  overflow-x: auto;
}

.topo-title {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}

.topo-stack {
  position: relative;
}

.main-row {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: stretch;
}

.main-col {
  flex: 0 0 auto;
  display: flex;
}

.topo-node {
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #c9e0dc;
  box-sizing: border-box;
  box-shadow: 0 0 0 1px #fff;
}

.topo-node.main {
  width: 100%;
  border-color: #307068;
  overflow: visible;
}

.branch-zone {
  position: relative;
  z-index: 1;
  margin-top: 0;
}

.topo-wires {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  pointer-events: none;
  overflow: visible;
}

.wire-label {
  fill: #86909c;
  font-size: 11px;
}

.topo-node.branch {
  position: absolute;
  z-index: 2;
  border-color: #c9cdd4;
  background: #fff;
}

.node-seq {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-bottom: 4px;
  border-radius: 50%;
  background: #307068;
  color: #fff;
  font-size: 12px;
}

.node-name {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}

.node-meta {
  margin-top: 2px;
  font-size: 12px;
  color: #86909c;
  line-height: 18px;
  word-break: break-all;
  white-space: normal;
}

.branch-tag {
  display: inline-block;
  margin-bottom: 4px;
  padding: 0 6px;
  border-radius: 4px;
  background: #e5e6eb;
  color: #4e5969;
  font-size: 12px;
}

.main-arrow {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #307068;
  font-weight: 600;
  font-size: 16px;
}

.topo-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #86909c;
}

.topo-empty {
  margin-top: 8px;
  padding: 12px;
  color: #86909c;
  font-size: 12px;
  background: #fafafa;
  border-radius: 8px;
}
</style>
