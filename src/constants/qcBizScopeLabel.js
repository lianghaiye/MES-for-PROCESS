/**
 * 流程型展示名：内部 bizScope 取值不变（兼容已存数据/匹配），对外显示用化验向文案。
 */
export const QC_BIZ_SCOPE = {
  INCOMING: '来料质检',
  OUTSOURCING: '外协回货检',
  PROCESS: '生产过程检',
  FINISHED: '成品检',
  FACTORY: '出厂质检',
}

/** @type {Record<string, string>} */
export const QC_BIZ_SCOPE_LABEL = {
  来料质检: '来料化验',
  外协回货检: '外协回货化验',
  生产过程检: '过程化验',
  成品检: '产出化验',
  出厂质检: '出厂化验',
}

export function qcBizScopeLabel(bizScope) {
  const key = String(bizScope || '').trim()
  if (!key) return '—'
  return QC_BIZ_SCOPE_LABEL[key] || key
}

export function qcBizScopeSelectOptions(scopes = Object.keys(QC_BIZ_SCOPE_LABEL)) {
  return scopes.map((value) => ({
    value,
    label: qcBizScopeLabel(value),
  }))
}
