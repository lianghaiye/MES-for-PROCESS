/**
 * 工艺路线拓扑：主线 / 支线 / 汇合点（sink），节点挂工序与候选设备。
 * 与离散 grid（步号×并行行）并存；layout=topology 时以此为准。
 */

import { normalizeProcessQcConfigs } from '@/utils/qcProcessConfig'
import {
  PROCESS_GATE_HARD,
  PROCESS_GATE_RECORD,
  normalizeProcessGate,
} from '@/mock/processConfigSeed'

export const ROUTE_LAYOUT_GRID = 'grid'
export const ROUTE_LAYOUT_TOPOLOGY = 'topology'

export const ROUTE_PATH_MAIN = 'main'
export const ROUTE_PATH_BRANCH = 'branch'
/** 汇合点：可不在主线（如压滤），供多条支线 joinToNodeId 指向 */
export const ROUTE_PATH_SINK = 'sink'

export const ROUTE_PATH_OPTIONS = [
  { value: ROUTE_PATH_MAIN, label: '主线' },
  { value: ROUTE_PATH_BRANCH, label: '支线' },
  { value: ROUTE_PATH_SINK, label: '汇合点' },
]

function nextNodeId() {
  return `prn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/** 解析路线布局：默认拓扑；仅显式 layout=grid 时视为旧网格 */
export function resolveRouteLayout(route = {}) {
  if (route.layout === ROUTE_LAYOUT_GRID) return ROUTE_LAYOUT_GRID
  if (route.layout === ROUTE_LAYOUT_TOPOLOGY) return ROUTE_LAYOUT_TOPOLOGY
  if (Array.isArray(route.nodes) && route.nodes.some((n) => n?.processId || n?.name)) {
    return ROUTE_LAYOUT_TOPOLOGY
  }
  // 新系统默认拓扑
  return ROUTE_LAYOUT_TOPOLOGY
}

/**
 * 创建/归一化单个路线节点
 * @param {object} partial
 */
export function createRouteNode(partial = {}) {
  const pathKind =
    partial.pathKind === ROUTE_PATH_BRANCH
      ? ROUTE_PATH_BRANCH
      : partial.pathKind === ROUTE_PATH_SINK
        ? ROUTE_PATH_SINK
        : ROUTE_PATH_MAIN
  const equipmentIds = Array.isArray(partial.equipmentIds)
    ? [...new Set(partial.equipmentIds.filter(Boolean))]
    : partial.equipmentId
      ? [partial.equipmentId]
      : []
  const isBranch = pathKind === ROUTE_PATH_BRANCH
  const isMain = pathKind === ROUTE_PATH_MAIN
  const id = partial.id || nextNodeId()
  const gridCol = Number(partial.gridCol)
  const gridRow = Number(partial.gridRow)
  // 回流：编辑态保留空草稿行（stream/toNodeId 都空）；保存时再 pruneEmptyReturns
  const returns = Array.isArray(partial.returns)
    ? partial.returns.map((item) => ({
        stream: String(item?.stream || '').trim(),
        toNodeId: String(item?.toNodeId || '').trim(),
      }))
    : []
  // 同一条支线上的多节点共用 branchLineId；缺省用自身 id（表示新开一条支线）
  const branchLineId = isBranch ? String(partial.branchLineId || '').trim() || id : ''
  // 主线、支线均可设置汇入（如主线某步也进压滤）；汇合点自身不设
  const canJoin = isBranch || isMain
  // 按化验方案覆盖：本路线逐方案门禁 / 是否质检
  const assayOverrides = normalizeAssayOverrides(partial.assayOverrides)
  return {
    id,
    seq: Number(partial.seq) > 0 ? Number(partial.seq) : 1,
    pathKind,
    branchName: isBranch ? String(partial.branchName || '').trim() : '',
    branchLineId,
    processId: String(partial.processId || '').trim(),
    name: String(partial.name || '').trim(),
    equipmentIds,
    equipmentCategory: String(partial.equipmentCategory || '').trim(),
    // 支线：分出节点；主线/支线：汇入节点
    forkAfterNodeId: isBranch ? String(partial.forkAfterNodeId || '').trim() || null : null,
    joinToNodeId: canJoin ? String(partial.joinToNodeId || '').trim() || null : null,
    joinMode:
      pathKind === ROUTE_PATH_SINK && (partial.joinMode === 'any' || partial.joinMode === 'all')
        ? partial.joinMode
        : pathKind === ROUTE_PATH_SINK
          ? 'all'
          : '',
    edgeOutLabel: String(partial.edgeOutLabel || '').trim(),
    // 网格画布坐标（1 起）：与拓扑预览共用同一 nodes
    gridCol: Number.isFinite(gridCol) && gridCol > 0 ? Math.floor(gridCol) : null,
    gridRow: Number.isFinite(gridRow) && gridRow > 0 ? Math.floor(gridRow) : null,
    // 对齐旧网格右侧「本格配置」
    processFileId: String(partial.processFileId || '').trim(),
    gateMode: String(partial.gateMode || '').trim(),
    gateCustom: Boolean(partial.gateCustom),
    transferCondition: String(partial.transferCondition || ''),
    transferCustom: Boolean(partial.transferCustom),
    qcOverride: partial.qcOverride === 'off' ? 'off' : 'inherit',
    assayOverrides,
    returns,
  }
}

/** 丢掉 stream、toNodeId 都空的回流草稿（保存/校验出口用） */
export function pruneEmptyReturns(nodes) {
  return (Array.isArray(nodes) ? nodes : []).map((n) => ({
    ...n,
    returns: Array.isArray(n.returns)
      ? n.returns.filter((item) => item?.stream || item?.toNodeId)
      : [],
  }))
}

/**
 * 规范化按化验方案的路线覆盖
 * gateMode: inherit | record | hard；qcOverride: inherit | off（off 时门禁强制 inherit）
 */
export function normalizeAssayOverrides(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const result = []
  list.forEach((item) => {
    const qcConfigId = String(item?.qcConfigId || '').trim()
    if (!qcConfigId || seen.has(qcConfigId)) return
    seen.add(qcConfigId)
    const qcOverride = item?.qcOverride === 'off' ? 'off' : 'inherit'
    // 本路线不检时清空门禁覆盖（主控关 → 联动字段空）
    let gateMode = 'inherit'
    if (qcOverride !== 'off') {
      if (item?.gateMode === 'record' || item?.gateMode === 'hard') gateMode = item.gateMode
    }
    result.push({ qcConfigId, gateMode, qcOverride })
  })
  return result
}

/**
 * 组装 UI/解析用的「方案 × 本路线覆盖」行。
 * 无 assayOverrides 时用旧整格 gateCustom/qcOverride 作为各方案统一默认。
 */
export function buildAssayOverrideRows(process, node = {}) {
  const schemes = normalizeProcessQcConfigs(process?.qcConfigs || [])
  const overrides = normalizeAssayOverrides(node?.assayOverrides)
  const byId = new Map(overrides.map((o) => [o.qcConfigId, o]))
  const hasExplicit = overrides.length > 0
  const legacyQc = node?.qcOverride === 'off' ? 'off' : 'inherit'
  const legacyGate =
    node?.gateCustom && (node.gateMode === 'record' || node.gateMode === 'hard')
      ? node.gateMode
      : 'inherit'

  return schemes.map((scheme) => {
    const hit = byId.get(scheme.id)
    if (hit) {
      return {
        qcConfigId: scheme.id,
        scheme,
        gateMode: hit.gateMode,
        qcOverride: hit.qcOverride,
      }
    }
    if (!hasExplicit) {
      return {
        qcConfigId: scheme.id,
        scheme,
        gateMode: legacyGate,
        qcOverride: legacyQc,
      }
    }
    return {
      qcConfigId: scheme.id,
      scheme,
      gateMode: 'inherit',
      qcOverride: 'inherit',
    }
  })
}

/**
 * 合并工序方案与路线覆盖，得到本路线实际生效的化验方案列表（已剔除「本路线不检」）
 */
export function resolveAssaySchemesForRouteNode(process, node = {}) {
  return buildAssayOverrideRows(process, node)
    .filter((row) => row.qcOverride !== 'off')
    .map((row) => {
      const gateMode =
        row.gateMode === 'inherit'
          ? normalizeProcessGate(row.scheme.gateMode)
          : normalizeProcessGate(row.gateMode)
      return {
        ...row.scheme,
        gateMode,
        hardGate: gateMode === PROCESS_GATE_HARD,
      }
    })
}

/** 写入/更新某一方案的覆盖项；qcOverride=off 时清空 gateMode */
export function upsertAssayOverride(assayOverrides, qcConfigId, patch = {}) {
  const id = String(qcConfigId || '').trim()
  if (!id) return normalizeAssayOverrides(assayOverrides)
  const list = normalizeAssayOverrides(assayOverrides)
  const idx = list.findIndex((o) => o.qcConfigId === id)
  const prev = idx >= 0 ? list[idx] : { qcConfigId: id, gateMode: 'inherit', qcOverride: 'inherit' }
  const next = {
    ...prev,
    ...patch,
    qcConfigId: id,
  }
  if (next.qcOverride === 'off') next.gateMode = 'inherit'
  else if (next.gateMode !== 'record' && next.gateMode !== 'hard') next.gateMode = 'inherit'
  if (idx >= 0) list[idx] = next
  else list.push(next)
  return normalizeAssayOverrides(list)
}

/** 门禁选项：跟随方案默认 + 记录 + 硬门禁 */
export function routeAssayGateOptions(schemeGateMode) {
  const def = normalizeProcessGate(schemeGateMode)
  const defLabel = def === PROCESS_GATE_HARD ? '硬门禁 · 系统自动卡' : '记录 · 技术员判定'
  return [
    { value: 'inherit', label: `跟随方案默认（${defLabel}）` },
    { value: PROCESS_GATE_RECORD, label: '记录 · 技术员判定' },
    { value: PROCESS_GATE_HARD, label: '硬门禁 · 系统自动卡' },
  ]
}

/** 新建路线默认 3 个空主线格，便于拖工序 */
export function createDefaultMainLineNodes(count = 3) {
  const n = Math.max(1, Number(count) || 3)
  return Array.from({ length: n }, (_, i) =>
    createRouteNode({
      pathKind: ROUTE_PATH_MAIN,
      gridCol: i + 1,
      gridRow: 1,
      name: '',
      processId: '',
    }),
  )
}

/**
 * 将支线按 branchLineId 分成多条「支线线」，线内按行列稳定排序。
 * @returns {{ key: string, forkId: string|null, nodes: object[] }[]}
 */
export function groupBranchLines(nodes) {
  const list = Array.isArray(nodes) ? nodes : []
  const branches = list.filter((n) => n.pathKind === ROUTE_PATH_BRANCH)
  const lineMap = new Map()
  const lineOrder = []
  branches.forEach((n) => {
    const key = n.branchLineId || n.id
    if (!lineMap.has(key)) {
      lineMap.set(key, [])
      lineOrder.push(key)
    }
    lineMap.get(key).push(n)
  })
  return lineOrder.map((key) => {
    // 保持 nodes 列表中的出现顺序 = 支线深度顺序（新增子节点 append 在末尾）
    const group = lineMap.get(key)
    return {
      key,
      forkId: group[0]?.forkAfterNodeId || null,
      nodes: group,
    }
  })
}

/**
 * 一条支线线（含从其节点再分出的整棵子树）占多宽。
 * 用于主线块占位，避免「离心」挤进下一道主线（过滤）正下方。
 */
function lineTreeWidth(line, linesByFork, memo = new Map()) {
  if (memo.has(line.key)) return memo.get(line.key)
  let width = Math.max(1, line.nodes.length)
  line.nodes.forEach((n, depth) => {
    const childLines = linesByFork.get(n.id) || []
    let childSum = 0
    childLines.forEach((cl) => {
      childSum += lineTreeWidth(cl, linesByFork, memo)
    })
    // 子支线从该节点右下开始：相对线起点至少 depth+1，再加子树宽
    if (childSum > 0) {
      width = Math.max(width, depth + 1 + childSum)
    }
  })
  memo.set(line.key, width)
  return width
}

/**
 * 把一条支线线放到 (startCol, startRow)，线内右下错位；再递归铺从其节点分出的下级支线。
 * 层级：父支 → 子支 → … → 最后才是汇入（汇入在外层统一落底）。
 */
function placeBranchLineTree(line, startCol, startRow, linesByFork, placedLineKeys, maxRowRef) {
  line.nodes.forEach((n, depth) => {
    n.gridCol = startCol + depth
    n.gridRow = startRow + depth
    maxRowRef.value = Math.max(maxRowRef.value, n.gridRow)
  })
  placedLineKeys.add(line.key)

  // 每个节点下的子支线：落在该节点右下方，多条并行向右排
  line.nodes.forEach((n) => {
    const childLines = linesByFork.get(n.id) || []
    let childCol = Number(n.gridCol) + 1
    const childRow = Number(n.gridRow) + 1
    childLines.forEach((cl) => {
      if (placedLineKeys.has(cl.key)) return
      const w = placeBranchLineTree(cl, childCol, childRow, linesByFork, placedLineKeys, maxRowRef)
      childCol += w
    })
  })
  return lineTreeWidth(line, linesByFork)
}

/**
 * 按主线 / 支线 / 汇合点铺网格坐标（对齐示意图）：
 * 主N → 右下 支N → 再右下 子支；汇入点在全部支线之下居中。
 * 子支（如离心）必须在父支（锂盐洗涤）与汇入/过滤之间，不能落到汇入下面，也不能压到下一主线正下。
 */
export function autoLayoutTopologyGrid(nodes, { force = false } = {}) {
  const list = normalizeRouteNodes(nodes)
  const mains = list.filter((n) => n.pathKind === ROUTE_PATH_MAIN)
  const sinks = list.filter((n) => n.pathKind === ROUTE_PATH_SINK)
  void force

  // 画布没有汇合点时，清掉误默认成「主线」的汇入，避免画出错误虚线
  if (!sinks.length) {
    const byId = new Map(list.map((n) => [n.id, n]))
    list.forEach((n) => {
      if (!n.joinToNodeId) return
      const target = byId.get(n.joinToNodeId)
      if (target?.pathKind === ROUTE_PATH_MAIN) n.joinToNodeId = null
    })
  }

  const lines = groupBranchLines(list)
  const linesByFork = new Map()
  lines.forEach((line) => {
    const fid = line.forkId || '_none'
    if (!linesByFork.has(fid)) linesByFork.set(fid, [])
    linesByFork.get(fid).push(line)
  })

  const sortedMains = [...mains].sort(
    (a, b) => (a.gridCol || 9999) - (b.gridCol || 9999) || String(a.id).localeCompare(b.id),
  )

  const maxRowRef = { value: 1 }
  let nextCol = 1
  const placedLineKeys = new Set()

  // 主线一列；其支线落在右侧（夹在本主线与下一主线之间），块宽含整棵子树
  sortedMains.forEach((main) => {
    const forkLines = linesByFork.get(main.id) || []
    main.gridCol = nextCol
    main.gridRow = 1

    if (forkLines.length) {
      // 支线从主线右侧一列起排 → 视觉上在两个主线格中间
      let lineCol = nextCol + 1
      forkLines.forEach((line) => {
        const w = placeBranchLineTree(line, lineCol, 2, linesByFork, placedLineKeys, maxRowRef)
        lineCol += w
      })
      nextCol = lineCol
    } else {
      nextCol += 1
    }
  })

  // 分出挂在汇合点上的支线
  const sinkIds = new Set(sinks.map((s) => s.id))
  lines.forEach((line) => {
    if (placedLineKeys.has(line.key)) return
    if (!sinkIds.has(line.forkId)) return
    const fork = list.find((n) => n.id === line.forkId)
    // 汇合点此时可能尚未落位，先按当前 nextCol 暂放，汇入行稍后统一抬到最底
    const startCol = fork?.gridCol || nextCol
    const w = placeBranchLineTree(line, startCol, 2, linesByFork, placedLineKeys, maxRowRef)
    nextCol = Math.max(nextCol, startCol + w)
  })

  // 其余未放置
  lines.forEach((line) => {
    if (placedLineKeys.has(line.key)) return
    const w = placeBranchLineTree(line, nextCol, 2, linesByFork, placedLineKeys, maxRowRef)
    nextCol += w
  })

  // 汇入/过滤：必须在所有主线、支线、子支之下（离心在锂盐与过滤之间）
  const sinkRow = maxRowRef.value + 1
  const sinkStartCol = Math.max(1, Math.ceil(Math.max(1, nextCol - 1) / 2))
  sinks.forEach((n, i) => {
    n.gridCol = sinkStartCol + i
    n.gridRow = sinkRow
  })

  return normalizeRouteNodes(list)
}

/**
 * 删除节点，并清空其他节点上指向它的分出 / 汇入 / 回流引用。
 * @param {Array} nodes
 * @param {string} nodeId
 */
export function removeRouteNode(nodes, nodeId) {
  const id = String(nodeId || '').trim()
  if (!id) return autoLayoutTopologyGrid(nodes)
  const list = normalizeRouteNodes(nodes)
    .filter((n) => n.id !== id)
    .map((n) => {
      const copy = { ...n }
      if (copy.forkAfterNodeId === id) copy.forkAfterNodeId = null
      if (copy.joinToNodeId === id) copy.joinToNodeId = null
      if (Array.isArray(copy.returns) && copy.returns.length) {
        copy.returns = copy.returns.map((r) =>
          r.toNodeId === id ? { ...r, toNodeId: '' } : { ...r },
        )
      }
      return copy
    })
  return autoLayoutTopologyGrid(list)
}

/**
 * 统计每个主线下并行支线线条数（按 branchLineId 去重，用于列间距）
 * @returns {Map<string, number>} mainId -> parallelLineCount
 */
export function countBranchesByForkMain(nodes) {
  const map = new Map()
  groupBranchLines(nodes).forEach((line) => {
    if (!line.forkId) return
    map.set(line.forkId, (map.get(line.forkId) || 0) + 1)
  })
  return map
}

/**
 * 网格连线：主线相邻 + 支线分出/串接/汇入 + 主线汇入。
 * 同支线多节点：首←分出、中串接、末→汇入；其它支线各自汇入，互不串到别的支线末格。
 */
export function buildTopologyGridEdges(nodes) {
  const list = autoLayoutTopologyGrid(nodes)
  const byId = new Map(list.map((n) => [n.id, n]))
  const mains = list
    .filter((n) => n.pathKind === ROUTE_PATH_MAIN)
    .sort((a, b) => a.gridCol - b.gridCol)
  const edges = []
  for (let i = 0; i < mains.length - 1; i += 1) {
    edges.push({
      id: `main-${mains[i].id}-${mains[i + 1].id}`,
      kind: 'main',
      fromId: mains[i].id,
      toId: mains[i + 1].id,
    })
  }
  // 主线也可汇入汇合点（虚线）
  mains.forEach((m) => {
    if (m.joinToNodeId && byId.has(m.joinToNodeId) && m.joinToNodeId !== m.id) {
      edges.push({
        id: `main-join-${m.id}-${m.joinToNodeId}`,
        kind: 'join',
        fromId: m.id,
        toId: m.joinToNodeId,
      })
    }
  })

  // 汇入从支线「首格」画出；子节点右下错位，不挡首格竖直汇合走廊
  groupBranchLines(list).forEach((line) => {
    const group = line.nodes
    const first = group[0]
    if (!first) return
    if (first.forkAfterNodeId && byId.has(first.forkAfterNodeId)) {
      edges.push({
        id: `fork-${first.forkAfterNodeId}-${first.id}`,
        kind: 'fork',
        fromId: first.forkAfterNodeId,
        toId: first.id,
      })
    }
    for (let i = 0; i < group.length - 1; i += 1) {
      edges.push({
        id: `branch-chain-${group[i].id}-${group[i + 1].id}`,
        kind: 'branch-chain',
        fromId: group[i].id,
        toId: group[i + 1].id,
      })
    }
    const joinId =
      first.joinToNodeId || group.map((g) => g.joinToNodeId).find((id) => id && byId.has(id))
    if (joinId && byId.has(joinId) && joinId !== first.id) {
      edges.push({
        id: `join-${first.id}-${joinId}`,
        kind: 'join',
        fromId: first.id,
        toId: joinId,
      })
    }
  })

  // 回流：本格 → 目标格（虚线，可带回流物料名）
  list.forEach((n) => {
    ;(n.returns || []).forEach((ret, idx) => {
      const toId = String(ret?.toNodeId || '').trim()
      if (!toId || !byId.has(toId) || toId === n.id) return
      edges.push({
        id: `return-${n.id}-${toId}-${idx}`,
        kind: 'return',
        fromId: n.id,
        toId,
        label: String(ret?.stream || '').trim() || '回流',
      })
    })
  })
  return { nodes: list, edges }
}

/** 规范化节点列表，重排 seq（主线连续，其余保持相对序） */
export function normalizeRouteNodes(nodes) {
  const list = (Array.isArray(nodes) ? nodes : []).map((n, idx) =>
    createRouteNode({ ...n, seq: n?.seq || idx + 1 }),
  )
  const mains = list.filter((n) => n.pathKind === ROUTE_PATH_MAIN)
  mains.forEach((n, i) => {
    n.seq = i + 1
  })
  let seq = mains.length + 1
  list
    .filter((n) => n.pathKind !== ROUTE_PATH_MAIN)
    .forEach((n) => {
      n.seq = seq
      seq += 1
    })
  return list
}

export function listMainNodes(nodes) {
  return normalizeRouteNodes(nodes).filter((n) => n.pathKind === ROUTE_PATH_MAIN)
}

export function listBranchNodes(nodes) {
  return normalizeRouteNodes(nodes).filter((n) => n.pathKind === ROUTE_PATH_BRANCH)
}

export function listSinkNodes(nodes) {
  return normalizeRouteNodes(nodes).filter((n) => n.pathKind === ROUTE_PATH_SINK)
}

/**
 * 拓扑校验
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateRouteTopology(nodes) {
  // 保存出口：去掉未填完的空回流草稿
  const list = normalizeRouteNodes(pruneEmptyReturns(nodes))
  if (!list.length) return { ok: false, message: '请至少添加一个路线节点' }
  const mains = list.filter((n) => n.pathKind === ROUTE_PATH_MAIN)
  if (!mains.length) return { ok: false, message: '请至少有一个主线节点' }
  // 允许空占位格；至少一格已选工序
  const filled = list.filter((n) => n.processId)
  if (!filled.length) return { ok: false, message: '请至少为一条主线格选择工序' }

  const byId = new Map(list.map((n) => [n.id, n]))
  // 同支线多节点：汇入要求「首格」填写（汇合线从首格竖直落下）
  const branchHeadIds = new Set(
    groupBranchLines(list)
      .map((line) => line.nodes[0]?.id)
      .filter(Boolean),
  )

  for (const n of filled) {
    if (!n.name) n.name = n.processId
    if (n.pathKind === ROUTE_PATH_BRANCH) {
      if (!n.branchName) return { ok: false, message: `支线节点「${n.name}」请填写支线名称` }
      if (!n.forkAfterNodeId || !byId.has(n.forkAfterNodeId)) {
        return { ok: false, message: `支线「${n.branchName}」请选择分出节点` }
      }
      const fork = byId.get(n.forkAfterNodeId)
      // 允许从主线 / 支线 / 汇合点分出（支线再分出下级支线）
      if (fork.id === n.id) {
        return { ok: false, message: `支线「${n.branchName}」不能从自身分出` }
      }
      // 禁止分出环：沿 fork 链向上不能回到自己
      let walk = fork
      const seen = new Set([n.id])
      while (walk && walk.pathKind === ROUTE_PATH_BRANCH) {
        if (seen.has(walk.id)) {
          return { ok: false, message: `支线「${n.branchName}」的分出关系存在环路` }
        }
        seen.add(walk.id)
        walk = byId.get(walk.forkAfterNodeId)
      }
      if (branchHeadIds.has(n.id)) {
        const hasSink = list.some((x) => x.pathKind === ROUTE_PATH_SINK)
        // 画布尚无汇合点时允许暂不填汇入；有汇合点则首格必须填
        if (hasSink && (!n.joinToNodeId || !byId.has(n.joinToNodeId))) {
          return { ok: false, message: `支线「${n.branchName}」请选择汇入节点` }
        }
        if (n.joinToNodeId && !byId.has(n.joinToNodeId)) {
          return { ok: false, message: `支线「${n.branchName}」的汇入节点无效` }
        }
        if (n.joinToNodeId === n.id) {
          return { ok: false, message: `支线「${n.branchName}」不能汇入自身` }
        }
      }
    }
    // 主线若填了汇入，目标须存在且非自身
    if (n.pathKind === ROUTE_PATH_MAIN && n.joinToNodeId) {
      if (!byId.has(n.joinToNodeId)) {
        return { ok: false, message: `主线「${n.name}」的汇入节点无效` }
      }
      if (n.joinToNodeId === n.id) {
        return { ok: false, message: `主线「${n.name}」不能汇入自身` }
      }
    }
  }
  return { ok: true, nodes: list }
}

/** 汇总拓扑路线候选设备；可按 processId 过滤 */
export function collectTopologyEquipmentIds(nodes, processId = '') {
  const ids = []
  const seen = new Set()
  const push = (id) => {
    const equipmentId = String(id || '').trim()
    if (!equipmentId || seen.has(equipmentId)) return
    seen.add(equipmentId)
    ids.push(equipmentId)
  }
  normalizeRouteNodes(nodes).forEach((n) => {
    if (!n.processId) return
    if (processId && n.processId !== processId) return
    ;(n.equipmentIds || []).forEach(push)
  })
  return ids
}

/** 列表/详情用的拓扑摘要 */
export function formatTopologySummary(nodes) {
  const list = normalizeRouteNodes(nodes)
  const main = list.filter((n) => n.pathKind === ROUTE_PATH_MAIN)
  const branches = list.filter((n) => n.pathKind === ROUTE_PATH_BRANCH)
  const sinks = list.filter((n) => n.pathKind === ROUTE_PATH_SINK)
  const mainText = main.map((n) => n.name || '节点').join(' → ') || '—'
  const sinkById = new Map(sinks.map((s) => [s.id, s]))
  const mainById = new Map(main.map((m) => [m.id, m]))
  const branchParts = []
  const byBranch = new Map()
  branches.forEach((b) => {
    const key = b.branchName || b.id
    if (!byBranch.has(key)) byBranch.set(key, [])
    byBranch.get(key).push(b)
  })
  byBranch.forEach((rows, name) => {
    const chain = rows.map((r) => r.name || '节点').join(' → ')
    const joinId = rows[rows.length - 1]?.joinToNodeId
    const join =
      sinkById.get(joinId)?.name || mainById.get(joinId)?.name || (joinId ? '汇合点' : '线末')
    branchParts.push(`${name}:${chain}→${join}`)
  })
  const sinkText = sinks.map((s) => s.name).join('、')
  const parts = [`主线：${mainText}`]
  if (branchParts.length) parts.push(`支线：${branchParts.join('；')}`)
  if (sinkText) parts.push(`汇合：${sinkText}`)
  return parts.join('。')
}

/**
 * 预览数据结构：主线、支线（带分出/汇入展示名）、汇合点
 */
export function buildRouteTopologyPreview(nodes) {
  const list = normalizeRouteNodes(nodes)
  const main = list.filter((n) => n.pathKind === ROUTE_PATH_MAIN)
  const sinks = list.filter((n) => n.pathKind === ROUTE_PATH_SINK)
  const branches = list.filter((n) => n.pathKind === ROUTE_PATH_BRANCH)
  const byId = new Map(list.map((n) => [n.id, n]))
  return {
    main,
    sinks,
    branches: branches.map((b) => ({
      ...b,
      forkLabel: byId.get(b.forkAfterNodeId)?.name || '—',
      joinLabel: byId.get(b.joinToNodeId)?.name || '—',
    })),
  }
}

/** 从拓扑节点生成 units（设备去重顺序） */
export function unitsFromTopologyNodes(nodes) {
  return collectTopologyEquipmentIds(nodes).map((equipmentId) => ({ equipmentId }))
}

/**
 * 拓扑 → 工单下发工序快照（主线顺序；支线/汇合点跟在主线后按 seq）
 * 离散工单仍用「列表工序」，不跑支线汇合引擎。
 * 带上按化验方案合并后的 assaySchemes / 门禁，供质检触发使用。
 */
export function buildWorkOrderProcessesFromTopology(nodes, routeId = '', resolveProcess) {
  const list = normalizeRouteNodes(pruneEmptyReturns(nodes))
  const ordered = [
    ...list.filter((n) => n.pathKind === ROUTE_PATH_MAIN),
    ...list.filter((n) => n.pathKind !== ROUTE_PATH_MAIN),
  ]
  return ordered.map((n, index) => {
    const proc =
      typeof resolveProcess === 'function' && n.processId ? resolveProcess(n.processId) : null
    const assaySchemes = resolveAssaySchemesForRouteNode(proc, n)
    const hasHard = assaySchemes.some((s) => s.gateMode === 'hard' || s.hardGate)
    // 旧整格 qcOverride：仅当没有任何方案覆盖且整格为 off 时仍透传
    const routeQcOverride =
      Array.isArray(n.assayOverrides) && n.assayOverrides.length
        ? assaySchemes.length
          ? 'inherit'
          : 'off'
        : n.qcOverride === 'off'
          ? 'off'
          : 'inherit'
    return {
      id: `${routeId || 'route'}-topo-${n.id}`,
      index: index + 1,
      stepNo: index + 1,
      rowNo: 1,
      completionMode: 'all',
      includeInDispatch: n.pathKind === ROUTE_PATH_MAIN,
      name: n.name,
      processId: n.processId,
      equipmentIds: [...(n.equipmentIds || [])],
      pathKind: n.pathKind,
      assaySchemes,
      gateMode: hasHard ? 'hard' : 'record',
      routeQcOverride,
      assayOverrides: normalizeAssayOverrides(n.assayOverrides),
    }
  })
}
