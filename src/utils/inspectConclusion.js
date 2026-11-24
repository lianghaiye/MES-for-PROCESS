/**
 * 检验结论展示口径固定：合格 / 不合格 / 让步 / —
 * 不与放行状态（已放行、待回用等）混用。
 */
export const INSPECT_CONCLUSION = {
  PASS: '合格',
  FAIL: '不合格',
  CONCESSION: '让步',
  EMPTY: '—',
}

export function displayInspectConclusion(raw) {
  const text = String(raw || '').trim()
  if (!text || text === '—') return INSPECT_CONCLUSION.EMPTY
  if (/让步|concession|部分通过|PARTIAL/i.test(text)) return INSPECT_CONCLUSION.CONCESSION
  if (/不通过|不合格|拒收|FAIL|rejected/i.test(text)) return INSPECT_CONCLUSION.FAIL
  if (/通过|合格|PASS|released/i.test(text) && !/不/.test(text)) return INSPECT_CONCLUSION.PASS
  return INSPECT_CONCLUSION.EMPTY
}

export function inspectConclusionColor(value) {
  const text = displayInspectConclusion(value)
  if (text === INSPECT_CONCLUSION.PASS) return 'success'
  if (text === INSPECT_CONCLUSION.FAIL) return 'error'
  if (text === INSPECT_CONCLUSION.CONCESSION) return 'warning'
  return 'default'
}
