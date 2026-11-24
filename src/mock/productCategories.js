/** 系统默认：产品类别「成品涂料」（可改名、不可删除；新租户入驻即有） */
export const PRODUCT_CATEGORY_FINISHED = {
  key: 'pcat-finished',
  code: '001',
  title: '成品涂料',
  system: true,
}

/** 系统预置：BOM 快捷创建等产品默认兜底类别（可改名、不可删除） */
export const PRODUCT_CATEGORY_UNCLASSIFIED = {
  key: 'pcat-unclassified',
  code: '000',
  title: '待归类',
  system: true,
}

/** 流程型演示类别（可删可改） */
const DEMO_PRODUCT_CATEGORIES = [
  { key: 'pcat-topcoat', code: '010', title: '面漆' },
  { key: 'pcat-primer', code: '011', title: '底漆' },
  { key: 'pcat-custom', code: '012', title: '定制涂料' },
  { key: 'pcat-li-salt', code: '015', title: '锂盐成品' },
  { key: 'pcat-intermediate', code: '020', title: '树脂中间体' },
  { key: 'pcat-li-brine', code: '021', title: '浸出卤水' },
  { key: 'pcat-recycle', code: '030', title: '回收溶剂' },
]

/** 新租户 / 空库种子：业务演示类别在前，系统默认靠后（展示时还会按主数据量再排） */
export function createProductCategorySeed() {
  return [
    ...DEMO_PRODUCT_CATEGORIES.map((n) => structuredClone(n)),
    { ...PRODUCT_CATEGORY_FINISHED },
    { ...PRODUCT_CATEGORY_UNCLASSIFIED },
  ]
}

function walkFind(nodes, key) {
  for (const node of nodes || []) {
    if (node.key === key) return node
    const hit = walkFind(node.children, key)
    if (hit) return hit
  }
  return null
}

/**
 * 补齐系统默认类别（旧租户升级、localStorage 缺项时调用）。
 * 已存在则只强制 system 标记，不覆盖用户改过的名称；新增时追加到末尾。
 */
export function ensureSystemProductCategories(tree) {
  const list = Array.isArray(tree) ? tree : []
  const ensureOne = (preset) => {
    const existing = walkFind(list, preset.key)
    if (existing) {
      existing.system = true
      if (!existing.code) existing.code = preset.code
      return
    }
    list.push({ ...preset })
  }
  ensureOne(PRODUCT_CATEGORY_FINISHED)
  ensureOne(PRODUCT_CATEGORY_UNCLASSIFIED)
  return list
}

/** @deprecated 请优先用 store 的响应式树；保留给种子脚本一次性读取 */
export const productCategoryTree = createProductCategorySeed()

export { filterCategoryTree, flattenCategoryNodes } from '@/mock/materialCategories'
