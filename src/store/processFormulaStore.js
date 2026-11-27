import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import {
  calcTheoreticalFeed,
  isRatioOnlyFormula,
  ratiosClosed,
  round3,
  sumFeedRatios,
  theoreticalOutput,
} from '@/utils/processBatchMath'
import { findProcessItem, PROCESS_ITEMS } from '@/store/materialBatchStore'
import { materialInfoState } from '@/store/materialInfoStore'
import { productInfoState } from '@/store/productInfoStore'
import { getProcessById } from '@/store/processConfigStore'
import { getProcessRouteById } from '@/store/processRouteStore'
import { collectRouteEquipmentIds } from '@/utils/processRouteGrid'
import {
  deriveProcessGateFromAssaySchemes,
  normalizeProcessQcConfigs,
} from '@/utils/qcProcessConfig'
import { normalizeDownstreamSpawn } from '@/utils/outputDownstreamSpawn'
import { getUser } from '@/utils/auth'

const STORAGE_KEY = 'i-doms-process-formula-v2'

function nowText() {
  return dayjs().format('YYYY-MM-DD HH:mm')
}

function resolveOperatorName() {
  const user = getUser()
  return user?.name || user?.username || user?.realName || 'admin1'
}

export function appendFormulaOperationLog(row, action, remark = '') {
  if (!row) return
  if (!Array.isArray(row.operationLogs)) row.operationLogs = []
  row.operationLogs.unshift({
    id: `flog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    operatedAt: nowText(),
    action: String(action || '').trim() || '操作',
    operator: resolveOperatorName(),
    remark: String(remark || '').trim(),
  })
}

export const FORMULA_STATUS_LABEL = {
  pending: '待发布',
  active: '生效',
  archived: '已归档',
}

export const OUTPUT_ROLE_OPTIONS = [
  { value: 'main', label: '主产品' },
  { value: 'co', label: '联产品' },
  { value: 'by', label: '副产品' },
  { value: 'recycle', label: '回收料' },
  { value: 'waste', label: '废弃物' },
]

export const OUTPUT_ROLE_LABEL = Object.fromEntries(
  OUTPUT_ROLE_OPTIONS.map((item) => [item.value, item.label]),
)

/**
 * 记产出去向：
 * 待判定 → 先落暂存位，化验后再定回用/再提/入库/废弃；
 * 入仓库 / 入储罐 → 库存批次 + 入库单；
 * 进暂存池 → 车间暂存批，不生成入库单，后续合并入库；
 * 回用 / 再提 → 待回用 / 待再提批次；
 * 废弃 → 已拒收，不生成入库单。
 */
export const OUTPUT_DISPOSITION_OPTIONS = [
  { value: 'pending_decide', label: '待判定' },
  { value: 'warehouse', label: '入仓库' },
  { value: 'tank', label: '入储罐' },
  { value: 'staging', label: '进暂存池' },
  { value: 'reuse', label: '回用' },
  { value: 'reextract', label: '再提' },
  { value: 'scrap', label: '废弃' },
]

export const OUTPUT_DISPOSITION_LABEL = Object.fromEntries(
  OUTPUT_DISPOSITION_OPTIONS.map((item) => [item.value, item.label]),
)

/** 会生成库存批次与入库单的去向 */
export function isStockOutputDisposition(value) {
  const text = String(value || '').trim()
  return text === 'warehouse' || text === 'tank' || text === 'inbound'
}

/** 会生成物料批次 */
export function createsOutputBatchDisposition(value) {
  const text = String(value || '').trim()
  return (
    isStockOutputDisposition(text) ||
    text === 'staging' ||
    text === 'reuse' ||
    text === 'reextract' ||
    text === 'pending_decide' ||
    text === 'scrap'
  )
}

/** 位置主数据 kind：warehouse→silo，tank→tank；暂存池不限仓/罐 */
export function locationKindForDisposition(value) {
  const text = String(value || '').trim()
  if (text === 'tank') return 'tank'
  if (text === 'warehouse' || text === 'inbound') return 'silo'
  return ''
}

export function batchStatusForDisposition(value) {
  const text = String(value || '').trim()
  if (text === 'reuse') return 'await_reuse'
  if (text === 'reextract') return 'await_reextract'
  if (text === 'pending_decide') return 'await_decide'
  if (text === 'staging') return 'await_staging'
  if (text === 'scrap') return 'rejected'
  // 入仓库 / 入储罐：先待仓管确认入库，确认后才变为可用（released）
  if (text === 'warehouse' || text === 'tank' || text === 'inbound') return 'await_inbound'
  return 'pending'
}

export function normalizeOutputDisposition(value) {
  const text = String(value || '').trim()
  if (text === 'inbound') return 'warehouse'
  if (OUTPUT_DISPOSITION_LABEL[text]) return text
  return ''
}

/** 产出行只挂产出化验（成品检）；过程检在工序化验清单，出厂化验走发货/出库。 */
export const OUTPUT_ASSAY_SCOPES = ['成品检']

export function normalizeOutputAssayScopes(values) {
  const allowed = new Set(OUTPUT_ASSAY_SCOPES)
  const list = Array.isArray(values) ? values : []
  const names = list.map((item) => String(item || '').trim()).filter((item) => allowed.has(item))
  return [...new Set(names)]
}

/** 从化验方案列表推导产出行勾选（仅成品检 / 产出化验）。 */
export function assayScopesFromSchemes(schemes) {
  const allowed = new Set(OUTPUT_ASSAY_SCOPES)
  const names = (Array.isArray(schemes) ? schemes : [])
    .map((row) => String(row?.bizScope || '').trim())
    .filter((scope) => allowed.has(scope))
  return [...new Set(names)]
}

export const FORMULA_TYPE_OPTIONS = [
  { value: 'standard', label: '标准配方' },
  { value: 'trial', label: '试制配方' },
  { value: 'customer', label: '客户配方' },
]

export const FORMULA_TYPE_LABEL = Object.fromEntries(
  FORMULA_TYPE_OPTIONS.map((item) => [item.value, item.label]),
)

function seed() {
  return [
    {
      id: 'formula-paint',
      formulaNo: 'PF-PAINT-001',
      name: '醇酸面漆配方',
      itemId: 'pi-paint',
      version: 'V1.0',
      lineageId: 'lineage-paint',
      formulaType: 'standard',
      status: 'active',
      isDefault: true,
      baseBatchQty: 30,
      theoreticalYield: 0.95,
      outputs: [
        { role: 'main', itemId: 'pi-paint', expectedQty: 28.5, stepNo: 3 },
        { role: 'by', itemId: 'pi-thinner', expectedQty: 1.2, stepNo: 3 },
      ],
      lines: [
        {
          itemId: 'pi-resin',
          feedQty: 20,
          ratio: null,
          lossRate: 0,
          tolerance: 0.02,
          feedSequence: 1,
          stepNo: 1,
          convertByContent: false,
          content: 1,
          isKeyMaterial: true,
          isAuxiliary: false,
        },
        {
          itemId: 'pi-solvent',
          feedQty: null,
          ratio: 0.3,
          lossRate: 0.02,
          tolerance: 0.05,
          feedSequence: 2,
          stepNo: 2,
          convertByContent: true,
          content: 0.8,
          isKeyMaterial: false,
          isAuxiliary: false,
        },
      ],
      steps: [
        {
          stepNo: 1,
          name: '投料',
          processId: 'proc-op-001',
          equipmentCategory: '反应设备',
          equipmentIds: ['eq-d-1'],
          params: [],
        },
        {
          stepNo: 2,
          name: '保温',
          processId: 'proc-op-003',
          equipmentCategory: '反应设备',
          equipmentIds: ['eq-d-2'],
          params: [
            { name: '温度', unit: '℃', target: 80, min: 75, max: 85 },
            { name: '时间', unit: 'min', target: 30, min: 25, max: 40 },
            { name: '转速', unit: 'rpm', target: 60, min: 40, max: 80 },
          ],
        },
        {
          stepNo: 3,
          name: '灌装',
          processId: 'proc-op-006',
          equipmentCategory: '计量灌装',
          equipmentIds: ['eq-d-7'],
          params: [],
        },
      ],
      routeId: 'route-001',
      creator: '系统管理员',
      createdAt: '2026-11-10 09:00',
      updater: '系统管理员',
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      operationLogs: [
        {
          id: 'flog-paint-1',
          operatedAt: '2026-11-10 09:00',
          action: '创建',
          operator: '系统管理员',
          remark: '初始化演示配方',
        },
        {
          id: 'flog-paint-2',
          operatedAt: '2026-11-10 10:20',
          action: '审核发布',
          operator: '系统管理员',
          remark: '版本 V1.0 生效',
        },
      ],
    },
    {
      id: 'formula-paint-v09',
      formulaNo: 'PF-PAINT-001',
      name: '醇酸面漆配方',
      itemId: 'pi-paint',
      version: 'V0.9',
      lineageId: 'lineage-paint',
      formulaType: 'standard',
      status: 'archived',
      isDefault: false,
      baseBatchQty: 30,
      theoreticalYield: 0.93,
      routeId: 'route-001',
      outputs: [{ role: 'main', itemId: 'pi-paint', expectedQty: 27.9, stepNo: 3 }],
      lines: [
        {
          itemId: 'pi-resin',
          feedQty: 20,
          ratio: null,
          lossRate: 0,
          tolerance: 0.02,
          feedSequence: 1,
          stepNo: 1,
          convertByContent: false,
          content: 1,
          isKeyMaterial: true,
          isAuxiliary: false,
        },
        {
          itemId: 'pi-solvent',
          feedQty: null,
          ratio: 0.3,
          lossRate: 0.02,
          tolerance: 0.05,
          feedSequence: 2,
          stepNo: 2,
          convertByContent: true,
          content: 0.8,
          isKeyMaterial: false,
          isAuxiliary: false,
        },
      ],
      steps: [
        { stepNo: 1, name: '投料', processId: 'proc-op-001', equipmentIds: ['eq-d-1'], params: [] },
        { stepNo: 2, name: '保温', processId: 'proc-op-003', equipmentIds: ['eq-d-2'], params: [] },
        { stepNo: 3, name: '灌装', processId: 'proc-op-006', equipmentIds: ['eq-d-7'], params: [] },
      ],
      creator: '系统管理员',
      createdAt: '2026-10-08 14:00',
      updater: '系统管理员',
      updatedAt: '2026-11-10 10:20',
      operationLogs: [
        {
          id: 'flog-paint-v09-1',
          operatedAt: '2026-10-08 14:00',
          action: '创建',
          operator: '系统管理员',
          remark: '初版',
        },
        {
          id: 'flog-paint-v09-2',
          operatedAt: '2026-11-10 10:20',
          action: '归档',
          operator: '系统管理员',
          remark: '被 V1.0 替换',
        },
      ],
    },
    {
      id: 'formula-alkyd',
      formulaNo: 'PF-ALKYD-001',
      name: '醇酸树脂液配方',
      itemId: 'pi-alkyd-base',
      version: 'V1.0',
      lineageId: 'lineage-alkyd',
      formulaType: 'standard',
      status: 'active',
      isDefault: true,
      baseBatchQty: 200,
      theoreticalYield: 0.92,
      outputs: [
        { role: 'main', itemId: 'pi-alkyd-base', expectedQty: 184, stepNo: 3 },
        { role: 'waste', itemId: 'pi-residue', expectedQty: 8, stepNo: 3 },
      ],
      lines: [
        {
          itemId: 'pi-resin',
          feedQty: 120,
          ratio: null,
          lossRate: 0,
          tolerance: 0.02,
          feedSequence: 1,
          stepNo: 1,
          convertByContent: false,
          content: 1,
          isKeyMaterial: true,
          isAuxiliary: false,
        },
        {
          itemId: 'pi-solvent',
          feedQty: 72,
          ratio: null,
          lossRate: 0.01,
          tolerance: 0.05,
          feedSequence: 2,
          stepNo: 2,
          convertByContent: true,
          content: 0.8,
          isKeyMaterial: false,
          isAuxiliary: false,
        },
      ],
      steps: [
        { stepNo: 1, name: '投树脂', processId: 'proc-op-001', params: [] },
        {
          stepNo: 2,
          name: '合成保温',
          processId: 'proc-op-003',
          params: [
            { name: '温度', unit: '℃', target: 220, min: 210, max: 230 },
            { name: '时间', unit: 'min', target: 90, min: 80, max: 120 },
          ],
        },
        { stepNo: 3, name: '稀释出料', processId: 'proc-op-006', params: [] },
      ],
      routeId: 'route-001',
      creator: '系统管理员',
      createdAt: '2026-11-12 08:30',
      updater: '系统管理员',
      updatedAt: '2026-11-12 09:00',
      operationLogs: [
        {
          id: 'flog-alkyd-1',
          operatedAt: '2026-11-12 08:30',
          action: '创建',
          operator: '系统管理员',
          remark: '',
        },
        {
          id: 'flog-alkyd-2',
          operatedAt: '2026-11-12 09:00',
          action: '审核发布',
          operator: '系统管理员',
          remark: '',
        },
      ],
    },
    {
      id: 'formula-custom',
      formulaNo: 'PF-CUS-001',
      name: '客户指定色漆配方',
      itemId: 'pi-custom-paint',
      version: 'V1.0',
      lineageId: 'lineage-custom',
      formulaType: 'customer',
      status: 'active',
      isDefault: true,
      baseBatchQty: 20,
      theoreticalYield: 0.9,
      outputs: [
        { role: 'main', itemId: 'pi-custom-paint', expectedQty: 18, stepNo: 3 },
        { role: 'by', itemId: 'pi-thinner', expectedQty: 0.6, stepNo: 3 },
      ],
      lines: [
        {
          itemId: 'pi-alkyd-base',
          feedQty: 12,
          ratio: null,
          lossRate: 0,
          tolerance: 0.02,
          feedSequence: 1,
          stepNo: 1,
          convertByContent: false,
          content: 0.5,
          isKeyMaterial: true,
          isAuxiliary: false,
        },
        {
          itemId: 'pi-pigment',
          feedQty: 6,
          ratio: null,
          lossRate: 0,
          tolerance: 0.03,
          feedSequence: 2,
          stepNo: 2,
          convertByContent: false,
          content: 1,
          isKeyMaterial: true,
          isAuxiliary: false,
        },
        {
          itemId: 'pi-drier',
          feedQty: 0.15,
          ratio: null,
          lossRate: 0,
          tolerance: 0.05,
          feedSequence: 3,
          stepNo: 2,
          convertByContent: true,
          content: 0.06,
          isKeyMaterial: false,
          isAuxiliary: true,
        },
      ],
      steps: [
        { stepNo: 1, name: '投树脂液', processId: 'proc-op-001', params: [] },
        {
          stepNo: 2,
          name: '调色',
          processId: 'proc-op-003',
          params: [
            { name: '温度', unit: '℃', target: 45, min: 40, max: 55 },
            { name: '转速', unit: 'rpm', target: 800, min: 600, max: 1000 },
          ],
        },
        { stepNo: 3, name: '灌装', processId: 'proc-op-006', params: [] },
      ],
      creator: '系统管理员',
      createdAt: '2026-11-12 09:40',
      updater: '系统管理员',
      updatedAt: '2026-11-12 10:00',
      operationLogs: [
        {
          id: 'flog-cus-1',
          operatedAt: '2026-11-12 09:40',
          action: '创建',
          operator: '系统管理员',
          remark: '',
        },
        {
          id: 'flog-cus-2',
          operatedAt: '2026-11-12 10:00',
          action: '审核发布',
          operator: '系统管理员',
          remark: '',
        },
      ],
    },
    {
      id: 'formula-custom-trial',
      formulaNo: 'PF-CUS-T01',
      name: '客户指定色漆试制配方',
      itemId: 'pi-custom-paint',
      version: 'V0.9',
      lineageId: 'lineage-custom-trial',
      formulaType: 'trial',
      status: 'pending',
      isDefault: false,
      baseBatchQty: 20,
      theoreticalYield: 0.88,
      outputs: [{ role: 'main', itemId: 'pi-custom-paint', expectedQty: 17.6, stepNo: 2 }],
      lines: [
        {
          itemId: 'pi-alkyd-base',
          feedQty: 11,
          ratio: null,
          lossRate: 0,
          tolerance: 0.03,
          feedSequence: 1,
          stepNo: 1,
          convertByContent: false,
          content: 0.5,
          isKeyMaterial: true,
          isAuxiliary: false,
        },
        {
          itemId: 'pi-pigment',
          feedQty: 7,
          ratio: null,
          lossRate: 0,
          tolerance: 0.05,
          feedSequence: 2,
          stepNo: 2,
          convertByContent: false,
          content: 1,
          isKeyMaterial: false,
          isAuxiliary: false,
        },
      ],
      steps: [
        { stepNo: 1, name: '投树脂液', processId: 'proc-op-001', params: [] },
        { stepNo: 2, name: '调色', processId: 'proc-op-003', params: [] },
      ],
      creator: '系统管理员',
      createdAt: '2026-11-18 15:00',
      updater: '系统管理员',
      updatedAt: '2026-11-18 15:00',
      operationLogs: [
        {
          id: 'flog-trial-1',
          operatedAt: '2026-11-18 15:00',
          action: '创建',
          operator: '系统管理员',
          remark: '试制版本',
        },
      ],
    },
    {
      id: 'formula-licarbon',
      formulaNo: 'PF-LIC-001',
      name: '工业级碳酸锂（酸浸沉锂）',
      itemId: 'pi-licarbon',
      version: 'V1.0',
      lineageId: 'lineage-licarbon',
      formulaType: 'standard',
      status: 'active',
      isDefault: true,
      // 单槽一次进料约 100 吨（调研）；日计划约 150 吨会跨多槽。
      // 基准批量按原料吨计；理论得率 = 工碳产出 / 原料吨，约 6.4%。
      // 挂路线 GYLX0012；支线并行改由路线拓扑表达，批令上可关本次不做的支线。
      baseBatchQty: 100000,
      theoreticalYield: 0.064,
      routeId: 'route-012',
      // 角色口径：卤水/渣=副产品；洗渣水/母液=回收料；氟钙镁渣=废弃物
      outputs: [
        { role: 'main', itemId: 'pi-licarbon', expectedQty: 6400, stepNo: 10 },
        { role: 'by', itemId: 'pi-acid-brine', expectedQty: 95000, stepNo: 3 },
        { role: 'by', itemId: 'pi-acid-slag', expectedQty: 82000, stepNo: 3 },
        { role: 'recycle', itemId: 'pi-wash-water', expectedQty: 12000, stepNo: 6 },
        { role: 'recycle', itemId: 'pi-mother-liquor', expectedQty: 8000, stepNo: 8 },
        {
          role: 'waste',
          itemId: 'pi-f-slag',
          expectedQty: 2800,
          stepNo: 6,
          // 方案 A：登渣后可开支线洗涤指令（可扩多个下游，多项时只能一键）
          downstreamSpawnEnabled: true,
          downstreamFormulaIds: ['formula-f-slag-wash'],
          downstreamFormulaId: 'formula-f-slag-wash',
          downstreamSpawnMode: 'manual',
        },
      ],
      lines: [
        {
          itemId: 'pi-black-powder',
          feedQty: 100000,
          ratio: null,
          lossRate: 0.01,
          tolerance: 0.03,
          feedSequence: 1,
          stepNo: 1,
          // 含量 1.5% 记在行上供金属量核算；投料量按实物吨，不在此再除含量
          convertByContent: false,
          content: 0.015,
          isKeyMaterial: true,
          isAuxiliary: false,
        },
        {
          itemId: 'pi-sulfuric',
          feedQty: 18000,
          ratio: null,
          lossRate: 0.02,
          tolerance: 0.05,
          feedSequence: 2,
          stepNo: 2,
          convertByContent: true,
          content: 0.98,
          isKeyMaterial: false,
          isAuxiliary: true,
        },
        {
          itemId: 'pi-defluor',
          feedQty: 850,
          ratio: null,
          lossRate: 0,
          tolerance: 0.05,
          feedSequence: 3,
          stepNo: 4,
          convertByContent: false,
          content: 1,
          isKeyMaterial: false,
          isAuxiliary: true,
        },
        {
          itemId: 'pi-caustic',
          feedQty: 620,
          ratio: null,
          lossRate: 0,
          tolerance: 0.05,
          feedSequence: 4,
          stepNo: 5,
          convertByContent: true,
          content: 0.99,
          isKeyMaterial: false,
          isAuxiliary: true,
        },
        {
          itemId: 'pi-pfs',
          feedQty: 400,
          ratio: null,
          lossRate: 0,
          tolerance: 0.08,
          feedSequence: 5,
          stepNo: 5,
          convertByContent: false,
          content: 1,
          isKeyMaterial: false,
          isAuxiliary: true,
        },
        {
          itemId: 'pi-soda',
          feedQty: 4800,
          ratio: null,
          lossRate: 0.01,
          tolerance: 0.03,
          feedSequence: 6,
          stepNo: 7,
          convertByContent: true,
          content: 0.99,
          isKeyMaterial: true,
          isAuxiliary: false,
        },
      ],
      // 一次净化后：二次浆化 ‖ 氟渣洗涤（并行组 G2，默认 any：组内完成一条即可汇合）
      steps: [
        {
          stepNo: 1,
          name: '投料浆化',
          processId: 'proc-op-008',
          equipmentCategory: '反应设备',
          equipmentIds: ['eq-d-1'],
          params: [],
        },
        {
          stepNo: 2,
          name: '一次酸浸',
          processId: 'proc-op-009',
          equipmentCategory: '反应设备',
          equipmentIds: ['eq-d-2'],
          params: [
            { name: '温度', unit: '℃', target: 85, min: 75, max: 95 },
            { name: '时间', unit: 'min', target: 180, min: 120, max: 300 },
            { name: 'pH', unit: '', target: 1.5, min: 1.0, max: 2.5 },
          ],
        },
        {
          stepNo: 3,
          name: '压滤',
          processId: 'proc-op-010',
          equipmentCategory: '分离设备',
          equipmentIds: ['eq-d-3'],
          params: [],
        },
        {
          stepNo: 4,
          name: '一次净化',
          processId: 'proc-op-012',
          equipmentCategory: '反应设备',
          equipmentIds: ['eq-d-2'],
          params: [
            { name: '温度', unit: '℃', target: 60, min: 50, max: 70 },
            { name: '时间', unit: 'min', target: 60, min: 40, max: 90 },
          ],
        },
        {
          stepNo: 5,
          name: '二次浆化',
          processId: 'proc-op-013',
          equipmentCategory: '反应设备',
          equipmentIds: ['eq-d-2'],
          params: [
            { name: 'pH', unit: '', target: 10.5, min: 9.5, max: 11.5 },
            { name: '时间', unit: 'min', target: 90, min: 60, max: 150 },
          ],
        },
        {
          stepNo: 6,
          name: '氟渣洗涤',
          processId: 'proc-op-011',
          equipmentCategory: '分离设备',
          equipmentIds: ['eq-d-3'],
          params: [],
        },
        {
          stepNo: 7,
          name: '沉锂',
          processId: 'proc-op-014',
          equipmentCategory: '反应设备',
          equipmentIds: ['eq-d-2'],
          params: [
            { name: '温度', unit: '℃', target: 90, min: 80, max: 95 },
            { name: '时间', unit: 'min', target: 120, min: 90, max: 180 },
            { name: '转速', unit: 'rpm', target: 40, min: 30, max: 60 },
          ],
        },
        {
          stepNo: 8,
          name: '锂盐洗涤',
          processId: 'proc-op-015',
          equipmentCategory: '分离设备',
          equipmentIds: ['eq-d-3'],
          params: [],
        },
        {
          stepNo: 9,
          name: '离心',
          processId: 'proc-op-005',
          equipmentCategory: '分离设备',
          equipmentIds: ['eq-d-4'],
          params: [
            { name: '转速', unit: 'rpm', target: 1200, min: 1000, max: 1500 },
            { name: '时间', unit: 'min', target: 25, min: 15, max: 40 },
          ],
        },
        {
          stepNo: 10,
          name: '包装',
          processId: 'proc-op-016',
          equipmentCategory: '计量灌装',
          equipmentIds: ['eq-d-7'],
          params: [],
        },
      ],
      creator: '系统管理员',
      createdAt: '2026-11-16 10:00',
      updater: '系统管理员',
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      operationLogs: [
        {
          id: 'flog-lic-1',
          operatedAt: '2026-11-16 10:00',
          action: '创建',
          operator: '系统管理员',
          remark: '按锂盐回收现场调研整理：酸浸→除杂→沉锂工碳',
        },
        {
          id: 'flog-lic-2',
          operatedAt: '2026-11-16 11:30',
          action: '审核发布',
          operator: '系统管理员',
          remark: '挂路线 GYLX0012，基准批量 100 吨/槽',
        },
        {
          id: 'flog-lic-3',
          operatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
          action: '更新',
          operator: '系统管理员',
          remark: 'MOCK 并行组 G2：二次浆化 ‖ 氟渣洗涤（any），对齐路线第5步选做完成',
        },
        {
          id: 'flog-lic-4',
          operatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
          action: '更新',
          operator: '系统管理员',
          remark: 'MOCK 方案A：氟钙镁渣产出挂下游配方 PF-FSW-001，一键开支线',
        },
      ],
    },
    // 支线配方：主线登渣后一键开本指令（方案 A）
    {
      id: 'formula-f-slag-wash',
      formulaNo: 'PF-FSW-001',
      name: '氟渣洗涤（支线MOCK）',
      itemId: 'pi-f-slag',
      version: 'V1.0',
      lineageId: 'lineage-f-slag-wash',
      formulaType: 'standard',
      status: 'active',
      isDefault: false,
      baseBatchQty: 2800,
      theoreticalYield: 0.95,
      routeId: '',
      outputs: [
        { role: 'main', itemId: 'pi-f-slag', expectedQty: 2660, stepNo: 2 },
        { role: 'recycle', itemId: 'pi-wash-water', expectedQty: 800, stepNo: 2 },
      ],
      lines: [
        {
          itemId: 'pi-f-slag',
          feedQty: 2800,
          ratio: null,
          lossRate: 0,
          tolerance: 0.05,
          feedSequence: 1,
          stepNo: 1,
          convertByContent: false,
          content: 1,
          isKeyMaterial: true,
          isAuxiliary: false,
        },
      ],
      steps: [
        {
          stepNo: 1,
          name: '氟渣投料',
          processId: 'proc-op-011',
          equipmentCategory: '分离设备',
          equipmentIds: ['eq-d-3'],
          params: [],
        },
        {
          stepNo: 2,
          name: '洗涤出料',
          processId: 'proc-op-011',
          equipmentCategory: '分离设备',
          equipmentIds: ['eq-d-3'],
          params: [],
        },
      ],
      creator: '系统管理员',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
      updater: '系统管理员',
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      operationLogs: [
        {
          id: 'flog-fsw-1',
          operatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
          action: '审核发布',
          operator: '系统管理员',
          remark: 'MOCK 支线：承接主线氟钙镁渣洗涤',
        },
      ],
    },
  ]
}

function emptySet() {
  const blank = () => ({ target: null, min: null, max: null })
  return { temperature: blank(), duration: blank(), speed: blank(), ph: blank() }
}

function normalizeStoredFormula(row) {
  const steps = row.steps || []
  const lastStepNo = steps.length ? Number(steps[steps.length - 1].stepNo) || steps.length : null
  const stamp = row.updatedAt || row.createdAt || nowText()
  return {
    ...row,
    lineageId: row.lineageId || row.formulaNo || row.id,
    formulaType: FORMULA_TYPE_LABEL[row.formulaType] ? row.formulaType : 'standard',
    isDefault: row.isDefault === true,
    routeId: row.routeId || '',
    creator: row.creator || '系统管理员',
    createdAt: row.createdAt || stamp,
    updater: row.updater || row.creator || '系统管理员',
    updatedAt: row.updatedAt || stamp,
    operationLogs: Array.isArray(row.operationLogs) ? row.operationLogs : [],
    steps: steps.map((step) => ({
      ...step,
      assaySchemes: Array.isArray(step.assaySchemes)
        ? normalizeProcessQcConfigs(step.assaySchemes)
        : step.assaySchemes,
    })),
    outputs: (row.outputs || []).map((output) => {
      let stepNo = Number(output.stepNo)
      if (!(stepNo > 0)) {
        if (row.id === 'formula-paint') stepNo = 3
        else stepNo = lastStepNo
      }
      const step = steps.find((item) => Number(item.stepNo) === stepNo)
      return {
        ...output,
        stepNo: stepNo > 0 ? stepNo : null,
        stepName: output.stepName || step?.name || '',
        assayScopes: normalizeOutputAssayScopes(output.assayScopes),
      }
    }),
    lines: (row.lines || []).map((line) => {
      const profile = itemMasterProfile(line.itemId)
      let stepNo = Number(line.stepNo)
      if (!(stepNo > 0)) {
        if (row.id === 'formula-paint' && line.itemId === 'pi-resin') stepNo = 1
        else if (row.id === 'formula-paint' && line.itemId === 'pi-solvent') stepNo = 2
        else stepNo = null
      }
      return {
        ...line,
        stepNo: stepNo > 0 ? stepNo : null,
        isKeyMaterial: line.isKeyMaterial ?? profile.isKeyMaterial,
        isAuxiliary: line.isAuxiliary ?? profile.isAuxiliary,
      }
    }),
  }
}

/** 旧数据没有默认标记时，每个主产品的第一张生效配方视为默认。 */
function migrateMissingDefault(parsed, list) {
  const missingFlag = parsed.every((row) => row.isDefault == null)
  if (!missingFlag) return
  const picked = new Set()
  list.forEach((row) => {
    if (row.status !== 'active' || picked.has(row.itemId)) return
    row.isDefault = true
    picked.add(row.itemId)
  })
}

function exclusiveActiveDefault(list) {
  const seen = new Set()
  list.forEach((row) => {
    if (row.status === 'archived') row.isDefault = false
    if (row.status !== 'active' || !row.isDefault) return
    if (seen.has(row.itemId)) row.isDefault = false
    else seen.add(row.itemId)
  })
}

/** 已有本地配方时补上缺失的示例，不覆盖用户改过的同编号配方。 */
function mergeSeedFormulas(list) {
  const next = Array.isArray(list) ? [...list] : []
  seed().forEach((demo) => {
    if (next.some((row) => row.id === demo.id || row.formulaNo === demo.formulaNo)) return
    next.push(normalizeStoredFormula(demo))
  })
  return next
}

/** 演示配方 PF-LIC-001：按约定产出角色口径覆盖 outputs（不影响其他用户配方）。 */
function migrateLicarbonOutputRoles(list) {
  const demo = seed().find((row) => row.id === 'formula-licarbon')
  if (!demo) return
  const target = list.find((row) => row.id === 'formula-licarbon' || row.formulaNo === 'PF-LIC-001')
  if (!target) return
  target.outputs = demo.outputs.map((o) => ({ ...o }))
}

/** 演示配方：同步并行组阶段（二次浆化 ‖ 氟渣洗涤）及投料/产出步号。 */
function migrateLicarbonParallelSteps(list) {
  const demo = seed().find((row) => row.id === 'formula-licarbon')
  if (!demo) return
  const target = list.find((row) => row.id === 'formula-licarbon' || row.formulaNo === 'PF-LIC-001')
  if (!target) return
  target.name = demo.name
  target.routeId = demo.routeId
  target.steps = demo.steps.map((s) => ({ ...s, params: (s.params || []).map((p) => ({ ...p })) }))
  target.outputs = demo.outputs.map((o) => ({ ...o }))
  target.lines = demo.lines.map((line) => ({ ...line }))
}

/** 确保支线洗涤配方存在（mergeSeed 按 id/编号补入） */
function ensureFSlagWashFormula(list) {
  const demo = seed().find((row) => row.id === 'formula-f-slag-wash')
  if (!demo) return
  if (list.some((row) => row.id === 'formula-f-slag-wash' || row.formulaNo === 'PF-FSW-001')) return
  list.push(normalizeStoredFormula(demo))
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const list = mergeSeedFormulas(parsed.map(normalizeStoredFormula))
    migrateMissingDefault(parsed, list)
    migrateLicarbonOutputRoles(list)
    migrateLicarbonParallelSteps(list)
    ensureFSlagWashFormula(list)
    exclusiveActiveDefault(list)
    return list
  } catch {
    return null
  }
}

export const formulaState = reactive({
  formulas: load() || seed().map(normalizeStoredFormula),
})

watch(
  () => formulaState.formulas,
  () => localStorage.setItem(STORAGE_KEY, JSON.stringify(formulaState.formulas)),
  { deep: true },
)

export function emptySetpoints() {
  return emptySet()
}

const LEGACY_PARAM = {
  temperature: { name: '温度', unit: '℃' },
  duration: { name: '时间', unit: 'min' },
  speed: { name: '转速', unit: 'rpm' },
  ph: { name: 'pH', unit: '' },
}

function hasLimit(value) {
  return value != null && value !== ''
}

/** 阶段参数。旧数据只有温度/时间/转速/pH 时，转成名称、单位、设定、上下限。 */
export function stepParamRows(step) {
  if (Array.isArray(step?.params)) {
    return step.params.map((param, index) => ({
      key: param.key || `p-${index}`,
      name: param.name || '',
      unit: param.unit || '',
      target: param.target ?? null,
      min: param.min ?? null,
      max: param.max ?? null,
    }))
  }
  const setpoints = step?.setpoints || {}
  return Object.keys(LEGACY_PARAM)
    .filter((key) => {
      const param = setpoints[key]
      if (!param) return false
      return [param.target, param.min, param.max].some(hasLimit)
    })
    .map((key) => ({
      key,
      name: LEGACY_PARAM[key].name,
      unit: LEGACY_PARAM[key].unit,
      target: setpoints[key].target ?? null,
      min: setpoints[key].min ?? null,
      max: setpoints[key].max ?? null,
    }))
}

export function formatStepParams(step) {
  const params = stepParamRows(step)
  if (!params.length) return '—'
  return params
    .map((param) => {
      const unit = param.unit ? ` ${param.unit}` : ''
      const target = param.target == null || param.target === '' ? '—' : param.target
      return `${param.name || '参数'} ${target}${unit}（${param.min ?? '—'}~${param.max ?? '—'}）`
    })
    .join('；')
}

export function listFormulas() {
  return formulaState.formulas
}

export function getFormula(id) {
  return formulaState.formulas.find((f) => f.id === id) || null
}

export function getDefaultFormulaByItem(itemId) {
  return (
    formulaState.formulas.find(
      (f) => f.itemId === itemId && f.status === 'active' && f.isDefault,
    ) || null
  )
}

export function getActiveFormulaByItem(itemId) {
  return (
    getDefaultFormulaByItem(itemId) ||
    formulaState.formulas.find((f) => f.itemId === itemId && f.status === 'active') ||
    null
  )
}

/** 维护配方时优先打开默认生效配方，其次其他生效版本，再次待发布。 */
export function findMaintainFormula(itemId) {
  const rows = formulaState.formulas.filter((f) => f.itemId === itemId)
  return (
    rows.find((f) => f.status === 'active' && f.isDefault) ||
    rows.find((f) => f.status === 'active') ||
    rows.find((f) => f.status === 'pending') ||
    rows[0] ||
    null
  )
}

export function itemLabel(itemId) {
  const item = findProcessItem(itemId)
  if (item) return `${item.code} ${item.name}`
  const card = itemMasterCard(itemId)
  const text = `${card.code || ''} ${card.name || ''}`.trim()
  return text || itemId || '—'
}

export function itemUnit(itemId) {
  const processUnit = findProcessItem(itemId)?.unit
  if (processUnit) return processUnit
  const material = materialInfoState.materials.find((row) => row.id === itemId)
  const product = productInfoState.products.find((row) => row.id === itemId)
  return material?.inventoryUnit || product?.inventoryUnit || 'kg'
}

/** 配方行默认值：流程物料目录优先，否则取产品/物料主数据。 */
export function itemMasterProfile(itemId) {
  const card = itemMasterCard(itemId)
  const material = materialInfoState.materials.find((row) => row.id === itemId)
  const product = productInfoState.products.find((row) => row.id === itemId)
  const production = material?.production || product?.production || {}
  const process = findProcessItem(itemId)
  return {
    content: card.content,
    isKeyMaterial: Boolean(
      process?.isKeyMaterial ?? production.isKeyPart ?? material?.isKeyPart ?? product?.isKeyPart,
    ),
    isAuxiliary: Boolean(
      process?.isAuxiliary ??
      production.isAuxiliary ??
      material?.isAuxiliary ??
      product?.isAuxiliary,
    ),
  }
}

/** 投料行展示用的物料主数据。 */
export function itemMasterCard(itemId) {
  const process = findProcessItem(itemId)
  const material = materialInfoState.materials.find((row) => row.id === itemId)
  const product = productInfoState.products.find((row) => row.id === itemId)
  const row = material || product
  const density = row?.density
  return {
    code: row?.code || process?.code || '',
    name: row?.name || process?.name || '',
    materialType: row?.materialType || '',
    specModel: row?.specModel || '',
    density: density == null || density === '' ? null : density,
    content: process?.content ?? row?.content ?? null,
    remark: row?.remark || '',
  }
}

function normalizeLine(line, baseBatchQty) {
  const content = line.convertByContent ? Number(line.content) : line.content
  const next = {
    itemId: line.itemId,
    feedQty: line.feedQty === '' || line.feedQty == null ? null : Number(line.feedQty),
    ratio: line.ratio === '' || line.ratio == null ? null : Number(line.ratio),
    lossRate: Number(line.lossRate) || 0,
    tolerance: line.tolerance === '' || line.tolerance == null ? null : Number(line.tolerance),
    feedSequence: Number(line.feedSequence) || 1,
    stepNo: Number(line.stepNo) > 0 ? Number(line.stepNo) : null,
    convertByContent: Boolean(line.convertByContent),
    content: line.content === '' || line.content == null ? null : Number(line.content),
    isKeyMaterial: Boolean(line.isKeyMaterial),
    isAuxiliary: Boolean(line.isAuxiliary),
  }
  if (next.tolerance != null && !(next.tolerance >= 0)) {
    throw new Error(`${itemLabel(next.itemId)}：允差不能小于 0`)
  }
  if (next.convertByContent) next.content = content
  const calc = calcTheoreticalFeed(next, baseBatchQty)
  if (!calc.ok) {
    const name = itemLabel(next.itemId)
    throw new Error(`${name}：${calc.message}`)
  }
  return { ...next, theoreticalQty: calc.qty }
}

export function validateFormula(payload) {
  const base = Number(payload.baseBatchQty)
  const y = Number(payload.theoreticalYield)
  if (!payload.name?.trim()) throw new Error('请填写配方名称')
  if (!FORMULA_TYPE_LABEL[payload.formulaType]) throw new Error('请选择配方类型')
  if (!payload.itemId) throw new Error('请选择主产品')
  if (!(base > 0)) throw new Error('基准批量必须大于 0')
  if (!(y >= 0 && y <= 1)) throw new Error('理论得率须在 0 到 1 之间')
  const outputs = payload.outputs || []
  const mains = outputs.filter((o) => o.role === 'main')
  if (mains.length !== 1) throw new Error('必须且只能有一条主产品')
  if (mains[0].itemId !== payload.itemId) throw new Error('主产品必须等于配方所属物料')
  outputs.forEach((o) => {
    if (!OUTPUT_ROLE_LABEL[o.role]) throw new Error('产出角色不正确')
    if (!o.itemId) throw new Error('产出物料不能为空')
    if (!(Number(o.expectedQty) > 0)) throw new Error('预期产出必须大于 0')
  })
  const lines = payload.lines || []
  if (!lines.length) throw new Error('请至少维护一行投料')
  lines.forEach((line) => {
    if (!line.itemId) throw new Error('投料物料不能为空')
  })
  const stepCount = (payload.steps || []).length
  const normalized = lines.map((line) => {
    const next = normalizeLine(line, base)
    if (next.stepNo != null && (next.stepNo > stepCount || !stepCount)) {
      throw new Error(`${itemLabel(next.itemId)} 的所属阶段不存在`)
    }
    return next
  })
  if (isRatioOnlyFormula(normalized) && !ratiosClosed(normalized)) {
    const percent = (sumFeedRatios(normalized) * 100).toFixed(2)
    throw new Error(`配比合计须为 100%，当前为 ${percent}%`)
  }
  return {
    lines: normalized,
    outputQty: theoreticalOutput(base, y),
  }
}

function clearOtherDefaults(row) {
  formulaState.formulas.forEach((f) => {
    if (f.id !== row.id && f.itemId === row.itemId) f.isDefault = false
  })
}

/** 生效配方的默认立即生效；待发布只保留一条「发布后设为默认」的意向。 */
function applyDefaultChoice(row) {
  if (row.status === 'active') {
    const otherActive = formulaState.formulas.some(
      (f) => f.id !== row.id && f.itemId === row.itemId && f.status === 'active',
    )
    if (!otherActive) row.isDefault = true
  }
  if (!row.isDefault) return
  if (row.status === 'active') {
    clearOtherDefaults(row)
    return
  }
  formulaState.formulas.forEach((f) => {
    if (f.id !== row.id && f.itemId === row.itemId && f.status !== 'active') f.isDefault = false
  })
}

function nextVersion(version) {
  const matched = String(version || '').match(/^V(\d+)\.(\d+)$/i)
  if (!matched) return 'V1.1'
  return `V${matched[1]}.${Number(matched[2]) + 1}`
}

function nextFormulaNo() {
  const base = `PF${dayjs().format('YYMMDDHHmmss')}`
  if (!formulaState.formulas.some((row) => row.formulaNo === base)) return base
  let seq = 2
  while (formulaState.formulas.some((row) => row.formulaNo === `${base}-${seq}`)) seq += 1
  return `${base}-${seq}`
}

function resolveFormulaNo(raw, { id, lineageId } = {}) {
  const formulaNo = String(raw || '').trim() || nextFormulaNo()
  const duplicated = formulaState.formulas.find(
    (row) =>
      row.formulaNo === formulaNo && row.id !== id && (!lineageId || row.lineageId !== lineageId),
  )
  if (duplicated) throw new Error(`配方编号 ${formulaNo} 已存在`)
  return formulaNo
}

/** 配方阶段化验快照：有数组（含空）则用配方快照；未维护时才从工序带出。 */
export function resolveFormulaStepAssaySchemes(step, process) {
  if (Array.isArray(step?.assaySchemes)) return normalizeProcessQcConfigs(step.assaySchemes)
  return normalizeProcessQcConfigs(process?.qcConfigs || [])
}

function normalizeFormulaSteps(steps) {
  const mapped = (steps || []).map((s, i) => {
    const name = String(s.name || '').trim() || `阶段${i + 1}`
    const processId = String(s.processId || '').trim()
    const equipmentCategory = String(s.equipmentCategory || '').trim()
    let equipmentIds = Array.isArray(s.equipmentIds)
      ? [...new Set(s.equipmentIds.map((id) => String(id || '').trim()).filter(Boolean))]
      : []
    const legacyId = String(s.equipmentId || '').trim()
    if (!equipmentIds.length && legacyId) equipmentIds = [legacyId]
    const proc = processId ? getProcessById(processId) : null
    for (const equipmentId of equipmentIds) {
      if (proc?.equipmentIds?.length && !proc.equipmentIds.includes(equipmentId)) {
        throw new Error(`${name} 的设备不在该工序允许的设备里`)
      }
    }
    const assaySchemes = resolveFormulaStepAssaySchemes(s, proc)
    return {
      stepNo: i + 1,
      name,
      processId,
      equipmentCategory,
      equipmentIds,
      // 兼容旧读法：默认台取候选第一台
      equipmentId: equipmentIds[0] || '',
      assaySchemes,
      gateMode: deriveProcessGateFromAssaySchemes(assaySchemes),
      params: (s.params || [])
        .filter((param) => String(param.name || '').trim())
        .map((param) => {
          const next = {
            name: String(param.name).trim(),
            unit: String(param.unit || '').trim(),
            target: param.target === '' || param.target == null ? null : Number(param.target),
            min: param.min === '' || param.min == null ? null : Number(param.min),
            max: param.max === '' || param.max == null ? null : Number(param.max),
          }
          if (next.min != null && next.max != null && next.min > next.max) {
            throw new Error(`${next.name} 的下限不能大于上限`)
          }
          return next
        }),
    }
  })
  return mapped
}

export function saveFormula(payload, id) {
  const checked = validateFormula(payload)
  const now = dayjs().format('YYYY-MM-DD HH:mm')
  const routeId = String(payload.routeId || '').trim()
  const route = routeId ? getProcessRouteById(routeId) : null
  if (routeId && !route) throw new Error('工艺路线不存在')
  const steps = normalizeFormulaSteps(payload.steps)
  if (route) {
    steps.forEach((step) => {
      const onProcess = collectRouteEquipmentIds(route, step.processId)
      const onRoute = onProcess.length ? onProcess : collectRouteEquipmentIds(route, '')
      const bad = (step.equipmentIds || []).find((id) => onRoute.length && !onRoute.includes(id))
      if (bad) {
        throw new Error(`${step.name} 的设备不在工艺路线上该工序挂的设备里`)
      }
    })
  }
  const operator = resolveOperatorName()
  const row = {
    name: payload.name.trim(),
    formulaType: payload.formulaType,
    itemId: payload.itemId,
    baseBatchQty: Number(payload.baseBatchQty),
    theoreticalYield: Number(payload.theoreticalYield),
    isDefault: Boolean(payload.isDefault),
    routeId,
    outputs: payload.outputs.map((o) => {
      const stepNo = Number(o.stepNo) > 0 ? Number(o.stepNo) : null
      const step = steps.find((item) => Number(item.stepNo) === stepNo)
      const fromSchemes = assayScopesFromSchemes(step?.assaySchemes)
      const spawn = normalizeDownstreamSpawn(o)
      if (spawn.downstreamSpawnEnabled && !spawn.downstreamFormulaIds.length) {
        throw new Error('启用「生成下游指令」时请至少选择一个下游配方')
      }
      const selfId = id || payload.id
      if (spawn.downstreamFormulaIds.some((fid) => fid === selfId)) {
        throw new Error('下游配方不能是本配方')
      }
      return {
        role: o.role,
        itemId: o.itemId,
        expectedQty: round3(o.expectedQty),
        stepNo,
        stepName: step?.name || o.stepName || '',
        // 优先按产出工序上的化验方案快照推导；无方案时保留行上手勾的业务类型
        assayScopes: fromSchemes.length ? fromSchemes : normalizeOutputAssayScopes(o.assayScopes),
        ...spawn,
      }
    }),
    lines: checked.lines,
    steps,
    updater: operator,
    updatedAt: now,
  }
  if (!id) {
    const formulaNo = resolveFormulaNo(payload.formulaNo)
    const created = {
      ...row,
      id: `formula-${Date.now()}`,
      formulaNo,
      lineageId: `lineage-${Date.now()}`,
      version: 'V1.0',
      status: 'pending',
      creator: operator,
      createdAt: now,
      operationLogs: [],
    }
    appendFormulaOperationLog(created, '创建', '新增配方')
    formulaState.formulas.unshift(created)
    applyDefaultChoice(created)
    return created
  }
  const current = getFormula(id)
  if (!current) throw new Error('配方不存在')
  if (current.status === 'archived') throw new Error('已归档配方不能修改')
  if (current.status === 'active') throw new Error('生效配方请先升版，再编辑待发布版本')
  const formulaNo = resolveFormulaNo(payload.formulaNo, {
    id: current.id,
    lineageId: current.lineageId,
  })
  Object.assign(current, row, {
    formulaNo,
    lineageId: current.lineageId || current.formulaNo || current.id,
    version: current.version,
    status: current.status,
    creator: current.creator || operator,
    createdAt: current.createdAt || now,
    operationLogs: Array.isArray(current.operationLogs) ? current.operationLogs : [],
  })
  appendFormulaOperationLog(current, '保存', '编辑保存')
  applyDefaultChoice(current)
  return current
}

export function publishFormula(id) {
  const row = getFormula(id)
  if (!row) throw new Error('配方不存在')
  if (row.status === 'active') throw new Error('当前版本已生效')
  validateFormula(row)
  const lineageId = row.lineageId || row.formulaNo || row.id
  row.lineageId = lineageId
  formulaState.formulas.forEach((f) => {
    if (f.lineageId === lineageId && f.id !== row.id && f.status === 'active') {
      f.status = 'archived'
      f.isDefault = false
      f.updater = resolveOperatorName()
      f.updatedAt = nowText()
      appendFormulaOperationLog(f, '归档', `被 ${row.version} 替换`)
    }
  })
  row.status = 'active'
  const otherActive = formulaState.formulas.some(
    (f) => f.id !== row.id && f.itemId === row.itemId && f.status === 'active',
  )
  if (row.isDefault || !otherActive) {
    row.isDefault = true
    clearOtherDefaults(row)
  }
  row.updater = resolveOperatorName()
  row.updatedAt = nowText()
  appendFormulaOperationLog(row, '审核发布', `版本 ${row.version} 生效`)
  return row
}

export function setDefaultFormula(id) {
  const row = getFormula(id)
  if (!row) throw new Error('配方不存在')
  if (row.status !== 'active') throw new Error('只有生效配方可以设为默认')
  row.isDefault = true
  clearOtherDefaults(row)
  row.updater = resolveOperatorName()
  row.updatedAt = nowText()
  appendFormulaOperationLog(row, '设为默认', '')
  return row
}

export function archiveFormula(id) {
  const row = getFormula(id)
  if (!row) throw new Error('配方不存在')
  if (row.status === 'archived') throw new Error('该配方已归档')
  row.status = 'archived'
  row.isDefault = false
  row.updater = resolveOperatorName()
  row.updatedAt = nowText()
  appendFormulaOperationLog(row, '归档', '')
  return row
}

export function deleteFormula(id) {
  const row = getFormula(id)
  if (!row) throw new Error('配方不存在')
  if (row.status !== 'pending') throw new Error('只有待发布配方可以删除')
  formulaState.formulas = formulaState.formulas.filter((f) => f.id !== id)
}

export function cloneFormula(id) {
  const source = getFormula(id)
  if (!source) throw new Error('配方不存在')
  const now = Date.now()
  const stamp = nowText()
  const operator = resolveOperatorName()
  const copy = {
    ...JSON.parse(JSON.stringify(source)),
    id: `formula-${now}`,
    formulaNo: nextFormulaNo(),
    lineageId: `lineage-${now}`,
    name: `${source.name} 副本`,
    version: 'V1.0',
    status: 'pending',
    isDefault: false,
    creator: operator,
    createdAt: stamp,
    updater: operator,
    updatedAt: stamp,
    operationLogs: [],
  }
  appendFormulaOperationLog(copy, '克隆', `来源 ${source.formulaNo} ${source.version}`)
  formulaState.formulas.unshift(copy)
  return copy
}

/** 同一张配方升版：编号和谱系不变，旧的生效版本留到新版本发布后再归档。 */
export function reviseFormula(id) {
  const source = getFormula(id)
  if (!source) throw new Error('配方不存在')
  if (source.status !== 'active') throw new Error('只有生效配方可以升版')
  const lineageId = source.lineageId || source.formulaNo || source.id
  const pending = formulaState.formulas.find(
    (f) => f.lineageId === lineageId && f.status === 'pending',
  )
  if (pending) throw new Error(`已有待发布版本 ${pending.version}，请先发布或删除`)
  const stamp = nowText()
  const operator = resolveOperatorName()
  const copy = {
    ...JSON.parse(JSON.stringify(source)),
    id: `formula-${Date.now()}`,
    lineageId,
    formulaNo: source.formulaNo,
    version: nextVersion(source.version),
    status: 'pending',
    isDefault: Boolean(source.isDefault),
    creator: operator,
    createdAt: stamp,
    updater: operator,
    updatedAt: stamp,
    operationLogs: [],
  }
  appendFormulaOperationLog(copy, '升版', `基于 ${source.version}`)
  appendFormulaOperationLog(source, '升版', `生成待发布 ${copy.version}`)
  formulaState.formulas.unshift(copy)
  return copy
}

export function listFormulaVersionsByLineage(lineageId) {
  const id = String(lineageId || '').trim()
  if (!id) return []
  return formulaState.formulas
    .filter((row) => (row.lineageId || row.formulaNo || row.id) === id)
    .slice()
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

export function listActiveFormulas() {
  return formulaState.formulas.filter((f) => f.status === 'active')
}

export { PROCESS_ITEMS }
