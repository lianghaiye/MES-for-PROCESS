/** 顶栏一级模块 */
export const topModules = [
  { key: 'home', label: '首页', path: '/home' },
  { key: 'product-process', label: '产品工艺', path: '/product-process' },
  { key: 'sales', label: '销售管理', path: '/sales' },
  { key: 'contracts', label: '合同管理', path: '/contracts' },
  { key: 'planning', label: '计划排产', path: '/planning' },
  { key: 'production', label: '生产管理', path: '/production' },
  { key: 'inventory', label: '库存管理', path: '/inventory' },
  { key: 'quality', label: '质量管理', path: '/quality' },
  { key: 'procurement', label: '采购管理', path: '/procurement' },
  { key: 'settlement', label: '往来结算', path: '/settlement' },
  { key: 'after-sales', label: '售后管理', path: '/after-sales' },
  { key: 'basic-config', label: '基础配置', path: '/basic-config' },
  { key: 'system', label: '系统管理', path: '/system' },
]

/** 顶栏「更多」下拉模块（WMS/QMS 等扩展入口） */
export const moreModules = [
  { key: 'board', label: '看板管理', path: '/board' },
  { key: 'equipment', label: '设备管理', path: '/equipment' },
  { key: 'report', label: '报表中心', path: '/report' },
]

/** 各模块左侧子菜单 */
export const sideMenus = {
  home: [
    { key: 'dashboard', label: '工作台', path: '/home/dashboard' },
    { key: 'message-center', label: '消息中心', path: '/home/message-center' },
    {
      key: 'feedback',
      label: '意见反馈',
      path: '/home/feedback',
    },
    {
      key: 'workbench-admin',
      label: '工作台内容管理',
      path: '/home/workbench-admin',
    },
    {
      key: 'data-cockpit',
      label: '数据驾驶舱',
      path: '/home/data-cockpit',
    },
    {
      key: 'director-dashboard',
      label: '车间主任工作台',
      path: '/home/director-dashboard',
    },
    {
      key: 'prd',
      label: 'PRD',
      children: [
        { key: 'prd-index', label: 'IDOMS PRD', path: '/home/prd' },
        { key: 'prd-v15', label: '1.5版本迭代', path: '/home/prd/v15' },
        { key: 'prd-v151', label: '1.5.1版本迭代', path: '/home/prd/v151' },
      ],
    },
  ],
  'product-process': [
    { key: 'products', label: '产品信息', path: '/product-process/products' },
    { key: 'bom', label: '配方管理', path: '/product-process/bom' },
    { key: 'routing', label: '工艺路线', path: '/product-process/routing' },
    { key: 'process-config', label: '工序配置', path: '/product-process/process-config' },
    { key: 'production-line', label: '产线管理', path: '/product-process/production-line' },
    { key: 'process-doc', label: '工艺文件', path: '/product-process/process-doc' },
    { key: 'process-category', label: '工序分类', path: '/product-process/process-category' },
    {
      key: 'process-field-library',
      label: '采集指标库',
      path: '/product-process/process-field-library',
    },
    { key: 'process-form', label: '过程记录模板', path: '/product-process/process-form' },
  ],
  sales: [
    { key: 'orders', label: '销售订单', path: '/sales/orders' },
    { key: 'order-changes', label: '订单变更管理', path: '/sales/order-changes' },
    { key: 'sales-lines', label: '销售明细', path: '/sales/sales-lines' },
    { key: 'delivery', label: '发货管理', path: '/sales/delivery' },
  ],
  contracts: [
    { key: 'contract-ledger', label: '合同台账', path: '/contracts' },
    { key: 'contract-changes', label: '合同变更', path: '/contracts/changes' },
  ],
  planning: [
    { key: 'production-plan', label: '生产计划', path: '/planning/production-plan' },
    {
      key: 'shift-energy-report',
      label: '交班能耗填报',
      path: '/planning/shift-energy-report',
    },
    { key: 'replenish-center', label: '库存预警', path: '/planning/replenish-center' },
    { key: 'replenish-ledger', label: '补货台账', path: '/planning/replenish-ledger' },
  ],
  'labor-salary': [{ key: 'labor-hour', label: '工时管理', path: '/labor-salary/labor-hour' }],
  production: [
    { key: 'work-orders', label: '批次指令', path: '/production/work-orders' },
    {
      key: 'pending-output',
      label: '待处置产出',
      path: '/production/pending-output',
    },
    { key: 'rework-orders', label: '返工管理', path: '/production/rework-orders' },
    {
      key: 'material-requisition',
      label: '领料管理',
      path: '/production/material-requisition',
    },
    {
      key: 'feed-posting',
      label: '投料明细',
      path: '/production/feed-posting',
    },
    {
      key: 'finished-inbound',
      label: '产出入库',
      path: '/production/finished-inbound',
    },
    {
      key: 'arrival-tracking',
      label: '到货跟踪',
      path: '/production/arrival-tracking',
    },
  ],
  'report-management': [
    { key: 'report-work', label: '报工确认', path: '/report-management/report-work' },
    { key: 'process-report', label: '工序报工', path: '/report-management/process-report' },
    { key: 'salary-summary', label: '工资核算', path: '/report-management/salary-summary' },
    { key: 'salary-detail', label: '核算详情', path: '/report-management/salary-detail' },
  ],
  inventory: [
    { key: 'pending-outbound', label: '待出库列表', path: '/inventory/pending-outbound' },
    { key: 'outbound', label: '出库管理', path: '/inventory/outbound' },
    { key: 'pending-inbound', label: '待入库列表', path: '/inventory/pending-inbound' },
    { key: 'inbound', label: '入库管理', path: '/inventory/inbound' },
    { key: 'transfer', label: '调拨管理', path: '/inventory/transfer' },
    { key: 'stocktake', label: '盘点管理', path: '/inventory/stocktake' },
    { key: 'material-batches', label: '原料批次', path: '/inventory/material-batches' },
    { key: 'expiry-alerts', label: '效期预警', path: '/inventory/expiry-alerts' },
    { key: 'tanks', label: '储罐液位', path: '/inventory/tanks' },
    { key: 'stock-detail', label: '库存明细', path: '/inventory/stock-detail' },
    { key: 'outbound-details', label: '出库详情', path: '/inventory/outbound-details' },
    { key: 'inbound-details', label: '入库详情', path: '/inventory/inbound-details' },
  ],
  quality: [
    { key: 'incoming-qc', label: '来料化验', path: '/quality/incoming-qc' },
    { key: 'process-qc', label: '过程化验', path: '/quality/process-qc' },
    { key: 'finished-qc', label: '产出化验', path: '/quality/finished-qc' },
    { key: 'factory-qc', label: '出厂化验', path: '/quality/factory-qc' },
    { key: 'scrap-orders', label: '报废品管理', path: '/quality/scrap-orders' },
    { key: 'qc-template', label: '化验模板', path: '/quality/qc-template' },
    { key: 'qc-field-library', label: '化验指标库', path: '/quality/qc-field-library' },
  ],
  procurement: [
    { key: 'purchase-req', label: '采购申请', path: '/procurement/purchase-req' },
    { key: 'purchase-orders', label: '采购订单', path: '/procurement/purchase-orders' },
    { key: 'purchase-receipts', label: '采购收货', path: '/procurement/purchase-receipts' },
    { key: 'purchase-returns', label: '采购退货', path: '/procurement/purchase-returns' },
    { key: 'purchase-details', label: '采购明细', path: '/procurement/purchase-details' },
  ],
  outsourcing: [
    { key: 'outsourcing-orders', label: '外协订单', path: '/procurement/outsourcing-orders' },
    {
      key: 'outsourcing-issue',
      label: '发料管理',
      path: '/procurement/outsourcing-issue',
    },
    { key: 'outsourcing-receipts', label: '外协收货', path: '/procurement/outsourcing-receipts' },
    { key: 'outsourcing-returns', label: '外协异常处理', path: '/procurement/outsourcing-returns' },
    { key: 'outsourcing-details', label: '外协明细', path: '/procurement/outsourcing-details' },
  ],
  'after-sales': [
    { key: 'service-orders', label: '服务工单', path: '/after-sales/service-orders' },
    { key: 'returns', label: '退换货', path: '/after-sales/returns' },
  ],
  'industrial-id': [
    { key: 'label-request', label: '标识申请', path: '/industrial-id/label-request' },
    { key: 'label-management', label: '标识管理', path: '/industrial-id/label-management' },
    {
      key: 'enterprise-info',
      label: '企业信息',
      path: '/industrial-id/base-config/enterprise-info',
    },
    {
      key: 'nameplate-template',
      label: '产品信息模板',
      path: '/industrial-id/base-config/nameplate-template',
    },
  ],
  'basic-config': [
    { key: 'company-profile', label: '企业信息', path: '/basic-config/company-profile' },
    { key: 'employee-groups', label: '员工组别', path: '/basic-config/employee-groups' },
    { key: 'defect-items', label: '不良品项', path: '/basic-config/defect-items' },
    { key: 'material-grades', label: '材质管理', path: '/basic-config/material-grades' },
    { key: 'units', label: '单位管理', path: '/basic-config/units' },
    {
      key: 'process-param-units',
      label: '工艺参数单位',
      path: '/basic-config/process-param-units',
    },
    { key: 'packaging', label: '包装管理', path: '/basic-config/packaging' },
    { key: 'business-dict', label: '业务字典', path: '/basic-config/business-dict' },
    {
      key: 'warehouse-mgmt',
      label: '仓库管理',
      children: [
        { key: 'warehouses', label: '仓库列表', path: '/basic-config/warehouses' },
        {
          key: 'warehouse-locations',
          label: '货位管理',
          path: '/basic-config/warehouse-locations',
        },
        {
          key: 'warehouse-categories',
          label: '仓库分类',
          path: '/basic-config/warehouse-categories',
        },
      ],
    },
    {
      key: 'customer-mgmt',
      label: '客户管理',
      children: [
        { key: 'customers', label: '客户档案', path: '/basic-config/customers' },
        { key: 'customer-types', label: '客户类型', path: '/basic-config/customer-types' },
      ],
    },
    {
      key: 'supplier-mgmt',
      label: '供应商管理',
      children: [
        { key: 'suppliers', label: '供应商档案', path: '/basic-config/suppliers' },
        {
          key: 'supplier-categories',
          label: '供应商分类',
          path: '/basic-config/supplier-categories',
        },
      ],
    },
  ],
  settlement: [
    { key: 'payments', label: '回款管理', path: '/settlement/payments' },
    { key: 'customer-ledger', label: '客户往来', path: '/settlement/customer-ledger' },
    { key: 'purchase-settles', label: '采购对账', path: '/settlement/purchase-settles' },
    { key: 'dispute-accruals', label: '争议挂账', path: '/settlement/dispute-accruals' },
    { key: 'supplier-ledger', label: '供应商往来', path: '/settlement/supplier-ledger' },
    { key: 'ticket-fund-flow', label: '票款流水', path: '/settlement/ticket-fund-flow' },
    { key: 'settle-rules', label: '结算规则', path: '/settlement/settle-rules' },
  ],
  system: [
    { key: 'dict', label: '系统字典', path: '/system/dict' },
    { key: 'coding-rules', label: '编码规则', path: '/system/coding-rules' },
    { key: 'business-rules', label: '业务规则', path: '/system/business-rules' },
    { key: 'function-params', label: '功能参数', path: '/system/function-params' },
    { key: 'message-notify', label: '消息通知配置', path: '/system/message-notify' },
  ],

  board: [
    { key: 'catalog', label: '看板列表', path: '/board/catalog' },
    { key: 'carousel', label: '轮播管理', path: '/board/carousel' },
    {
      key: 'work-order-monitor',
      label: '工单监管看板',
      path: '/board/work-order-monitor',
      openInBrowserTab: true,
      browserTabPath: '/board/work-order-monitor/screen',
    },
    {
      key: 'kit-supply',
      label: '齐套与供应看板',
      path: '/board/kit-supply',
      openInBrowserTab: true,
      browserTabPath: '/board/kit-supply/screen',
    },
  ],
  wms: [{ key: 'warehouse', label: '仓库作业', path: '/wms/warehouse' }],
  qms: [{ key: 'trace', label: '质量追溯', path: '/qms/trace' }],
  equipment: [
    { key: 'devices', label: '设备台账', path: '/equipment/devices' },
    {
      key: 'inspection-standards',
      label: '点检标准',
      path: '/equipment/inspection-standards',
    },
    { key: 'inspection-tasks', label: '点检任务', path: '/equipment/inspection-tasks' },
    { key: 'maintain-orders', label: '保养工单', path: '/equipment/maintain-orders' },
    { key: 'repair-orders', label: '维修工单', path: '/equipment/repair-orders' },
  ],
  report: [
    { key: 'overview', label: '报表目录', path: '/report/overview' },
    {
      key: 'sales-reports',
      label: '销售报表',
      children: [
        { key: 'sales-order-exec', label: '销售订单执行表', path: '/report/sales-order-exec' },
        { key: 'sales-line-summary', label: '销售明细汇总表', path: '/report/sales-line-summary' },
        {
          key: 'sales-delivery-achieve',
          label: '发货达成表',
          path: '/report/sales-delivery-achieve',
        },
        {
          key: 'sales-order-cost',
          label: '销售订单成本表',
          path: '/report/sales-order-cost',
        },
      ],
    },
    {
      key: 'procurement-reports',
      label: '采购/外协报表',
      children: [
        {
          key: 'purchase-order-exec',
          label: '采购订单执行表',
          path: '/report/purchase-order-exec',
        },
        {
          key: 'outsourcing-order-exec',
          label: '外协订单执行表',
          path: '/report/outsourcing-order-exec',
        },
      ],
    },
    {
      key: 'inventory-reports',
      label: '库存报表',
      children: [
        {
          key: 'inventory-io-balance',
          label: '库存收发存表',
          path: '/report/inventory-io-balance',
        },
      ],
    },
    {
      key: 'quality-reports',
      label: '化验报表',
      children: [{ key: 'qc-task-stats', label: '化验任务统计表', path: '/report/qc-task-stats' }],
    },
  ],
}

/** 按 path 查找侧栏菜单项（含嵌套） */
export function findSideMenuItemByPath(path) {
  const walk = (items = []) => {
    for (const item of items) {
      if (item.path === path) return item
      if (item.children?.length) {
        const hit = walk(item.children)
        if (hit) return hit
      }
    }
    return null
  }
  for (const items of Object.values(sideMenus)) {
    const hit = walk(items)
    if (hit) return hit
  }
  return null
}

/** 根据路由路径解析所属顶栏模块 key */
export function resolveModuleKey(path) {
  // 外协页面仍挂在 /procurement/outsourcing-*，顶栏归「外协管理」
  if (path.startsWith('/procurement/outsourcing')) return 'outsourcing'
  const segment = path.split('/').filter(Boolean)[0]
  if (!segment) return 'home'
  const all = [...topModules, ...moreModules]
  const found = all.find((m) => m.key === segment)
  return found ? found.key : 'home'
}

/** 取模块左侧菜单中第一个可导航路径（支持嵌套 children） */
export function findFirstSideMenuPath(items = []) {
  for (const item of items) {
    if (item.path) return item.path
    if (item.children?.length) {
      const nested = findFirstSideMenuPath(item.children)
      if (nested) return nested
    }
  }
  return null
}

/** 顶栏模块默认落地页：优先 mod.path（非 /{key} 占位），否则取侧栏首项 */
export function resolveModuleDefaultPath(mod) {
  if (!mod) return null
  const bare = `/${mod.key}`
  if (mod.path && mod.path !== bare) return mod.path
  return findFirstSideMenuPath(sideMenus[mod.key] || []) || mod.path || null
}

/** 路由 meta.title 映射 */
import { createPageRegistry } from './createPages'

const createPageRouteTitles = Object.fromEntries(
  createPageRegistry.map((page) => [page.newPath, page.title]),
)

export const routeTitles = {
  '/home/dashboard': '工作台',
  '/home/message-center': '消息中心',
  '/home/feedback': '意见反馈',
  '/home/workbench-admin': '工作台内容管理',
  '/home/workbench-admin/releases/new': '新增功能发布',
  '/home/workbench-admin/releases/:id/edit': '编辑功能发布',
  '/home/data-cockpit': '数据驾驶舱',
  '/home/director-dashboard': '车间主任工作台',
  '/home/prd': 'IDOMS PRD',
  '/home/prd/v15': '1.5版本迭代',
  '/home/prd/v151': '1.5.1版本迭代',
  '/home/prd/v151/product-material': '1.5.1 · 产品物料需求',
  '/product-process/materials': '产品信息',
  '/product-process/products': '产品信息',
  '/product-process/product-label-print-preview': '产品标签打印',
  '/product-process/products/:id/edit': '编辑产品',
  '/product-process/products/:id': '产品详情',
  '/product-process/bom': '配方管理',
  '/product-process/bom/new': '新增配方',
  '/product-process/bom/:id/edit': '编辑配方',
  '/product-process/bom/:id': '配方详情',
  '/product-process/routing': '工艺路线',
  '/product-process/routing/new': '新增工艺路线',
  '/product-process/routing/:id/edit': '编辑工艺路线',
  '/product-process/routing/:id': '工艺路线详情',
  '/product-process/process-config': '工序配置',
  '/product-process/process-config/new': '新增工序',
  '/product-process/process-config/:id/edit': '编辑工序',
  '/product-process/process-config/:id': '工序详情',
  '/product-process/production-line': '产线管理',
  '/product-process/production-line/new': '新增产线',
  '/product-process/production-line/:id': '产线详情',
  '/product-process/process-doc': '工艺文件',
  '/product-process/process-category': '工序分类',
  '/product-process/process-field-library': '采集指标库',
  '/product-process/process-form': '过程记录模板',
  '/sales/orders': '销售订单',
  '/sales/orders/:id': '销售订单详情',
  '/sales/orders/:id/edit': '编辑销售订单',
  '/sales/orders/:id/approve': '审核销售订单',
  '/sales/order-changes': '订单变更管理',
  '/sales/order-changes/new': '发起订单变更',
  '/sales/order-changes/:id/approve': '审核订单变更',
  '/sales/sales-lines': '销售明细',
  '/sales/delivery': '发货管理',
  '/sales/delivery/new': '新增发货单',
  '/sales/delivery/:id/edit': '编辑发货单',
  '/sales/delivery/:id': '发货单详情',
  '/basic-config/customers': '客户档案',
  '/basic-config/customer-types': '客户类型',
  '/basic-config/suppliers': '供应商档案',
  '/basic-config/supplier-categories': '供应商分类',
  '/settlement/payments': '回款管理',
  '/settlement/customer-ledger': '客户往来',
  '/sales/payments': '回款管理',
  '/sales/customer-ledger': '客户往来',
  '/sales/framework-contracts': '合同台账',
  '/contracts': '合同台账',
  '/contracts/:id/approve': '审核合同',
  '/contracts/:id': '合同详情',
  '/contracts/changes': '合同变更',
  '/contracts/changes/new': '发起合同变更',
  '/contracts/changes/:id/edit': '编辑合同变更',
  '/contracts/changes/:id/approve': '审核合同变更',
  '/contracts/changes/:id': '变更单详情',
  '/planning/production-plan': '生产计划',
  '/planning/production-plan/:id': '生产计划详情',
  '/planning/shift-energy-report': '交班能耗填报',
  '/planning/design-task': '设计任务',
  '/planning/replenish-center': '库存预警',
  '/planning/replenish-ledger': '补货台账',
  '/board/kit-supply': '齐套与供应看板',
  '/production/work-orders': '批次指令',
  '/production/work-orders/:id': '批次指令详情',
  '/production/pending-output': '待处置产出',
  '/production/disassembly-work-orders': '拆解工单',
  '/production/disassembly-work-orders/:id': '拆解工单详情',
  '/production/qc-work-orders': '质检工单',
  '/production/rework-orders': '返工管理',
  '/production/rework-orders/new': '新建返工单',
  '/production/rework-orders/:id': '返工单详情',
  '/production/material-requisition': '领料管理',
  '/production/feed-posting': '投料明细',
  '/production/material-requisition/create': '申请领料',
  '/production/material-requisition/:id': '领料申请详情',
  '/production/finished-inbound': '产出入库',
  '/production/finished-inbound/create': '申请成品入库',
  '/production/finished-inbound/:id': '成品入库申请详情',
  '/production/arrival-tracking': '到货跟踪',
  '/production/kit-supply': '齐套与供应进度',
  '/production/kit-supply/shortage/:rowId': '齐套缺件明细',
  '/production/demand-calculation': '需求计算',
  '/inventory/deduct-records': '库存扣减记录',
  '/inventory/deduct-records/:id/edit': '编辑扣减记录',
  '/inventory/deduct-records/:id': '扣减记录详情',
  '/inventory/cut-settle': '下料结算',
  '/inventory/cut-settle/:id': '下料结算详情',
  '/report-management/report-work': '报工确认',
  '/report-management/report-work/:id': '报工确认详情',
  '/report-management/process-report': '工序报工',
  '/report-management/process-report/wo/:workOrderId': '任务报工详情',
  '/report-management/process-report/:id': '工序报工详情',
  '/labor-salary/labor-hour': '工时管理',
  '/report-management/salary-summary': '工资核算',
  '/report-management/salary-detail': '核算详情',
  '/inventory/stock-detail': '库存明细',
  '/inventory/outbound-details': '出库详情',
  '/inventory/inbound-details': '入库详情',
  '/inventory/outbound': '出库管理',
  '/inventory/pending-outbound': '待出库列表',
  '/inventory/outbound/:id': '出库单详情',
  '/inventory/sales-outbound': '出库管理',
  '/inventory/inbound': '入库管理',
  '/inventory/pending-inbound': '待入库列表',
  '/inventory/in-out-detail': '出库详情',
  '/inventory/inbound/:id': '入库单详情',
  '/inventory/transfer': '调拨管理',
  '/inventory/transfer/:id': '调拨单详情',
  '/inventory/stocktake': '盘点管理',
  '/inventory/material-batches': '原料批次',
  '/inventory/expiry-alerts': '效期预警',
  '/inventory/tanks': '储罐液位',
  '/inventory/stocktake/:id': '盘点单详情',
  '/inventory/ship-attachment-query': '随货配件查询',
  '/quality/incoming-qc': '来料化验',
  '/quality/incoming-qc/:id/inspect': '录入化验结果',
  '/quality/incoming-qc/:id': '来料化验详情',
  '/quality/outsourcing-qc': '外协回货化验',
  '/quality/outsourcing-qc/:id/inspect': '录入化验结果',
  '/quality/outsourcing-qc/:id': '外协回货化验详情',
  '/quality/process-qc': '过程化验',
  '/quality/process-qc/:id/inspect': '录入化验结果',
  '/quality/process-qc/:id': '过程化验详情',
  '/quality/finished-qc': '产出化验',
  '/quality/finished-qc/:id/inspect': '录入化验结果',
  '/quality/finished-qc/:id': '产出化验详情',
  '/quality/factory-qc': '出厂化验',
  '/quality/scrap-orders': '报废品管理',
  '/quality/scrap-orders/:id': '报废品详情',
  '/quality/qc-field-library': '化验指标库',
  '/quality/qc-template': '化验模板',
  '/quality/qc-template/:id': '化验模板详情',
  '/system/dict': '系统字典',
  '/system/coding-rules': '编码规则',
  '/system/business-rules': '业务规则',
  '/system/function-params': '功能参数',
  '/system/message-notify': '消息通知配置',
  '/procurement/purchase-req': '采购申请',
  '/procurement/purchase-orders': '采购订单',
  '/procurement/purchase-orders/:id/edit': '编辑采购单',
  '/procurement/purchase-orders/:id/approve': '审核采购单',
  '/procurement/purchase-orders/:id': '采购订单详情',
  '/procurement/purchase-receipts': '采购收货',
  '/settlement/purchase-settles': '采购对账',
  '/settlement/purchase-settles/:id': '采购对账详情',
  '/settlement/dispute-accruals': '争议挂账',
  '/settlement/supplier-ledger': '供应商往来',
  '/settlement/ticket-fund-flow': '票款流水',
  '/settlement/settle-rules': '结算规则',
  '/procurement/purchase-settles': '采购对账',
  '/procurement/purchase-settles/:id': '采购对账详情',
  '/basic-config/settle-rules': '结算规则',
  '/procurement/purchase-settle-rules': '结算规则',
  '/procurement/purchase-returns': '采购退货',
  '/procurement/purchase-returns/:id/edit': '编辑采购退货单',
  '/procurement/purchase-returns/:id': '采购退货详情',
  '/procurement/purchase-details': '采购明细',
  '/procurement/outsourcing-orders': '外协订单',
  '/procurement/outsourcing-orders/:id/edit': '编辑外协订单',
  '/procurement/outsourcing-orders/:id/approve': '审核外协订单',
  '/procurement/outsourcing-orders/:id': '外协订单详情',
  '/procurement/outsourcing-issue': '发料管理',
  '/procurement/outsourcing-issue/:id': '发料申请详情',
  '/procurement/outsourcing-receipts': '外协收货',
  '/procurement/outsourcing-receipts/:id': '外协收货详情',
  '/procurement/outsourcing-returns': '外协异常处理',
  '/procurement/outsourcing-returns/:id/edit': '编辑外协异常处理单',
  '/procurement/outsourcing-returns/:id': '外协异常处理详情',
  '/procurement/outsourcing-details': '外协明细',
  '/after-sales/service-orders': '服务工单',
  '/after-sales/returns': '退换货',
  '/industrial-id/base-config/enterprise-info': '企业信息',
  '/industrial-id/base-config/nameplate-template': '产品信息模板',
  '/industrial-id/label-request': '标识申请',
  '/industrial-id/label-management': '标识管理',
  '/wms/warehouse': '仓储管理',
  '/qms/trace': '质量追溯',
  '/equipment/devices': '设备台账',
  '/equipment/inspection-standards': '点检标准',
  '/equipment/inspection-tasks': '点检任务',
  '/equipment/maintain-orders': '保养工单',
  '/equipment/repair-orders': '维修工单',
  '/report/overview': '报表目录',
  '/report/sales-order-exec': '销售订单执行表',
  '/report/sales-line-summary': '销售明细汇总表',
  '/report/sales-delivery-achieve': '发货达成表',
  '/report/sales-order-cost': '销售订单成本表',
  '/report/purchase-order-exec': '采购订单执行表',
  '/report/outsourcing-order-exec': '外协订单执行表',
  '/report/inventory-io-balance': '库存收发存表',
  '/report/qc-task-stats': '化验任务统计表',
  '/board/catalog': '看板列表',
  '/board/carousel': '轮播管理',
  '/board/carousel/new': '新建轮播方案',
  '/board/work-order-monitor': '工单监管看板',
  '/board/work-order-monitor/screen': '工单监管看板',
  '/board/carousel/play': '看板轮播播放',
  '/basic-config/company-profile': '企业信息',
  '/basic-config/employee-groups': '员工组别',
  '/basic-config/defect-items': '不良品项',
  '/basic-config/material-grades': '材质管理',
  '/basic-config/units': '单位管理',
  '/basic-config/process-param-units': '工艺参数单位',
  '/basic-config/packaging': '包装管理',
  '/basic-config/business-dict': '业务字典',
  '/basic-config/warehouse-categories': '仓库分类',
  '/basic-config/warehouses': '仓库列表',
  '/basic-config/warehouse-locations': '货位管理',
  ...createPageRouteTitles,
}

/** 动态路径标题（含 :id 等参数） */
export const dynamicRouteTitles = [
  { pattern: /^\/basic-config\/warehouses\/[^/]+$/, title: '仓库详情' },
  { pattern: /^\/product-process\/products\/[^/]+\/edit$/, title: '编辑产品' },
  { pattern: /^\/product-process\/process-config\/[^/]+\/edit$/, title: '编辑工序' },
  { pattern: /^\/product-process\/process-config\/[^/]+$/, title: '工序详情' },
  { pattern: /^\/product-process\/routing\/[^/]+\/edit$/, title: '编辑工艺路线' },
  { pattern: /^\/product-process\/routing\/[^/]+$/, title: '工艺路线详情' },
  { pattern: /^\/sales\/orders\/[^/]+\/edit$/, title: '编辑销售订单' },
  { pattern: /^\/sales\/orders\/[^/]+\/approve$/, title: '审核销售订单' },
  { pattern: /^\/sales\/order-changes\/[^/]+\/approve$/, title: '审核订单变更' },
  { pattern: /^\/procurement\/purchase-req\/[^/]+\/edit$/, title: '编辑采购申请' },
  { pattern: /^\/procurement\/purchase-req\/[^/]+$/, title: '采购申请详情' },
  { pattern: /^\/procurement\/purchase-orders\/[^/]+\/edit$/, title: '编辑采购单' },
  { pattern: /^\/procurement\/purchase-orders\/[^/]+\/approve$/, title: '审核采购单' },
  { pattern: /^\/procurement\/purchase-orders\/[^/]+$/, title: '采购订单详情' },
  { pattern: /^\/settlement\/purchase-settles\/[^/]+$/, title: '采购对账详情' },
  { pattern: /^\/procurement\/purchase-settles\/[^/]+$/, title: '采购对账详情' },
  { pattern: /^\/procurement\/purchase-returns\/[^/]+\/edit$/, title: '编辑采购退货单' },
  { pattern: /^\/procurement\/purchase-returns\/[^/]+$/, title: '采购退货详情' },
  { pattern: /^\/procurement\/outsourcing-orders\/[^/]+\/edit$/, title: '编辑外协订单' },
  { pattern: /^\/procurement\/outsourcing-orders\/[^/]+\/approve$/, title: '审核外协订单' },
  { pattern: /^\/procurement\/outsourcing-orders\/[^/]+$/, title: '外协订单详情' },
  { pattern: /^\/procurement\/outsourcing-issue\/[^/]+$/, title: '发料申请详情' },
  { pattern: /^\/procurement\/outsourcing-returns\/[^/]+\/edit$/, title: '编辑外协异常处理单' },
  { pattern: /^\/procurement\/outsourcing-returns\/[^/]+$/, title: '外协异常处理详情' },
  { pattern: /^\/basic-config\/customers\/[^/]+\/edit$/, title: '编辑客户' },
  { pattern: /^\/basic-config\/customers\/[^/]+$/, title: '客户详情' },
  { pattern: /^\/basic-config\/suppliers\/[^/]+\/edit$/, title: '编辑供应商' },
  { pattern: /^\/basic-config\/suppliers\/[^/]+$/, title: '供应商详情' },
  { pattern: /^\/inventory\/inbound\/[^/]+$/, title: '入库单详情' },
  { pattern: /^\/inventory\/outbound\/[^/]+$/, title: '出库单详情' },
  { pattern: /^\/inventory\/cut-settle\/[^/]+$/, title: '下料结算详情' },
  { pattern: /^\/report-management\/report-work\/[^/]+$/, title: '报工确认详情' },
  { pattern: /^\/report-management\/process-report\/wo\/[^/]+$/, title: '任务报工详情' },
  { pattern: /^\/report-management\/process-report\/[^/]+$/, title: '工序报工详情' },
  { pattern: /^\/production\/rework-orders\/(?!new$)[^/]+$/, title: '返工单详情' },
  { pattern: /^\/labor-salary\/labor-hour\/[^/]+$/, title: '工时详情' },
  { pattern: /^\/planning\/design-task\/[^/]+\/detail$/, title: '设计任务详情' },
]
