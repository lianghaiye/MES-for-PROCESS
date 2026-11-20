/**
 * 质检任务 mock（来料质检等）
 */
import dayjs from 'dayjs'
import {
  cloneUniversalSystemTemplateFields,
  QC_SYSTEM_UNIVERSAL_TEMPLATE_CODE,
} from '@/mock/qcSystemTemplateFields'
import { mockQcTemplates } from '@/mock/qcTemplates'
import {
  normalizeSheetConclusionOptionItems,
  upsertSheetConclusionField,
} from '@/utils/qcConclusionField'
import { normalizeSheetPassRule } from '@/utils/qcTemplateSheetPass'

const SYSTEM_FIELDS = () =>
  cloneUniversalSystemTemplateFields().map((f) => ({
    ...f,
    options: f.options ? [...f.options] : [],
  }))

function cloneFields(fields = []) {
  return (fields || []).map((f) => ({
    ...f,
    options: f.options ? [...f.options] : [],
    optionItems: f.optionItems ? f.optionItems.map((o) => ({ ...o })) : undefined,
    optionResults: f.optionResults ? { ...f.optionResults } : undefined,
    children: Array.isArray(f.children) ? f.children.map((c) => ({ ...c })) : [],
    matrixColumns: Array.isArray(f.matrixColumns) ? f.matrixColumns.map((c) => ({ ...c })) : [],
    matrixRows: Array.isArray(f.matrixRows) ? f.matrixRows.map((r) => ({ ...r })) : [],
  }))
}

function findTpl(code) {
  return mockQcTemplates.find((t) => t.code === code) || null
}

/** 按模板冻结字段、整单规则与结论选项（避免录入时串成「人工判定」默认行为） */
function lineWithTemplate(partial = {}, templateCode) {
  const tpl = findTpl(templateCode)
  const sheetConclusionOptionItems = normalizeSheetConclusionOptionItems(
    tpl?.sheetConclusionOptionItems,
  )
  const fields = tpl
    ? cloneFields(upsertSheetConclusionField(tpl.fields || [], sheetConclusionOptionItems))
    : SYSTEM_FIELDS()
  const methodField = fields.find((f) => f.code === 'QC_INSPECT_METHOD')
  return line({
    ...partial,
    templateId: tpl?.id || '',
    templateCode: tpl?.code || QC_SYSTEM_UNIVERSAL_TEMPLATE_CODE,
    templateName: tpl?.name || '系统通用模板',
    templateFields: fields,
    sheetPassRule: normalizeSheetPassRule(tpl?.sheetPassRule),
    sheetConclusionOptionItems: sheetConclusionOptionItems.map((o) => ({ ...o })),
    inspectMethod: partial.inspectMethod || methodField?.defaultValue || '抽检',
  })
}

function line(partial = {}) {
  return {
    id: partial.id || `qtl-mock-${Math.random().toString(36).slice(2, 8)}`,
    itemCode: partial.itemCode || '',
    itemName: partial.itemName || '',
    productCode: partial.productCode || partial.itemCode || '',
    productName: partial.productName || partial.itemName || '',
    specModel: partial.specModel || '',
    material: partial.material || '',
    variantSummary: partial.variantSummary || '',
    unit: partial.unit || '件',
    purchaseQty: partial.purchaseQty,
    receiptQty: partial.receiptQty ?? partial.inspectQty ?? 0,
    inspectQty: partial.inspectQty ?? partial.receiptQty ?? 0,
    inspectMethod: partial.inspectMethod || '',
    receivingWarehouse: partial.receivingWarehouse || '',
    sourceLineId: partial.sourceLineId || '',
    lineQcResult: partial.lineQcResult || '',
    treatmentPlan: partial.treatmentPlan || '',
    fieldValues: Array.isArray(partial.fieldValues) ? [...partial.fieldValues] : [],
    templateId: partial.templateId || '',
    templateCode: partial.templateCode || '',
    templateName: partial.templateName || '',
    ...partial,
    sheetPassRule: normalizeSheetPassRule(partial.sheetPassRule),
    sheetConclusionOptionItems: Array.isArray(partial.sheetConclusionOptionItems)
      ? partial.sheetConclusionOptionItems.map((o) => ({ ...o }))
      : normalizeSheetConclusionOptionItems(partial.sheetConclusionOptionItems),
    templateFields: Array.isArray(partial.templateFields)
      ? cloneFields(partial.templateFields)
      : partial.templateFields || [],
  }
}

function task(partial = {}) {
  const bizScope = partial.bizScope || '来料质检'
  const lineItems = Array.isArray(partial.lineItems) ? partial.lineItems.map((l) => line(l)) : []
  const names = [...new Set(lineItems.map((l) => l.templateName).filter(Boolean))]
  const multiTemplate = names.length > 1
  const fields = Array.isArray(partial.templateFields)
    ? partial.templateFields.map((f) => ({ ...f, options: f.options ? [...f.options] : [] }))
    : multiTemplate
      ? []
      : lineItems[0]?.templateFields?.length
        ? cloneFields(lineItems[0].templateFields)
        : SYSTEM_FIELDS()
  return {
    id: partial.id,
    qcNo: partial.qcNo,
    bizScope,
    qcStatus: partial.qcStatus || '待质检',
    qcResult: partial.qcResult || '',
    multiTemplate: partial.multiTemplate != null ? partial.multiTemplate : multiTemplate,
    templateId:
      partial.templateId || (multiTemplate ? '' : lineItems[0]?.templateId || 'qct-sys-universal'),
    templateCode:
      partial.templateCode ||
      (multiTemplate
        ? [...new Set(lineItems.map((l) => l.templateCode).filter(Boolean))].join('、')
        : lineItems[0]?.templateCode || QC_SYSTEM_UNIVERSAL_TEMPLATE_CODE),
    templateName:
      partial.templateName ||
      (multiTemplate ? '多模板' : lineItems[0]?.templateName || '系统通用模板'),
    gatePolicy: partial.gatePolicy || 'hard',
    inspectMethod: partial.inspectMethod || (multiTemplate ? '' : '抽检'),
    inspectDate: partial.inspectDate || dayjs().format('YYYY-MM-DD'),
    sourceType: partial.sourceType || 'purchase_receipt',
    sourceDocNo: partial.sourceDocNo || '',
    sourceDocId: partial.sourceDocId || '',
    itemCode: partial.itemCode || '',
    itemName: partial.itemName || '',
    specModel: partial.specModel || '',
    unit: partial.unit || '件',
    supplier: partial.supplier || '',
    workCenter: partial.workCenter || '',
    processRouteName: partial.processRouteName || '',
    scheduleQty: partial.scheduleQty ?? null,
    workOrderNo: partial.workOrderNo || '',
    workOrderId: partial.workOrderId || '',
    processCode: partial.processCode || '',
    processName: partial.processName || '',
    processIndex: partial.processIndex ?? null,
    scheduleBatchId: partial.scheduleBatchId || '',
    scheduleBatchNo: partial.scheduleBatchNo ?? null,
    inboundOrderNo: partial.inboundOrderNo || '',
    inboundOrderId: partial.inboundOrderId || '',
    inboundOrderIds: Array.isArray(partial.inboundOrderIds) ? [...partial.inboundOrderIds] : [],
    entryChannel: partial.entryChannel || '',
    inspector: partial.inspector || '',
    inspectedAt: partial.inspectedAt || '',
    creator: partial.creator || 'admin1',
    remark: partial.remark || '',
    treatmentPlan: partial.treatmentPlan || '',
    lineItems,
    templateFields: fields,
    createdAt: partial.createdAt || '2026-08-28 10:00:00',
    updatedAt: partial.updatedAt || partial.createdAt || '2026-08-28 10:00:00',
  }
}

/** 流程型质检演示单据 */
export const mockIncomingQcTasks = [
  task({
    id: 'qctask-proc-ll-1',
    qcNo: `LLZJ${dayjs().format('YYYYMMDD')}001`,
    bizScope: '来料质检',
    qcStatus: '待质检',
    supplier: '原料供应商A',
    itemName: '树脂原料',
    itemCode: 'RM-RESIN-01',
    unit: 'kg',
    remark: '流程演示：原料来料检',
    lineItems: [
      lineWithTemplate(
        {
          id: 'qtl-proc-ll-1',
          itemCode: 'RM-RESIN-01',
          itemName: '树脂原料',
          unit: 'kg',
          receiptQty: 500,
          inspectQty: 5,
        },
        'QCT-PROC-LL-001',
      ),
    ],
  }),
  task({
    id: 'qctask-proc-sep-1',
    qcNo: `GCZJ${dayjs().format('YYYYMMDD')}001`,
    bizScope: '生产过程检',
    qcStatus: '待质检',
    workCenter: '分离车间',
    processRouteName: '标准湿法主线',
    processName: '过滤',
    itemName: '示范湿法成品',
    itemCode: 'CP-PROC-001',
    unit: 'kg',
    remark: '流程演示：过滤过程检',
    lineItems: [
      lineWithTemplate(
        {
          id: 'qtl-proc-sep-1',
          itemCode: 'CP-PROC-001',
          itemName: '示范湿法成品',
          unit: 'kg',
          receiptQty: 200,
          inspectQty: 2,
        },
        'QCT-PROC-SEP-001',
      ),
    ],
  }),
  task({
    id: 'qctask-proc-fg-1',
    qcNo: `CPZJ${dayjs().format('YYYYMMDD')}001`,
    bizScope: '成品检',
    qcStatus: '待质检',
    itemName: '示范湿法成品',
    itemCode: 'CP-PROC-001',
    unit: 'kg',
    remark: '流程演示：湿法成品检',
    lineItems: [
      lineWithTemplate(
        {
          id: 'qtl-proc-fg-1',
          itemCode: 'CP-PROC-001',
          itemName: '示范湿法成品',
          unit: 'kg',
          receiptQty: 180,
          inspectQty: 3,
        },
        'QCT-PROC-FG-001',
      ),
    ],
  }),
]

export function cloneMockIncomingQcTasks() {
  return JSON.parse(JSON.stringify(mockIncomingQcTasks))
}
