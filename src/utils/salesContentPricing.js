/** 销售计价：按档次一口价 / 按含量计价。含量用百分数，98.5 表示 98.5%。 */

export const SALES_PRICING_MODE = {
  FLAT: 'flat',
  CONTENT: 'content',
}

export const SALES_PRICING_MODE_OPTIONS = [
  { value: SALES_PRICING_MODE.FLAT, label: '按档次一口价' },
  { value: SALES_PRICING_MODE.CONTENT, label: '按含量计价' },
]

export function isContentPricing(line) {
  return line?.pricingMode === SALES_PRICING_MODE.CONTENT
}

/** 批次含量可能是 0.986，订单上写的是 98.6。大于 1 视为已经是百分数。 */
export function toContentPercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n <= 1) return round4(n * 100)
  return round4(n)
}

export function formatPricingRule(line) {
  if (!line) return '—'
  if (!isContentPricing(line)) return '按档次一口价'
  const base = toContentPercent(line.baseContent)
  const step = Number(line.contentStep)
  const up = Number(line.priceStepUp)
  const down = Number(line.priceStepDown)
  const baseText = base == null ? '基准含量未填' : `基准 ${base}%`
  const stepText = step > 0 ? `每 ${step}%` : '档距未填'
  const upText = Number.isFinite(up) ? `加 ${up}` : '加 —'
  const downText = Number.isFinite(down) ? `减 ${down}` : '减 —'
  return `${baseText}，${stepText} ${upText}、${downText}（不含税）`
}

/**
 * 结算不含税单价 = 基准单价 + 档数 × 每档加减。
 * 高出按 priceStepUp，低出按 priceStepDown，两者都填正数。
 */
export function calcContentUnitPrice({ basePrice, baseContent, content, step, up, down }) {
  const base = Number(basePrice) || 0
  const basePct = toContentPercent(baseContent)
  const actual = toContentPercent(content)
  const stepPct = Number(step)
  if (basePct == null || actual == null || !(stepPct > 0)) return round4(base)
  const steps = Math.round(((actual - basePct) / stepPct) * 1e6) / 1e6
  if (Math.abs(steps) < 1e-9) return round4(base)
  const per = steps > 0 ? Number(up) || 0 : Number(down) || 0
  return round4(base + steps * per)
}

export function emptySettlementLot() {
  return {
    key: `lot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    batchId: undefined,
    batchNo: '',
    content: null,
    weighQty: null,
  }
}

export function contentSettlementReady(line) {
  if (!isContentPricing(line)) return true
  const lots = Array.isArray(line?.settlementLots) ? line.settlementLots : []
  if (!lots.length) return false
  return lots.every((lot) => toContentPercent(lot.content) != null && Number(lot.weighQty) > 0)
}

export function settleContentLots(line, lots = line?.settlementLots) {
  const baseEx = Number(line?.baseUnitPriceExTax ?? line?.unitPriceExTax) || 0
  const taxRate = Number(line?.taxRate) || 0
  const rows = (Array.isArray(lots) ? lots : []).map((lot) => {
    const weigh = round4(lot.weighQty)
    const content = toContentPercent(lot.content)
    const unitEx = calcContentUnitPrice({
      basePrice: baseEx,
      baseContent: line?.baseContent,
      content,
      step: line?.contentStep,
      up: line?.priceStepUp,
      down: line?.priceStepDown,
    })
    const unitIn = round4(unitEx * (1 + taxRate / 100))
    return {
      ...lot,
      content,
      weighQty: weigh,
      unitPriceExTax: unitEx,
      unitPriceInTax: unitIn,
      amountExTax: round4(weigh * unitEx),
      amountInTax: round4(weigh * unitIn),
    }
  })
  const weighSum = round4(rows.reduce((sum, row) => sum + (Number(row.weighQty) || 0), 0))
  const amountEx = round4(rows.reduce((sum, row) => sum + (Number(row.amountExTax) || 0), 0))
  const amountIn = round4(rows.reduce((sum, row) => sum + (Number(row.amountInTax) || 0), 0))
  const text = rows
    .map((row) => {
      const no = row.batchNo ? `${row.batchNo} ` : ''
      return `${no}${row.content}% × ${row.weighQty}`
    })
    .join('；')
  return {
    rows,
    weighSum,
    amountEx,
    amountIn,
    unitEx: weighSum > 0 ? round4(amountEx / weighSum) : round4(baseEx),
    unitIn: weighSum > 0 ? round4(amountIn / weighSum) : round4(baseEx * (1 + taxRate / 100)),
    text,
  }
}

/** 按 800 公斤/袋把吨重折成袋数。单位不是吨时不折。 */
export function bagCountFromTons(qty, unit) {
  const u = String(unit || '')
    .trim()
    .toLowerCase()
  if (u !== '吨' && u !== 't' && u !== 'ton') return null
  const tons = Number(qty)
  if (!(tons > 0)) return null
  return round4((tons * 1000) / 800)
}

function round4(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 10000) / 10000
}
