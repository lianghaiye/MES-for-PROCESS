/** 流程型批次：取整、投料、得率。纯函数，不依赖页面。 */

export function round3(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000
}

/**
 * 计划剩余目标拆成指令。整批等于基准批量。
 * ceil 关闭时余数单独一张；开启时最后一张按基准批量向上取整。
 * 没有基准批量时，剩余量合成一张。
 */
export function splitPlanFeedQty(remaining, baseBatchQty, { ceil = false } = {}) {
  const left = round3(remaining)
  if (!(left > 0)) return []
  const base = round3(baseBatchQty)
  if (!(base > 0)) return [{ qty: left, remainder: false }]
  const rows = []
  let used = 0
  while (used + base <= left + 1e-9) {
    rows.push({ qty: base, remainder: false })
    used = round3(used + base)
  }
  const rest = round3(left - used)
  if (rest > 0) rows.push({ qty: ceil ? base : rest, remainder: !ceil })
  return rows
}

/** 批次数 = ceil(需求 / 基准批量)。每一批都是完整基准批量。 */
export function planBatchCount(demandQty, baseBatchQty) {
  const demand = Number(demandQty)
  const base = Number(baseBatchQty)
  if (!(demand > 0) || !(base > 0)) return 0
  return Math.ceil(demand / base - 1e-9)
}

/**
 * 一行理论投料。投料量与配比二选一。
 * 按含量折算时再除以含量。
 */
export function calcTheoreticalFeed(line, baseBatchQty) {
  const loss = Number(line?.lossRate) || 0
  const feedQty = line?.feedQty
  const ratio = line?.ratio
  const hasQty = feedQty !== '' && feedQty != null && Number(feedQty) > 0
  const hasRatio = ratio !== '' && ratio != null && Number(ratio) > 0
  if (hasQty === hasRatio) {
    return { ok: false, message: hasQty ? '投料量和配比只能填一个' : '请填写投料量或配比' }
  }
  let qty = hasQty
    ? Number(feedQty) * (1 + loss)
    : Number(baseBatchQty) * Number(ratio) * (1 + loss)
  if (line.convertByContent) {
    const content = Number(line.content)
    if (!(content > 0)) return { ok: false, message: '按含量折算时含量必须大于 0' }
    qty /= content
  }
  if (!(qty > 0)) return { ok: false, message: '理论投料必须大于 0' }
  return { ok: true, qty: round3(qty) }
}

function positiveRatio(line) {
  const ratio = line?.ratio
  if (ratio === '' || ratio == null) return null
  const n = Number(ratio)
  return n > 0 ? n : null
}

/** 配比行合计（0～1）。投料量行不计入。 */
export function sumFeedRatios(lines) {
  const sum = (lines || []).reduce((total, line) => total + (positiveRatio(line) || 0), 0)
  return Math.round(sum * 10000) / 10000
}

/** 每一行都按配比、没有投料量时，合计必须是 1。 */
export function isRatioOnlyFormula(lines) {
  const rows = lines || []
  if (!rows.length) return false
  return rows.every((line) => positiveRatio(line) != null && !(Number(line.feedQty) > 0))
}

export function ratiosClosed(lines) {
  return Math.abs(sumFeedRatios(lines) - 1) < 0.0005
}

/**
 * 计划批量试算，不写回配方。
 * 配比行 = 计划批量 × 配比；投料量行保持填写的公斤数，不随计划批量变化。
 */
export function trialFeedQty(line, planQty) {
  const loss = Number(line?.lossRate) || 0
  const feedQty = line?.feedQty
  const hasQty = feedQty !== '' && feedQty != null && Number(feedQty) > 0
  const ratio = positiveRatio(line)
  if (hasQty === Boolean(ratio)) return null
  let qty = hasQty ? Number(feedQty) * (1 + loss) : Number(planQty) * ratio * (1 + loss)
  if (!(qty > 0)) return null
  if (line.convertByContent) {
    const content = Number(line.content)
    if (!(content > 0)) return null
    qty /= content
  }
  return round3(qty)
}

/** 投料小工具：克直接折公斤；毫升、升按密度（kg/L）折公斤。 */
export function convertToFeedKg(qty, unit, density) {
  const amount = Number(qty)
  if (!(amount > 0)) return null
  if (unit === 'g') return round3(amount / 1000)
  const rate = Number(density)
  if (!(rate > 0)) return null
  if (unit === 'mL') return round3((amount * rate) / 1000)
  if (unit === 'L') return round3(amount * rate)
  return null
}

export function theoreticalOutput(baseBatchQty, yieldRate) {
  const base = Number(baseBatchQty)
  const y = Number(yieldRate)
  if (!(base > 0) || !(y >= 0)) return 0
  return round3(base * y)
}

export function yieldGap(actual, theoretical) {
  return round3((Number(actual) || 0) - (Number(theoretical) || 0))
}

const ISSUE_OK = new Set(['released', '合格', '已放行'])

/** 旧库存批次没有状态时仍允许出库；有状态则必须合格且未过期。 */
export function isIssueAllowedBatch(batch, today) {
  if (!batch) return false
  const status = batch.qcStatus || batch.releaseStatus || batch.status
  if (status && !ISSUE_OK.has(status)) return false
  if (batch.expiryDate && today && String(batch.expiryDate) < today) return false
  return true
}

export function compareExpiry(a, b) {
  if (a?.expiryDate && b?.expiryDate)
    return String(a.expiryDate).localeCompare(String(b.expiryDate))
  if (a?.expiryDate) return -1
  if (b?.expiryDate) return 1
  return 0
}
