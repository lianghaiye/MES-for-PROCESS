import { displayInspectConclusion } from '@/utils/inspectConclusion'
import { listQcTasks } from '@/store/qcTaskStore'

/**
 * 按库存批次解析化验单号、检验结论、任务 id。
 * 优先检单行上的批次号 / 检单号，其次批次上自带的 qcNo、qcResult。
 */
export function resolveBatchInspectInfo(batch) {
  if (!batch) return { qcNo: '—', qcResult: '—', qcTaskId: '' }
  const batchNo = String(batch.batchNo || '').trim()
  const batchQcNo = String(batch.qcNo || '').trim()
  const tasks = listQcTasks()
  const hit =
    tasks.find((task) => {
      if (batchQcNo && String(task.qcNo || '').trim() === batchQcNo) return true
      return (task.lineItems || []).some((line) => {
        const nos = [line.batchNo, line.stockBatchNo, line.supplierBatchNo, line.lotNo].map((v) =>
          String(v || '').trim(),
        )
        return Boolean(batchNo) && nos.includes(batchNo)
      })
    }) || null

  if (hit) {
    return {
      qcNo: hit.qcNo || batchQcNo || '—',
      qcResult: displayInspectConclusion(hit.qcResult || batch.qcResult),
      qcTaskId: hit.id || '',
    }
  }
  return {
    qcNo: batchQcNo || '—',
    qcResult: displayInspectConclusion(batch.qcResult),
    qcTaskId: '',
  }
}
