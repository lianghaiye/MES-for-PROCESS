/** 把执行中 / 待下发批次放到工艺路线的当前步骤上。 */
import { deviceLabelById } from '@/store/equipmentStore'
import { getProcessById } from '@/store/processConfigStore'

function orderProcessSteps(order, getFormula) {
  const snapshot = order?.routeSnapshot || []
  if (snapshot.length) return snapshot
  const routeSteps = order?.equipmentRoute?.steps || []
  if (routeSteps.length) return routeSteps
  const formula = order?.formulaId && getFormula ? getFormula(order.formulaId) : null
  return formula?.steps || []
}

function equipmentLabel(step) {
  if (step?.equipmentName) return step.equipmentName
  if (step?.equipmentId) return deviceLabelById(step.equipmentId) || ''
  const proc = step?.processId ? getProcessById(step.processId) : null
  const equipmentId = proc?.equipmentIds?.[0]
  return equipmentId ? deviceLabelById(equipmentId) || '' : ''
}

function stepName(step) {
  return step?.name || step?.processName || (step?.stepNo ? `第${step.stepNo}步` : '未命名工序')
}

export function currentProcessStep(order, getFormula) {
  const steps = [...orderProcessSteps(order, getFormula)].sort(
    (a, b) => Number(a.stepNo) - Number(b.stepNo),
  )
  if (!steps.length) return null
  const confirmed = new Set(
    (order?.confirmedSteps || []).map((step) =>
      Number(typeof step === 'object' ? step.stepNo : step),
    ),
  )
  const finished =
    order.status === 'done' || steps.every((step) => confirmed.has(Number(step.stepNo)))
  const current = finished
    ? steps[steps.length - 1]
    : steps.find((step) => !confirmed.has(Number(step.stepNo))) || steps[0]
  const index = steps.findIndex((step) => Number(step.stepNo) === Number(current.stepNo)) + 1
  return {
    stepNo: Number(current.stepNo),
    name: stepName(current),
    index,
    total: steps.length,
    pending: order.status === 'pending_release',
    text: `${order.status === 'pending_release' ? '未开始 · ' : ''}${stepName(current)} ${index}/${steps.length}`,
  }
}

function activeOrders(orders) {
  return (orders || []).filter(
    (order) => order.status === 'running' || order.status === 'pending_release',
  )
}

function boardFromSteps(key, title, steps, orders, getFormula) {
  const sorted = [...(steps || [])].sort((a, b) => Number(a.stepNo) - Number(b.stepNo))
  const nodes = sorted.map((step, index) => ({
    key: `${key}-${step.stepNo}-${index}`,
    stepNo: Number(step.stepNo),
    name: stepName(step),
    equipmentName: equipmentLabel(step),
    index: index + 1,
    total: sorted.length,
    batches: [],
  }))
  activeOrders(orders).forEach((order) => {
    const current = currentProcessStep(order, getFormula)
    const node =
      nodes.find((item) => item.stepNo === current?.stepNo) ||
      (order.status === 'pending_release' ? nodes[0] : nodes[nodes.length - 1])
    if (!node) return
    node.batches.push({
      id: order.id,
      batchNo: order.batchNo || '—',
      status: order.status,
      pending: order.status === 'pending_release',
    })
  })
  return { key, title, steps: nodes }
}

/** 按配方画出整条路线；没有执行中批次时各工序显示空闲。 */
export function buildFormulaRouteBoard(formula, orders, title, getFormula) {
  const lookup = getFormula || (() => formula)
  const sample = activeOrders(orders).find((order) => orderProcessSteps(order, lookup).length)
  const steps = sample ? orderProcessSteps(sample, lookup) : formula?.steps || []
  return boardFromSteps(
    formula?.id || 'line',
    title || formula?.name || '工艺路线',
    steps,
    orders,
    lookup,
  )
}

export function buildRouteBoards(orders, getFormula, lineTitle) {
  const groups = new Map()
  for (const order of activeOrders(orders)) {
    const key = order.formulaId || 'none'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(order)
  }
  return [...groups.entries()].map(([formulaId, list]) => {
    const formula = formulaId !== 'none' && getFormula ? getFormula(formulaId) : null
    const title = lineTitle ? lineTitle(formula) : formula?.name || '未关联配方'
    return buildFormulaRouteBoard(formula, list, title, getFormula)
  })
}
