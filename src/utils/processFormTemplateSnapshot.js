import { getProcessById } from '@/store/processConfigStore'
import { getProcessFormTemplateById } from '@/store/processFormTemplateStore'

/** 按工序当前挂接的报工模板打快照（建批时写入 routeSnapshot） */
export function snapshotFormTemplateForProcess(processId) {
  const proc = processId ? getProcessById(processId) : null
  const templateId = proc?.formTemplateId
  if (!templateId) return null
  const tpl = getProcessFormTemplateById(templateId)
  if (!tpl || tpl.status === '停用') return null
  return {
    templateId: tpl.id,
    templateCode: tpl.code || '',
    templateName: tpl.name || '',
    fields: (tpl.fields || []).map((field, index) => ({
      ...JSON.parse(JSON.stringify(field)),
      sortOrder: field.sortOrder ?? index + 1,
    })),
  }
}

/** 步骤上优先用快照；旧批次无快照时回退读工序当前模板 */
export function resolveStepFormTemplate(step) {
  if (step?.formTemplate?.fields?.length) return step.formTemplate
  return snapshotFormTemplateForProcess(step?.processId)
}
