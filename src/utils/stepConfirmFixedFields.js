import { PROCESS_FORM_SYSTEM_KEYS, QC_FIELD_VALUE_SOURCE } from '@/mock/qcFieldLibrary'

/** 确认本步固定采集编码（不依赖过程记录模板）。 */
export const STEP_CONFIRM_FIXED_CODES = [
  'OP_OPERATOR',
  'OP_OPERATED_AT',
  'OP_EQUIPMENT',
  'OP_BATCH_NO',
  'OP_OUTPUT_QTY',
  'OP_REMARK',
]

const FIXED_SET = new Set(STEP_CONFIRM_FIXED_CODES)

export function isStepConfirmFixedFieldCode(code) {
  return FIXED_SET.has(
    String(code || '')
      .trim()
      .toUpperCase(),
  )
}

/** 固定项字段定义，供确认本步写入批记录。 */
export function stepConfirmFixedFieldDefs() {
  return [
    {
      code: 'OP_OPERATOR',
      name: '操作人',
      unit: '',
      required: true,
      // 可编辑：默认当前登录人，允许事后补录改写
      valueSource: QC_FIELD_VALUE_SOURCE.MANUAL,
      systemKey: '',
    },
    {
      code: 'OP_OPERATED_AT',
      name: '操作时间',
      unit: '',
      required: true,
      // 可编辑：默认打开时间，允许事后补录改写
      valueSource: QC_FIELD_VALUE_SOURCE.MANUAL,
      systemKey: '',
    },
    {
      code: 'OP_EQUIPMENT',
      name: '本格设备',
      unit: '',
      required: false,
      valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
      systemKey: PROCESS_FORM_SYSTEM_KEYS.EQUIPMENT,
    },
    {
      code: 'OP_BATCH_NO',
      name: '批号',
      unit: '',
      required: false,
      valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
      systemKey: PROCESS_FORM_SYSTEM_KEYS.BATCH_NO,
    },
    {
      code: 'OP_OUTPUT_QTY',
      name: '出料量',
      unit: 'kg',
      required: false,
      valueSource: QC_FIELD_VALUE_SOURCE.MANUAL,
      systemKey: '',
    },
    {
      code: 'OP_REMARK',
      name: '操作备注',
      unit: '',
      required: false,
      valueSource: QC_FIELD_VALUE_SOURCE.MANUAL,
      systemKey: '',
    },
  ]
}

/** 模板里与固定项重复的字段不再二次采集。 */
export function filterTemplateFieldsBeyondFixed(fields = []) {
  return (fields || []).filter((field) => {
    const code = String(field.code || '')
      .trim()
      .toUpperCase()
    if (!code || code === 'OP_ACTUAL_FEED') return false
    return !FIXED_SET.has(code)
  })
}
