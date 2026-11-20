/** 系统默认：物料类别「物料」（可改名、不可删除；新租户入驻即有） */
export const MATERIAL_CATEGORY_DEFAULT = {
  key: 'cat-material',
  code: '000',
  title: '物料',
  system: true,
  count: 0,
}

/** 流程型演示类别（可删可改） */
const DEMO_MATERIAL_CATEGORIES = [
  { key: 'cat-resin', code: '010', title: '树脂原料', count: 0 },
  { key: 'cat-solvent', code: '011', title: '溶剂', count: 0 },
  { key: 'cat-pigment', code: '012', title: '颜填料', count: 0 },
  { key: 'cat-additive', code: '013', title: '助剂辅料', count: 0 },
  { key: 'cat-intermediate', code: '020', title: '中间体', count: 0 },
  { key: 'cat-recycle', code: '030', title: '回收料', count: 0 },
  { key: 'cat-waste', code: '040', title: '废弃物', count: 0 },
]

/** 新租户 / 空库种子：业务演示类别在前，系统默认「物料」靠后 */
export function createMaterialCategorySeed() {
  return [
    ...DEMO_MATERIAL_CATEGORIES.map((n) => structuredClone(n)),
    { ...MATERIAL_CATEGORY_DEFAULT },
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
 * 已存在则只强制 system 标记，不覆盖用户改过的名称。
 */
export function ensureSystemMaterialCategories(tree) {
  const list = Array.isArray(tree) ? tree : []
  const existing = walkFind(list, MATERIAL_CATEGORY_DEFAULT.key)
  if (existing) {
    existing.system = true
    if (!existing.code) existing.code = MATERIAL_CATEGORY_DEFAULT.code
  } else {
    list.push({ ...MATERIAL_CATEGORY_DEFAULT })
  }
  return list
}

/** @deprecated 请优先用 store 的响应式树；保留给种子脚本一次性读取 */
export const materialCategoryTree = createMaterialCategorySeed()

export function flattenCategoryNodes(nodes, list = []) {
  nodes.forEach((node) => {
    list.push(node)
    if (node.children?.length) flattenCategoryNodes(node.children, list)
  })
  return list
}

export function filterCategoryTree(nodes, keyword) {
  const kw = (keyword || '').trim().toLowerCase()
  if (!kw) return nodes

  const walk = (arr) =>
    arr
      .map((node) => {
        const titleMatch = node.title.toLowerCase().includes(kw) || node.code.includes(kw)
        const children = node.children ? walk(node.children) : []
        if (titleMatch || children.length) {
          return { ...node, children: children.length ? children : node.children }
        }
        return null
      })
      .filter(Boolean)

  return walk(nodes)
}

export function getCategoryKeysUnder(nodeKey, tree = materialCategoryTree) {
  const flat = flattenCategoryNodes(tree)
  const node = flat.find((n) => n.key === nodeKey)
  if (!node) return []
  if (!node.children?.length) return [nodeKey]
  return flat.filter((n) => n.parentKey === nodeKey || n.key === nodeKey).map((n) => n.key)
}

export function isSystemCategory(node) {
  return Boolean(node?.system)
}
