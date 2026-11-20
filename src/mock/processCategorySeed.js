/** 工序分类初始数据（流程型单元操作） */
export function createProcessCategorySeed() {
  const names = ['配料', '反应', '分离', '灌装', '储运']
  return names.map((name, index) => ({
    id: `pcat-${String(index + 1).padStart(3, '0')}`,
    name,
    status: '使用中',
    remark: '',
    createdAt: '2025-11-11',
    updatedAt: '2025-11-11',
  }))
}
