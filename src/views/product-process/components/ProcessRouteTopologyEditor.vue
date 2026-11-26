<template>
  <div class="route-topo-editor">
    <div class="form-section-box modal-basic-card">
      <div class="section-head">
        <div class="section-label">工艺路线（拓扑）</div>
      </div>
      <p class="block-hint">
        左侧拖工序到画板；右侧配置设备/回流/门禁等。网格与节点列表改同一份数据。
      </p>
      <a-tabs v-model:active-key="viewTab" class="detail-tabs detail-tabs-pill topo-tabs">
        <a-tab-pane key="grid" tab="网格（含连线）">
          <ProcessRouteTopologyGridEditor v-model:nodes="localNodes" />
        </a-tab-pane>
        <a-tab-pane key="list" tab="节点列表">
          <div class="section-head list-head">
            <a-space :size="8">
              <a-button size="small" type="primary" @click="addMain">添加主线</a-button>
              <a-button size="small" @click="addBranch">添加支线</a-button>
              <a-button size="small" @click="addSink">添加汇合点</a-button>
            </a-space>
          </div>
          <a-table
            :columns="columns"
            :data-source="localNodes"
            :pagination="false"
            size="small"
            row-key="id"
            :scroll="{ x: 1280 }"
            :locale="{ emptyText: '请添加主线节点' }"
          >
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'seq'">
                <span v-if="record.pathKind === 'main'">{{ mainSeqLabel(record) }}</span>
                <span v-else class="muted">{{ pathKindShort(record.pathKind) }}</span>
              </template>
              <template v-else-if="column.key === 'pathKind'">
                <a-select
                  v-model:value="record.pathKind"
                  size="small"
                  :options="ROUTE_PATH_OPTIONS"
                  style="width: 100%"
                  @change="() => onPathKindChange(record)"
                />
              </template>
              <template v-else-if="column.key === 'branchName'">
                <a-input
                  v-if="record.pathKind === 'branch'"
                  v-model:value="record.branchName"
                  size="small"
                  placeholder="如氟渣洗涤"
                />
                <span v-else class="muted">—</span>
              </template>
              <template v-else-if="column.key === 'process'">
                <a-select
                  v-model:value="record.processId"
                  size="small"
                  show-search
                  allow-clear
                  option-filter-prop="label"
                  placeholder="工序"
                  :options="processOptions"
                  style="width: 100%"
                  @change="() => onProcessChange(record)"
                />
              </template>
              <template v-else-if="column.key === 'name'">
                <a-input v-model:value="record.name" size="small" placeholder="节点名称" />
              </template>
              <template v-else-if="column.key === 'fork'">
                <a-select
                  v-if="record.pathKind === 'branch'"
                  v-model:value="record.forkAfterNodeId"
                  size="small"
                  allow-clear
                  placeholder="分出节点"
                  :options="forkOptions(record)"
                  style="width: 100%"
                />
                <span v-else class="muted">—</span>
              </template>
              <template v-else-if="column.key === 'join'">
                <a-select
                  v-if="record.pathKind === 'branch'"
                  v-model:value="record.joinToNodeId"
                  size="small"
                  allow-clear
                  placeholder="汇入节点"
                  :options="joinOptions(record)"
                  style="width: 100%"
                />
                <span v-else class="muted">—</span>
              </template>
              <template v-else-if="column.key === 'equipment'">
                <EquipmentSearchSelect
                  v-model="record.equipmentIds"
                  :options="equipmentOpts"
                  placeholder="候选设备"
                  :max-tag-count="2"
                />
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space :size="4">
                  <a-button
                    type="link"
                    size="small"
                    :disabled="index === 0"
                    @click="move(index, -1)"
                    >上移</a-button
                  >
                  <a-button
                    type="link"
                    size="small"
                    :disabled="index >= localNodes.length - 1"
                    @click="move(index, 1)"
                    >下移</a-button
                  >
                  <a-button type="link" size="small" danger @click="remove(record.id)"
                    >删除</a-button
                  >
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script>
export default { name: 'ProcessRouteTopologyEditor' }
</script>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  ROUTE_PATH_OPTIONS,
  ROUTE_PATH_MAIN,
  ROUTE_PATH_BRANCH,
  ROUTE_PATH_SINK,
  createRouteNode,
  normalizeRouteNodes,
  autoLayoutTopologyGrid,
} from '@/utils/processRouteTopology'
import { processConfigState } from '@/store/processConfigStore'
import { EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
import { equipmentState, formatDeviceLabel } from '@/store/equipmentStore'
import EquipmentSearchSelect from './EquipmentSearchSelect.vue'
import ProcessRouteTopologyGridEditor from './ProcessRouteTopologyGridEditor.vue'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:nodes'])

const viewTab = ref('grid')

const localNodes = computed({
  get: () => props.nodes || [],
  set: (val) => emit('update:nodes', autoLayoutTopologyGrid(normalizeRouteNodes(val))),
})

const columns = [
  { title: '序', key: 'seq', width: 48, align: 'center' },
  { title: '路径', key: 'pathKind', width: 100 },
  { title: '支线名', key: 'branchName', width: 110 },
  { title: '工序', key: 'process', width: 140 },
  { title: '节点名称', key: 'name', width: 120 },
  { title: '分出节点', key: 'fork', width: 130 },
  { title: '汇入节点', key: 'join', width: 130 },
  { title: '候选设备', key: 'equipment', width: 200 },
  { title: '操作', key: 'action', width: 160, fixed: 'right' },
]

const processOptions = computed(() =>
  (processConfigState.processes || []).map((p) => ({
    value: p.id,
    label: p.name,
  })),
)

const equipmentOpts = computed(() => {
  void equipmentState.devices
  return (equipmentState.devices || [])
    .filter((d) => d.status !== EQUIPMENT_STATUS.SCRAPPED)
    .map((d) => ({ value: d.id, label: formatDeviceLabel(d) }))
})

function pathKindShort(kind) {
  if (kind === ROUTE_PATH_BRANCH) return '支'
  if (kind === ROUTE_PATH_SINK) return '汇'
  return '主'
}

function mainSeqLabel(record) {
  const mains = localNodes.value.filter((n) => n.pathKind === ROUTE_PATH_MAIN)
  const idx = mains.findIndex((n) => n.id === record.id)
  return idx >= 0 ? idx + 1 : '—'
}

function forkOptions(record) {
  return localNodes.value
    .filter((n) => n.id !== record.id && n.pathKind !== ROUTE_PATH_BRANCH)
    .map((n) => ({ value: n.id, label: n.name || n.id }))
}

function joinOptions(record) {
  return localNodes.value
    .filter((n) => n.id !== record.id)
    .map((n) => {
      const tag =
        n.pathKind === ROUTE_PATH_SINK ? '汇合' : n.pathKind === ROUTE_PATH_MAIN ? '主线' : '支线'
      return { value: n.id, label: `${n.name || n.id}（${tag}）` }
    })
}

function emitNodes(list) {
  emit('update:nodes', normalizeRouteNodes(list))
}

function addMain() {
  const list = [...localNodes.value]
  list.push(
    createRouteNode({
      pathKind: ROUTE_PATH_MAIN,
      name: '',
      processId: '',
    }),
  )
  emitNodes(list)
}

function addBranch() {
  const mains = localNodes.value.filter((n) => n.pathKind === ROUTE_PATH_MAIN)
  const sinks = localNodes.value.filter((n) => n.pathKind === ROUTE_PATH_SINK)
  const list = [...localNodes.value]
  list.push(
    createRouteNode({
      pathKind: ROUTE_PATH_BRANCH,
      branchName: '',
      name: '',
      processId: '',
      forkAfterNodeId: mains[mains.length - 1]?.id || null,
      // 无汇合点时不默认主线为汇入
      joinToNodeId: sinks[0]?.id || null,
    }),
  )
  emitNodes(list)
}

function addSink() {
  const list = [...localNodes.value]
  list.push(
    createRouteNode({
      pathKind: ROUTE_PATH_SINK,
      name: '压滤',
      processId: '',
      joinMode: 'all',
    }),
  )
  emitNodes(list)
}

/** 路径类型切换时清空支线联动字段 */
function onPathKindChange(record) {
  if (record.pathKind !== ROUTE_PATH_BRANCH) {
    record.branchName = ''
    record.forkAfterNodeId = null
    record.joinToNodeId = null
  }
  if (record.pathKind !== ROUTE_PATH_SINK) {
    record.joinMode = ''
  } else if (!record.joinMode) {
    record.joinMode = 'all'
  }
  emitNodes([...localNodes.value])
}

/** 改工序后同步节点显示名；设备仅在尚未选择时带出工序默认设备 */
function onProcessChange(record) {
  const proc = (processConfigState.processes || []).find((p) => p.id === record.processId)
  if (proc?.name) {
    // 节点名称用于拓扑展示，默认与工序一致；改工序后必须跟着变
    record.name = proc.name
  } else if (!record.processId) {
    record.name = ''
  }
  if (proc?.equipmentIds?.length && !(record.equipmentIds || []).length) {
    record.equipmentIds = [...proc.equipmentIds]
  }
  emitNodes([...localNodes.value])
}

function move(index, delta) {
  const next = index + delta
  if (next < 0 || next >= localNodes.value.length) return
  const list = [...localNodes.value]
  const [row] = list.splice(index, 1)
  list.splice(next, 0, row)
  emitNodes(list)
}

function remove(id) {
  // 删除被引用的分出/汇入时清空引用，避免脏指针
  const list = localNodes.value
    .filter((n) => n.id !== id)
    .map((n) => {
      const copy = { ...n }
      if (copy.forkAfterNodeId === id) copy.forkAfterNodeId = null
      if (copy.joinToNodeId === id) copy.joinToNodeId = null
      return copy
    })
  emitNodes(list)
}

watch(
  () => props.nodes,
  (val) => {
    if (!Array.isArray(val)) {
      emit('update:nodes', [])
      return
    }
    // 缺网格坐标时自动铺格，保证连线视图可用
    if (val.length && val.some((n) => n.gridCol == null || n.gridRow == null)) {
      emit('update:nodes', autoLayoutTopologyGrid(val))
    }
  },
  { immediate: true },
)
</script>

<style scoped lang="less">
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.block-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: #86909c;
}

.muted {
  color: #c9cdd4;
}

.modal-basic-card {
  margin-bottom: 0;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid var(--divider, #e5e6eb);
  border-radius: 8px;
}

.topo-tabs {
  margin-bottom: 8px;
}

.list-head {
  margin-bottom: 8px;
}
</style>
