import dayjs from 'dayjs'
import {
  createProcessLibraryField,
  mockProcessLibraryFields,
  processLibraryFieldToTemplateField,
  QC_FIELD_VALUE_SOURCE,
  PROCESS_FORM_SYSTEM_KEYS,
} from '@/mock/processFieldLibrary'

function nowText() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss')
}

function fieldFromCode(code, patch = {}) {
  const lib =
    mockProcessLibraryFields.find(
      (f) =>
        String(f.code || '')
          .trim()
          .toUpperCase() === String(code).trim().toUpperCase(),
    ) ||
    createProcessLibraryField({
      code,
      name: patch.name || code,
      type: patch.type || 'text',
      ...patch,
    })
  return { ...processLibraryFieldToTemplateField(lib), ...patch }
}

export function createProcessFormTemplate(partial = {}) {
  const fields = Array.isArray(partial.fields)
    ? partial.fields.map((f, idx) => ({
        ...f,
        sortOrder: f.sortOrder ?? idx + 1,
        valueSource:
          f.valueSource === QC_FIELD_VALUE_SOURCE.SYSTEM
            ? QC_FIELD_VALUE_SOURCE.SYSTEM
            : QC_FIELD_VALUE_SOURCE.MANUAL,
        systemKey: String(f.systemKey || '').trim(),
      }))
    : []
  return {
    id: partial.id || `pft-${Date.now()}`,
    code: String(partial.code || '').trim(),
    name: String(partial.name || '').trim(),
    status: partial.status === '停用' ? '停用' : '启用',
    remark: partial.remark || '',
    fields,
    fieldCount: fields.length,
    creator: partial.creator || 'admin1',
    createdAt: partial.createdAt || nowText(),
    updater: partial.updater || partial.creator || 'admin1',
    updatedAt: partial.updatedAt || partial.createdAt || nowText(),
  }
}

/** 工序表单模板种子：指标来自工序指标库 */
export function createProcessFormTemplateSeed() {
  const t = nowText()
  return [
    createProcessFormTemplate({
      id: 'pft-feed',
      code: 'PFT-FEED-001',
      name: '投料记录',
      status: '启用',
      remark: '投料工序过程记录；实投量/含量在投料过账中填写，不在此模板采集',
      fields: [
        fieldFromCode('OP_OPERATOR', {
          required: true,
          valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
          systemKey: PROCESS_FORM_SYSTEM_KEYS.OPERATOR,
          sortOrder: 1,
        }),
        fieldFromCode('OP_OPERATED_AT', {
          required: true,
          valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
          systemKey: PROCESS_FORM_SYSTEM_KEYS.OPERATED_AT,
          sortOrder: 2,
        }),
        fieldFromCode('OP_BATCH_NO', {
          required: false,
          valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
          systemKey: PROCESS_FORM_SYSTEM_KEYS.BATCH_NO,
          sortOrder: 3,
        }),
        fieldFromCode('OP_EQUIPMENT', {
          required: false,
          valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
          systemKey: PROCESS_FORM_SYSTEM_KEYS.EQUIPMENT,
          sortOrder: 4,
        }),
        fieldFromCode('OP_OUTPUT_QTY', { required: false, sortOrder: 5 }),
        fieldFromCode('OP_REMARK', { required: false, sortOrder: 6 }),
      ],
      creator: '系统管理员',
      createdAt: t,
      updater: '系统管理员',
      updatedAt: t,
    }),
    createProcessFormTemplate({
      id: 'pft-react',
      code: 'PFT-REACT-001',
      name: '反应记录',
      status: '启用',
      remark: '升温/保温默认采集',
      fields: [
        fieldFromCode('OP_OPERATOR', {
          required: true,
          valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
          systemKey: PROCESS_FORM_SYSTEM_KEYS.OPERATOR,
          sortOrder: 1,
        }),
        fieldFromCode('OP_OPERATED_AT', {
          required: true,
          valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
          systemKey: PROCESS_FORM_SYSTEM_KEYS.OPERATED_AT,
          sortOrder: 2,
        }),
        fieldFromCode('OP_EQUIPMENT', {
          required: false,
          valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
          systemKey: PROCESS_FORM_SYSTEM_KEYS.EQUIPMENT,
          sortOrder: 3,
        }),
        fieldFromCode('OP_OUTPUT_QTY', { required: false, sortOrder: 4 }),
        fieldFromCode('OP_REMARK', { required: false, sortOrder: 5 }),
      ],
      creator: '系统管理员',
      createdAt: t,
      updater: '系统管理员',
      updatedAt: t,
    }),
    createProcessFormTemplate({
      id: 'pft-separate',
      code: 'PFT-SEP-001',
      name: '分离记录',
      status: '启用',
      remark: '过滤/离心/灌装默认采集',
      fields: [
        fieldFromCode('OP_OPERATOR', {
          required: true,
          valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
          systemKey: PROCESS_FORM_SYSTEM_KEYS.OPERATOR,
          sortOrder: 1,
        }),
        fieldFromCode('OP_OPERATED_AT', {
          required: true,
          valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
          systemKey: PROCESS_FORM_SYSTEM_KEYS.OPERATED_AT,
          sortOrder: 2,
        }),
        fieldFromCode('OP_EQUIPMENT', {
          required: false,
          valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
          systemKey: PROCESS_FORM_SYSTEM_KEYS.EQUIPMENT,
          sortOrder: 3,
        }),
        fieldFromCode('OP_OUTPUT_QTY', { required: false, sortOrder: 4 }),
        fieldFromCode('OP_REMARK', { required: false, sortOrder: 5 }),
      ],
      creator: '系统管理员',
      createdAt: t,
      updater: '系统管理员',
      updatedAt: t,
    }),
  ]
}
