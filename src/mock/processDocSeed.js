/** 工艺文件主数据（流程行业） */
export function createProcessDocSeed() {
  return [
    {
      id: 'pdoc-001',
      code: 'GYWJ-001',
      name: '投料作业指导书',
      version: 'V1.0',
      category: '配料',
      status: '启用',
    },
    {
      id: 'pdoc-002',
      code: 'GYWJ-002',
      name: '反应升温保温规程',
      version: 'V2.0',
      category: '反应',
      status: '启用',
    },
    {
      id: 'pdoc-003',
      code: 'GYWJ-003',
      name: '板框过滤操作卡',
      version: 'V1.1',
      category: '分离',
      status: '启用',
    },
    {
      id: 'pdoc-004',
      code: 'GYWJ-004',
      name: '离心分离操作规程',
      version: 'V1.0',
      category: '分离',
      status: '启用',
    },
    {
      id: 'pdoc-005',
      code: 'GYWJ-005',
      name: '计量灌装检验规范',
      version: 'V1.2',
      category: '灌装',
      status: '启用',
    },
    {
      id: 'pdoc-006',
      code: 'GYWJ-006',
      name: '转罐核对记录表',
      version: 'V1.0',
      category: '储运',
      status: '启用',
    },
  ]
}
