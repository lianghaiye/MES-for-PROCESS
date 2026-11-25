/**
 * 设备管理：流程型设备台账 / 点检 / 保养 / 维修 演示种子
 */
import dayjs from 'dayjs'
import { getWorkCenterByName } from '@/store/workCenterStore'

export const EQUIPMENT_STATUS = {
  IN_USE: '在用',
  IDLE: '闲置',
  REPAIRING: '维修中',
  SCRAPPED: '报废',
}

export const EQUIPMENT_STATUS_OPTIONS = Object.values(EQUIPMENT_STATUS).map((v) => ({
  label: v,
  value: v,
}))

/**
 * 反应设备、储运设备才维护占釜状态。
 * 容积：上述类型，或勾选「作为库存存放点」时必填（同步库存位置需要罐容）。
 */
export const VESSEL_CATEGORIES = ['反应设备', '储运设备']

export const EQUIPMENT_OCCUPY_STATUS = {
  CLEAN: '清洁',
  OCCUPIED: '在用',
  WAIT_DISCHARGE: '待出料',
}

export const EQUIPMENT_OCCUPY_STATUS_OPTIONS = Object.values(EQUIPMENT_OCCUPY_STATUS).map((v) => ({
  label: v,
  value: v,
}))

export const CAPACITY_UNIT_OPTIONS = [
  { label: 'L', value: 'L' },
  { label: 'm³', value: 'm³' },
  { label: 'kg', value: 'kg' },
]

export function isVesselCategory(category) {
  return VESSEL_CATEGORIES.includes(category)
}

/** 是否需要维护容积（反应/储运，或作为库存存放点）。 */
export function needsCapacityFields(payload = {}) {
  return isVesselCategory(payload.category) || Boolean(payload.asStockLocation)
}

function positiveOrNull(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * 容积校验：反应/储运设备或「作为库存存放点」时公称容积必填；
 * 占釜状态仅反应/储运设备必填。
 */
export function validateVesselCapacity(payload = {}) {
  const vessel = isVesselCategory(payload.category)
  const asStock = Boolean(payload.asStockLocation)
  if (!vessel && !asStock) return { ok: true }
  const nominal = positiveOrNull(payload.nominalCapacity)
  if (!(nominal > 0)) return { ok: false, message: '请填写大于 0 的公称容积' }
  const unit = String(payload.capacityUnit || '').trim()
  if (!CAPACITY_UNIT_OPTIONS.some((item) => item.value === unit)) {
    return { ok: false, message: '请选择容积单位' }
  }
  const working = positiveOrNull(payload.workingCapacity)
  if (payload.workingCapacity != null && payload.workingCapacity !== '' && !(working > 0)) {
    return { ok: false, message: '工作容积须大于 0' }
  }
  if (working != null && working - nominal > 1e-9) {
    return { ok: false, message: '工作容积不能超过公称容积' }
  }
  if (vessel) {
    const occupy = payload.occupyStatus || EQUIPMENT_OCCUPY_STATUS.CLEAN
    if (!Object.values(EQUIPMENT_OCCUPY_STATUS).includes(occupy)) {
      return { ok: false, message: '请选择占釜状态' }
    }
  }
  return { ok: true }
}

/**
 * 流程型企业设备类型基础枚举（后续可迁业务字典，供租户自定义扩展）。
 * 「是否库存存放点」由 asStockLocation 单独控制，不与类型绑定。
 */
export const EQUIPMENT_CATEGORY_OPTIONS = [
  { label: '反应设备', value: '反应设备' },
  { label: '换热设备', value: '换热设备' },
  { label: '分离设备', value: '分离设备' },
  { label: '储运设备', value: '储运设备' },
  { label: '输送设备', value: '输送设备' },
  { label: '干燥设备', value: '干燥设备' },
  { label: '计量灌装', value: '计量灌装' },
  { label: '公用工程', value: '公用工程' },
  { label: '其他', value: '其他' },
]

/** 旧版「储罐」类型 → 储运设备 + 作为库存存放点 */
export function migrateLegacyEquipmentCategory(category, asStockLocation) {
  const raw = String(category || '').trim()
  if (raw === '储罐') {
    return { category: '储运设备', asStockLocation: true }
  }
  return {
    category: raw || '公用工程',
    asStockLocation: Boolean(asStockLocation),
  }
}

export const INSPECTION_CYCLE_OPTIONS = [
  { label: '每班', value: '每班' },
  { label: '每日', value: '每日' },
  { label: '每周', value: '每周' },
]

export const INSPECTION_TASK_STATUS = {
  PENDING: '待执行',
  DONE: '已完成',
  ABNORMAL: '异常',
}

export const MAINTAIN_TYPE_OPTIONS = [
  { label: '日常保养', value: '日常保养' },
  { label: '一级保养', value: '一级保养' },
  { label: '二级保养', value: '二级保养' },
]

export const MAINTAIN_ORDER_STATUS = {
  PENDING: '待执行',
  DONE: '已完成',
  OVERDUE: '已逾期',
}

export const REPAIR_STATUS = {
  PENDING: '待派工',
  DOING: '维修中',
  ACCEPT: '待验收',
  CLOSED: '已关闭',
}

export const REPAIR_SOURCE_OPTIONS = [
  { label: '人工报修', value: '人工报修' },
  { label: '点检异常', value: '点检异常' },
  { label: '保养异常', value: '保养异常' },
]

function nowText() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss')
}

export function createEquipmentDeviceSeed() {
  const t = nowText()
  return [
    {
      id: 'eq-d-1',
      code: 'EQ-R-101',
      name: '配料罐 R-101',
      category: '反应设备',
      model: 'JK-2000L',
      workCenterId: 'wc-paint',
      location: 'A区-配料跨',
      status: EQUIPMENT_STATUS.IN_USE,
      nominalCapacity: 2000,
      workingCapacity: 1300,
      capacityUnit: 'L',
      occupyStatus: EQUIPMENT_OCCUPY_STATUS.CLEAN,
      occupiedBatchNo: '',
      responsible: '配料班长',
      manufacturer: '南通反应设备',
      installDate: '2023-05-12',
      remark: '带称重模块，常用于固体/液体投料',
      creator: '系统管理员',
      createdAt: t,
      updater: '系统管理员',
      updatedAt: t,
    },
    {
      id: 'eq-d-2',
      code: 'EQ-R-201',
      name: '反应釜 R-201',
      category: '反应设备',
      model: 'FK-5000L',
      workCenterId: 'wc-react',
      location: 'B区-1号位',
      status: EQUIPMENT_STATUS.IN_USE,
      nominalCapacity: 5000,
      workingCapacity: 3300,
      capacityUnit: 'L',
      occupyStatus: EQUIPMENT_OCCUPY_STATUS.OCCUPIED,
      occupiedBatchNo: '',
      responsible: '反应班长',
      manufacturer: '无锡化工设备',
      installDate: '2022-09-18',
      remark: '夹套加热，带搅拌与温控',
      creator: '系统管理员',
      createdAt: t,
      updater: '系统管理员',
      updatedAt: t,
    },
    {
      id: 'eq-d-3',
      code: 'EQ-F-301',
      name: '板框过滤机 F-301',
      category: '分离设备',
      model: 'BK-80',
      workCenterId: 'wc-acid-1',
      location: 'C区-过滤线',
      status: EQUIPMENT_STATUS.IN_USE,
      responsible: '分离班长',
      manufacturer: '杭州过滤设备',
      installDate: '2023-01-20',
      remark: '滤液/滤渣分路收集',
      creator: '系统管理员',
      createdAt: t,
      updater: '系统管理员',
      updatedAt: t,
    },
    {
      id: 'eq-d-4',
      code: 'EQ-C-401',
      name: '离心机 C-401',
      category: '分离设备',
      model: 'LX-1200',
      workCenterId: 'wc-acid-1',
      location: 'C区-离心线',
      status: EQUIPMENT_STATUS.IN_USE,
      responsible: '分离班长',
      manufacturer: '湘潭离心机',
      installDate: '2021-11-08',
      remark: '',
      creator: '系统管理员',
      createdAt: t,
      updater: '系统管理员',
      updatedAt: t,
    },
    {
      id: 'eq-d-5',
      code: 'EQ-T-501',
      name: '中间罐 T-501',
      category: '储运设备',
      asStockLocation: true,
      model: 'CG-3000L',
      workCenterId: 'wc-mvr',
      location: 'D区-中间罐区',
      status: EQUIPMENT_STATUS.IN_USE,
      nominalCapacity: 3000,
      workingCapacity: 2000,
      capacityUnit: 'L',
      occupyStatus: EQUIPMENT_OCCUPY_STATUS.WAIT_DISCHARGE,
      occupiedBatchNo: '',
      stockKeeperName: '储运班长',
      responsible: '储运班长',
      manufacturer: '自制',
      installDate: '2022-04-15',
      remark: '过滤/离心后暂存',
      creator: '系统管理员',
      createdAt: t,
      updater: '系统管理员',
      updatedAt: t,
    },
    {
      id: 'eq-d-6',
      code: 'EQ-T-601',
      name: '成品罐 T-601',
      category: '储运设备',
      asStockLocation: true,
      model: 'CG-5000L',
      workCenterId: 'wc-mvr',
      location: 'D区-成品罐区',
      status: EQUIPMENT_STATUS.IN_USE,
      nominalCapacity: 5000,
      workingCapacity: null,
      capacityUnit: 'L',
      occupyStatus: EQUIPMENT_OCCUPY_STATUS.CLEAN,
      occupiedBatchNo: '',
      stockKeeperName: '储运班长',
      responsible: '储运班长',
      manufacturer: '自制',
      installDate: '2022-04-16',
      remark: '',
      creator: '系统管理员',
      createdAt: t,
      updater: '系统管理员',
      updatedAt: t,
    },
    {
      id: 'eq-d-7',
      code: 'EQ-P-701',
      name: '计量灌装机 P-701',
      category: '计量灌装',
      model: 'GZ-50',
      workCenterId: 'wc-assy',
      location: 'E区-灌装线',
      status: EQUIPMENT_STATUS.IDLE,
      responsible: '灌装班长',
      manufacturer: '广州包装机械',
      installDate: '2024-02-01',
      remark: '待校准称重传感器',
      creator: '系统管理员',
      createdAt: t,
      updater: '系统管理员',
      updatedAt: t,
    },
  ]
}

export function createInspectionStandardSeed() {
  const t = nowText()
  return [
    {
      id: 'eq-is-1',
      code: 'IS-REACTOR-DAY',
      name: '反应釜日点检',
      category: '反应设备',
      cycle: '每日',
      enabled: true,
      items: [
        {
          id: 'i1',
          name: '搅拌运转正常',
          checkType: '勾选',
          standard: '无异响、无卡滞',
          required: true,
        },
        {
          id: 'i2',
          name: '夹套压力',
          checkType: '数值',
          standard: '≤0.4 MPa',
          required: true,
        },
        {
          id: 'i3',
          name: '温度探头显示',
          checkType: '勾选',
          standard: '与现场表一致',
          required: true,
        },
        {
          id: 'i4',
          name: '人孔/密封完好',
          checkType: '勾选',
          standard: '无泄漏',
          required: true,
        },
      ],
      remark: '',
      creator: '系统管理员',
      createdAt: t,
      updater: '系统管理员',
      updatedAt: t,
    },
    {
      id: 'eq-is-2',
      code: 'IS-FILTER-SHIFT',
      name: '过滤机班前点检',
      category: '分离设备',
      cycle: '每班',
      enabled: true,
      items: [
        {
          id: 'i1',
          name: '滤布完好',
          checkType: '勾选',
          standard: '无破损、无严重堵塞',
          required: true,
        },
        {
          id: 'i2',
          name: '液压/进料泵',
          checkType: '勾选',
          standard: '空载试运正常',
          required: true,
        },
        {
          id: 'i3',
          name: '出液管路畅通',
          checkType: '勾选',
          standard: '滤液/滤渣分路正常',
          required: true,
        },
      ],
      remark: '',
      creator: '系统管理员',
      createdAt: t,
      updater: '系统管理员',
      updatedAt: t,
    },
  ]
}

export function createInspectionTaskSeed(devices = [], standards = []) {
  const today = dayjs().format('YYYY-MM-DD')
  const t = nowText()
  const reactor = devices.find((d) => d.code === 'EQ-R-201') || devices[1] || devices[0]
  const filter = devices.find((d) => d.code === 'EQ-F-301') || devices[2]
  const stdReactor = standards.find((s) => s.code === 'IS-REACTOR-DAY') || standards[0]
  const stdFilter = standards.find((s) => s.code === 'IS-FILTER-SHIFT') || standards[1]
  return [
    {
      id: 'eq-it-1',
      taskNo: `DJ${dayjs().format('YYYYMMDD')}001`,
      standardId: stdReactor?.id,
      standardName: stdReactor?.name || '反应釜日点检',
      deviceId: reactor?.id,
      deviceCode: reactor?.code,
      deviceName: reactor?.name,
      planDate: today,
      status: INSPECTION_TASK_STATUS.PENDING,
      executor: '',
      executedAt: '',
      results: [],
      remark: '',
      createdAt: t,
    },
    {
      id: 'eq-it-2',
      taskNo: `DJ${dayjs().format('YYYYMMDD')}002`,
      standardId: stdFilter?.id,
      standardName: stdFilter?.name || '过滤机班前点检',
      deviceId: filter?.id,
      deviceCode: filter?.code,
      deviceName: filter?.name,
      planDate: today,
      status: INSPECTION_TASK_STATUS.PENDING,
      executor: '',
      executedAt: '',
      results: [],
      remark: '',
      createdAt: t,
    },
  ]
}

export function createMaintainOrderSeed(devices = []) {
  const today = dayjs().format('YYYY-MM-DD')
  const nextWeek = dayjs().add(7, 'day').format('YYYY-MM-DD')
  const t = nowText()
  const reactor = devices.find((d) => d.code === 'EQ-R-201') || devices[1] || devices[0]
  const centrifuge = devices.find((d) => d.code === 'EQ-C-401') || devices[3]
  return [
    {
      id: 'eq-mo-1',
      orderNo: `BY${dayjs().format('YYYYMMDD')}001`,
      deviceId: reactor?.id,
      deviceCode: reactor?.code,
      deviceName: reactor?.name,
      maintainType: '一级保养',
      planDate: today,
      status: MAINTAIN_ORDER_STATUS.PENDING,
      items: [
        { id: 'm1', name: '检查搅拌密封与轴承润滑', done: false },
        { id: 'm2', name: '清洗夹套进出水口滤网', done: false },
        { id: 'm3', name: '校验温控显示', done: false },
      ],
      executor: '',
      executedAt: '',
      remark: '',
      createdAt: t,
    },
    {
      id: 'eq-mo-2',
      orderNo: `BY${dayjs().format('YYYYMMDD')}002`,
      deviceId: centrifuge?.id,
      deviceCode: centrifuge?.code,
      deviceName: centrifuge?.name,
      maintainType: '日常保养',
      planDate: nextWeek,
      status: MAINTAIN_ORDER_STATUS.PENDING,
      items: [
        { id: 'm1', name: '清理转鼓残留', done: false },
        { id: 'm2', name: '检查制动与急停', done: false },
      ],
      executor: '',
      executedAt: '',
      remark: '',
      createdAt: t,
    },
  ]
}

export function createRepairOrderSeed(devices = []) {
  const t = nowText()
  const filler = devices.find((d) => d.code === 'EQ-P-701') || devices[6] || devices[0]
  return [
    {
      id: 'eq-ro-1',
      orderNo: `WX${dayjs().format('YYYYMMDD')}001`,
      deviceId: filler?.id,
      deviceCode: filler?.code,
      deviceName: filler?.name,
      source: '人工报修',
      faultDesc: '称重传感器读数漂移，无法完成灌装计量',
      status: REPAIR_STATUS.PENDING,
      reporter: '灌装班长',
      handler: '',
      result: '',
      spareParts: '',
      reportedAt: t,
      closedAt: '',
      remark: '',
      createdAt: t,
      updatedAt: t,
    },
  ]
}

export function normalizeDevice(row = {}) {
  // 兼容旧数据：类别「储罐」迁为「储运设备」并默认作为库存存放点
  const migrated = migrateLegacyEquipmentCategory(row.category, row.asStockLocation)
  const category = migrated.category
  const asStockLocation = migrated.asStockLocation
  const vessel = isVesselCategory(category)
  // 容积：反应/储运，或勾选库存存放点都要保留
  const keepCapacity = vessel || asStockLocation
  const occupy = vessel ? row.occupyStatus || EQUIPMENT_OCCUPY_STATUS.CLEAN : ''
  const holdsBatch =
    occupy === EQUIPMENT_OCCUPY_STATUS.OCCUPIED || occupy === EQUIPMENT_OCCUPY_STATUS.WAIT_DISCHARGE
  return {
    id: row.id || `eq-d-${Date.now()}`,
    code: String(row.code || '').trim(),
    name: String(row.name || '').trim(),
    category,
    /** 勾选后保存同步库存「储罐位置」，与设备类型解耦 */
    asStockLocation,
    model: row.model || '',
    // 所属工作中心：优先 id；旧数据 workshop 文本按名称回落匹配
    workCenterId:
      String(row.workCenterId || '').trim() || getWorkCenterByName(row.workshop)?.id || '',
    location: row.location || '',
    status: row.status || EQUIPMENT_STATUS.IN_USE,
    nominalCapacity: keepCapacity ? positiveOrNull(row.nominalCapacity) : null,
    workingCapacity: keepCapacity ? positiveOrNull(row.workingCapacity) : null,
    capacityUnit: keepCapacity ? String(row.capacityUnit || 'L').trim() : '',
    occupyStatus: occupy,
    occupiedBatchNo: vessel && holdsBatch ? String(row.occupiedBatchNo || '').trim() : '',
    /** 作为库存存放点时挂接的库存位置 id（由同步写入） */
    inventoryLocationId: asStockLocation ? String(row.inventoryLocationId || '').trim() : '',
    /**
     * 库存责任人：仅 asStockLocation 时有效，同步到库存位置 managerName。
     * 与设备维保「责任人」responsible 分开，避免混用。
     */
    stockKeeperName: asStockLocation ? String(row.stockKeeperName || '').trim() : '',
    responsible: row.responsible || '',
    manufacturer: row.manufacturer || '',
    installDate: row.installDate || '',
    remark: row.remark || '',
    creator: row.creator || 'admin1',
    createdAt: row.createdAt || nowText(),
    updater: row.updater || row.creator || 'admin1',
    updatedAt: row.updatedAt || row.createdAt || nowText(),
  }
}

export function normalizeInspectionStandard(row = {}) {
  const items = Array.isArray(row.items)
    ? row.items.map((it, i) => ({
        id: it.id || `item-${i + 1}`,
        name: String(it.name || '').trim(),
        checkType: it.checkType === '数值' ? '数值' : '勾选',
        standard: it.standard || '',
        required: it.required !== false,
      }))
    : []
  return {
    id: row.id || `eq-is-${Date.now()}`,
    code: String(row.code || '').trim(),
    name: String(row.name || '').trim(),
    category: row.category || '',
    cycle: row.cycle || '每日',
    enabled: row.enabled !== false,
    items,
    remark: row.remark || '',
    creator: row.creator || 'admin1',
    createdAt: row.createdAt || nowText(),
    updater: row.updater || row.creator || 'admin1',
    updatedAt: row.updatedAt || row.createdAt || nowText(),
  }
}
