<template>
  <div v-if="preview.main.length" class="topo-preview">
    <div class="topo-title">路线拓扑</div>

    <div class="topo-stack" :style="{ width: `${canvasWidth}px` }">
      <div class="main-row">
        <template v-for="(node, index) in preview.main" :key="node.id">
          <div class="main-col" :style="{ width: `${NODE_W}px` }">
            <div class="topo-node main">
              <div class="node-seq">{{ index + 1 }}</div>
              <div class="node-name">{{ node.name || '—' }}</div>
              <div class="node-meta" :title="equipmentText(node)">{{ equipmentText(node) }}</div>
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

      <div
        v-if="preview.branches.length || preview.sinks.length"
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
              marker-end="url(#route-topo-arrow)"
            />
            <text :x="br.forkLabel.x" :y="br.forkLabel.y" class="wire-label">↓ 分出</text>
            <text :x="br.joinLabel.x" :y="br.joinLabel.y" class="wire-label">→ 汇入</text>
          </template>
          <defs>
            <marker
              id="route-topo-arrow"
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
          <div class="node-meta">分出：{{ br.forkName }} · 汇入：{{ br.joinName }}</div>
          <div class="node-meta" :title="equipmentText(br)">{{ equipmentText(br) }}</div>
        </div>

        <div v-for="sk in sinkLayouts" :key="sk.id" class="topo-node sink" :style="sk.cardStyle">
          <div class="branch-tag sink-tag">汇合点</div>
          <div class="node-name">{{ sk.name || '—' }}</div>
          <div class="node-meta" :title="equipmentText(sk)">{{ equipmentText(sk) }}</div>
        </div>
      </div>
    </div>

    <p v-if="preview.branches.length" class="topo-hint">
      支线从主线节点下分出，可汇入主线或下方汇合点（如压滤，不在主线）。
    </p>
  </div>
  <div v-else class="topo-empty">按顺序添加主线节点后，这里预览主线、支线与汇合点</div>
</template>

<script>
export default { name: 'ProcessRouteTopologyPreview' }
</script>

<script setup>
import { computed } from 'vue'
import { buildRouteTopologyPreview } from '@/utils/processRouteTopology'
import { formatDeviceLabel } from '@/store/equipmentStore'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
})

const NODE_W = 160
const ARROW_W = 28
const STEP = NODE_W + ARROW_W
const BRANCH_CARD_W = 168
const BRANCH_GAP_Y = 16
const BRANCH_CARD_H = 92
const BRANCH_ROW_H = BRANCH_CARD_H + 16
const SINK_CARD_H = 80

const preview = computed(() => buildRouteTopologyPreview(props.nodes))

const mainIndexById = computed(() => {
  const map = new Map()
  preview.value.main.forEach((n, idx) => map.set(n.id, idx))
  return map
})

const canvasWidth = computed(() => {
  const n = preview.value.main.length
  if (!n) return NODE_W
  // 汇合点可能落在主线右侧，预留一列
  return Math.max(n * NODE_W + (n - 1) * ARROW_W, n * STEP + NODE_W)
})

const branchZoneH = computed(() => {
  const bn = preview.value.branches.length
  const sn = preview.value.sinks.length
  if (!bn && !sn) return 0
  return BRANCH_GAP_Y + bn * BRANCH_ROW_H + (sn ? SINK_CARD_H + 24 : 0)
})

function nodeLeft(index) {
  return index * STEP
}

function nodeCenterX(index) {
  return nodeLeft(index) + NODE_W / 2
}

const sinkLayouts = computed(() => {
  const sinks = preview.value.sinks
  const mains = preview.value.main
  const bn = preview.value.branches.length
  const baseTop = BRANCH_GAP_Y + bn * BRANCH_ROW_H + 8
  return sinks.map((sk, i) => {
    // 汇合点放在支线区底部、主线中部偏左
    const mid = Math.max(0, Math.floor((mains.length - 1) / 2))
    const left = nodeLeft(Math.min(mid + i, Math.max(mains.length - 1, 0)))
    return {
      ...sk,
      cardStyle: {
        left: `${left}px`,
        top: `${baseTop}px`,
        width: `${BRANCH_CARD_W}px`,
        minHeight: `${SINK_CARD_H}px`,
      },
      centerX: left + BRANCH_CARD_W / 2,
      top: baseTop,
    }
  })
})

const sinkCenterById = computed(() => {
  const map = new Map()
  sinkLayouts.value.forEach((s) => map.set(s.id, s))
  return map
})

const branchLayouts = computed(() => {
  const mains = preview.value.main
  if (!mains.length) return []
  const lastIdx = mains.length - 1

  return preview.value.branches.map((br, bi) => {
    const forkIdxRaw = mainIndexById.value.get(br.forkAfterNodeId)
    const startIdx = forkIdxRaw != null ? forkIdxRaw : 0
    const sink = sinkCenterById.value.get(br.joinToNodeId)
    const joinMainIdx = mainIndexById.value.get(br.joinToNodeId)
    let joinX
    let joinY = 1
    if (sink) {
      joinX = sink.centerX
      joinY = sink.top
    } else if (joinMainIdx != null) {
      joinX = nodeCenterX(joinMainIdx)
      joinY = 1
    } else {
      joinX = nodeCenterX(Math.min(startIdx + 1, lastIdx))
      joinY = 1
    }

    const forkX = nodeCenterX(startIdx)
    const cardLeft = nodeLeft(startIdx)
    const cardTop = BRANCH_GAP_Y + bi * BRANCH_ROW_H
    const midY = cardTop + BRANCH_CARD_H / 2
    const cardRight = cardLeft + BRANCH_CARD_W
    const y0 = 1

    const path = sink
      ? [
          `M ${forkX} ${y0}`,
          `L ${forkX} ${cardTop}`,
          `M ${cardRight + 2} ${midY}`,
          `L ${joinX} ${midY}`,
          `L ${joinX} ${joinY}`,
        ].join(' ')
      : [
          `M ${forkX} ${y0}`,
          `L ${forkX} ${cardTop}`,
          `M ${cardRight + 2} ${midY}`,
          `L ${joinX} ${midY}`,
          `L ${joinX} ${y0}`,
        ].join(' ')

    return {
      ...br,
      forkName: br.forkLabel,
      joinName: br.joinLabel,
      path,
      forkLabel: { x: forkX + 8, y: 14 },
      joinLabel: { x: joinX + 8, y: sink ? joinY - 4 : 14 },
      cardStyle: {
        left: `${cardLeft}px`,
        top: `${cardTop}px`,
        width: `${BRANCH_CARD_W}px`,
        minHeight: `${BRANCH_CARD_H}px`,
      },
    }
  })
})

function equipmentText(node) {
  const ids = node?.equipmentIds || []
  if (!ids.length) return '设备：—'
  return `设备：${ids.map((id) => formatDeviceLabel(id) || id).join('、')}`
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
}

.topo-node.main {
  width: 100%;
  border-color: #307068;
}

.branch-zone {
  position: relative;
  z-index: 1;
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

.topo-node.branch,
.topo-node.sink {
  position: absolute;
  z-index: 2;
  border-color: #c9cdd4;
  background: #fff;
}

.topo-node.sink {
  border-color: #d48806;
  background: #fffbe6;
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

.sink-tag {
  background: #fff1b8;
  color: #ad6800;
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
