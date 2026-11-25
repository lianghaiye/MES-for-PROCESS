/** 批次/单据有效含量：内部按 0~1 小数存储，界面按百分比展示。 */

export function contentToPct(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.abs(n) <= 1 ? n * 100 : n
}

export function contentPctToFraction(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || !(n > 0)) return null
  return Math.abs(n) <= 1 ? n : n / 100
}

/** 展示用：98.5% / — ；最多 4 位小数、不补尾零 */
export function formatContentPctText(value) {
  const pct = contentToPct(value)
  if (pct == null || !Number.isFinite(pct)) return '—'
  return `${Number(pct.toFixed(4))}%`
}

export function normalizeContentFraction(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || !(n > 0)) return null
  return Math.abs(n) <= 1 ? n : n / 100
}
