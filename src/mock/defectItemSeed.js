/** 不良品项种子数据 */
export function normalizeDefectItem(item = {}) {
  const affectWageDiscount = Boolean(item.affectWageDiscount)
  let wageCalculationMethod = item.wageCalculationMethod || ''
  const wageDiscountRate =
    item.wageDiscountRate != null && item.wageDiscountRate !== ''
      ? Number(item.wageDiscountRate)
      : null
  const fixedDeductionAmount =
    item.fixedDeductionAmount != null && item.fixedDeductionAmount !== ''
      ? Number(item.fixedDeductionAmount)
      : null

  if (affectWageDiscount && !wageCalculationMethod) {
    wageCalculationMethod = wageDiscountRate != null ? '打折计工资' : '全额计工资'
  }
  if (!affectWageDiscount) {
    wageCalculationMethod = ''
  }

  return {
    id: item.id,
    code: item.code || '',
    name: item.name || '',
    affectWageDiscount,
    responsibility: item.responsibility || '',
    wageCalculationMethod,
    wageDiscountRate:
      affectWageDiscount && wageCalculationMethod === '打折计工资' ? wageDiscountRate : null,
    fixedDeductionAmount:
      affectWageDiscount && wageCalculationMethod === '固定扣款金额' ? fixedDeductionAmount : null,
    description: item.description || '',
    createdAt: item.createdAt || '',
  }
}

export function createDefectItemSeed() {
  return [
    normalizeDefectItem({
      id: 'di-1',
      code: 'qita',
      name: '其他',
      affectWageDiscount: false,
      responsibility: '非工人责任',
      description: '其他未归类不良',
      createdAt: '2025-12-31',
    }),
    normalizeDefectItem({
      id: 'di-2',
      code: 'BL-PROC-001',
      name: 'pH超标',
      affectWageDiscount: true,
      responsibility: '工人责任',
      wageCalculationMethod: '打折计工资',
      wageDiscountRate: 80,
      description: '过程/成品 pH 超出标准区间',
      createdAt: '2026-11-01',
    }),
    normalizeDefectItem({
      id: 'di-3',
      code: 'BL-PROC-002',
      name: '固含量不合格',
      affectWageDiscount: true,
      responsibility: '工人责任',
      wageCalculationMethod: '打折计工资',
      wageDiscountRate: 75,
      description: '固含量偏离配方要求',
      createdAt: '2026-11-01',
    }),
    normalizeDefectItem({
      id: 'di-4',
      code: 'BL-PROC-003',
      name: '滤液浑浊',
      affectWageDiscount: false,
      responsibility: '工人责任',
      description: '过滤后滤液浑浊',
      createdAt: '2026-11-01',
    }),
    normalizeDefectItem({
      id: 'di-5',
      code: 'BL-PROC-004',
      name: '水分超标',
      affectWageDiscount: true,
      responsibility: '部分责任',
      wageCalculationMethod: '打折计工资',
      wageDiscountRate: 60,
      description: '成品水分超出上限',
      createdAt: '2026-11-01',
    }),
    normalizeDefectItem({
      id: 'di-6',
      code: 'BL-PROC-005',
      name: '密度异常',
      affectWageDiscount: true,
      responsibility: '工人责任',
      wageCalculationMethod: '打折计工资',
      wageDiscountRate: 50,
      description: '料液密度偏离工艺窗口',
      createdAt: '2026-11-01',
    }),
    normalizeDefectItem({
      id: 'di-7',
      code: 'BL-PROC-006',
      name: '外观不合格',
      affectWageDiscount: true,
      responsibility: '非工人责任',
      wageCalculationMethod: '全额计工资',
      description: '色泽/杂质等外观项不合格',
      createdAt: '2026-11-01',
    }),
    normalizeDefectItem({
      id: 'di-8',
      code: 'BL-PROC-007',
      name: '温度偏离',
      affectWageDiscount: false,
      responsibility: '非工人责任',
      description: '升温/保温温度偏离设定',
      createdAt: '2026-11-01',
    }),
    normalizeDefectItem({
      id: 'di-9',
      code: 'BL-PROC-008',
      name: '泄漏/跑料',
      affectWageDiscount: true,
      responsibility: '工人责任',
      wageCalculationMethod: '固定扣款金额',
      fixedDeductionAmount: 5,
      description: '转罐/过滤跑料',
      createdAt: '2026-11-01',
    }),
  ]
}

/** 工序名称 → 不良品项 id 映射（流程型） */
export const PROCESS_DEFECT_ITEM_MAP = {
  投料: ['di-1', 'di-2', 'di-6'],
  升温: ['di-1', 'di-8'],
  保温: ['di-1', 'di-8'],
  过滤: ['di-3', 'di-4', 'di-9'],
  离心: ['di-3', 'di-5', 'di-6'],
  灌装: ['di-5', 'di-7'],
  转罐: ['di-1', 'di-9'],
}

export const PROCESS_REPORT_MODE_MAP = {
  投料: '批量计件',
  升温: '时长报工',
  保温: '时长报工',
  过滤: '批量计件',
  离心: '批量计件',
  灌装: '批量计件',
  转罐: '时长报工',
}
