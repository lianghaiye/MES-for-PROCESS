/**
 * 车间产线示意。沉锂线按现场「沉锂车间工艺流程图」排布：
 * 主链从左到右，渣向下汇到压滤，母液回到一次净化。
 * names 用来把批次当前工序对上图上的格子。
 */

function process(node) {
  return { kind: 'process', w: 112, h: 64, names: [node.name], ...node }
}

function feed(node) {
  return { kind: 'feed', w: 108, h: 28, ...node }
}

function product(node) {
  return { kind: 'product', w: 96, h: 44, names: [node.name], ...node }
}

export const PLANT_LINES = [
  {
    id: 'acid',
    name: '酸浸线',
    caption: '前段浸出，卤水送往后段',
    width: 820,
    height: 340,
    nodes: [
      process({ id: 'slurry', name: '投料浆化', x: 36, y: 108 }),
      process({ id: 'acid-leach', name: '一次酸浸', x: 230, y: 108, names: ['一次酸浸', '酸浸'] }),
      process({ id: 'acid-filter', name: '压滤', x: 424, y: 108, names: ['酸浸压滤'] }),
      product({ id: 'acid-brine', name: '卤水', x: 640, y: 118 }),
      process({ id: 'acid-wash', name: '洗渣', x: 424, y: 236 }),
      product({ id: 'acid-slag', name: '渣入库', x: 640, y: 246 }),
    ],
    edges: [
      { d: 'M148 140 H230', kind: 'main' },
      { d: 'M342 140 H424', kind: 'main' },
      { d: 'M536 140 H640', label: '液', labelX: 560, labelY: 132, kind: 'main' },
      { d: 'M480 172 V236', label: '渣', labelX: 488, labelY: 208, kind: 'slag' },
      { d: 'M536 268 H640', kind: 'slag' },
      { d: 'M424 268 H96 V172', label: '洗渣水', labelX: 180, labelY: 258, kind: 'recycle' },
    ],
  },
  {
    id: 'water',
    name: '水浸线',
    caption: '有水浸原料时才开',
    width: 760,
    height: 320,
    nodes: [
      process({ id: 'water-feed', name: '投料', x: 36, y: 108 }),
      process({ id: 'water-leach', name: '水浸', x: 230, y: 108 }),
      process({ id: 'belt', name: '带式压滤', x: 424, y: 108, w: 128 }),
      product({ id: 'water-brine', name: '卤水', x: 620, y: 118 }),
      product({ id: 'water-slag', name: '渣', x: 440, y: 236, w: 96 }),
    ],
    edges: [
      { d: 'M148 140 H230', kind: 'main' },
      { d: 'M342 140 H424', kind: 'main' },
      { d: 'M552 140 H620', label: '液', labelX: 568, labelY: 132, kind: 'main' },
      { d: 'M488 172 V236', label: '渣', labelX: 496, labelY: 208, kind: 'slag' },
    ],
  },
  {
    id: 'precip',
    name: '沉锂线',
    caption: '沉锂车间工艺流程图',
    width: 940,
    height: 470,
    nodes: [
      feed({ id: 'defluor-agent', name: '除氟剂', x: 2, y: 144, w: 70 }),
      feed({ id: 'brine-in', name: '酸浸卤水', x: 86, y: 44, w: 90 }),
      feed({ id: 'soda', name: '纯碱、片碱', x: 206, y: 36, w: 100 }),
      feed({ id: 'precip-agent', name: '沉锂剂、磷酸三钠', x: 328, y: 12, w: 136, h: 36 }),
      feed({ id: 'sulfuric', name: '硫酸', x: 530, y: 44, w: 48 }),
      feed({ id: 'pfs', name: '聚合硫酸铁、片碱', x: 590, y: 12, w: 136, h: 36 }),
      process({
        id: 'purify1',
        name: '一次净化',
        x: 78,
        y: 128,
        w: 100,
        names: ['一次净化', '除氟'],
      }),
      process({
        id: 'slurry2',
        name: '二次浆化',
        x: 206,
        y: 128,
        w: 100,
        names: ['二次浆化', '除钙镁'],
      }),
      process({ id: 'precip', name: '沉锂', x: 334, y: 128, w: 100 }),
      process({ id: 'decarb', name: '脱碳', x: 462, y: 128, w: 100, names: ['脱碳', '除碳'] }),
      process({ id: 'dephos', name: '除磷', x: 590, y: 128, w: 100 }),
      process({
        id: 'mvr',
        name: 'MVR浓缩',
        x: 718,
        y: 128,
        w: 100,
        names: ['MVR浓缩', 'MVR', '浓缩'],
      }),
      product({ id: 'salt', name: '钠盐', x: 846, y: 138, w: 78, h: 40 }),
      process({ id: 'f-wash', name: '氟渣洗涤', x: 78, y: 250, w: 100 }),
      process({ id: 'ca-wash', name: '钙镁渣洗涤', x: 206, y: 250, w: 100 }),
      process({ id: 'li-wash', name: '锂盐洗涤', x: 334, y: 250, w: 100 }),
      process({ id: 'centrifuge', name: '离心', x: 462, y: 250, w: 100 }),
      product({ id: 'li-product', name: '磷酸锂', x: 462, y: 360, w: 100, h: 40 }),
      process({ id: 'filter', name: '压滤', x: 250, y: 360, w: 100 }),
      product({ id: 'slag-out', name: '出渣', x: 262, y: 432, w: 76, h: 32 }),
    ],
    edges: [
      { d: 'M72 160 H78', kind: 'main' },
      { d: 'M128 72 V128', kind: 'main' },
      { d: 'M178 160 H206', label: '液', labelX: 182, labelY: 152, kind: 'main' },
      { d: 'M256 64 V128', kind: 'main' },
      { d: 'M306 160 H334', label: '液', labelX: 310, labelY: 152, kind: 'main' },
      { d: 'M384 48 V128', kind: 'main' },
      { d: 'M434 160 H462', label: '液', labelX: 438, labelY: 152, kind: 'main' },
      { d: 'M554 72 V100 H540 V128', kind: 'main' },
      { d: 'M562 160 H590', label: '液', labelX: 566, labelY: 152, kind: 'main' },
      { d: 'M658 48 V128', kind: 'main' },
      { d: 'M690 160 H718', kind: 'main' },
      { d: 'M818 160 H846', kind: 'main' },
      { d: 'M128 192 V250', label: '渣', labelX: 136, labelY: 226, kind: 'slag' },
      { d: 'M256 192 V250', label: '渣', labelX: 264, labelY: 226, kind: 'slag' },
      { d: 'M384 192 V250', label: '锂盐', labelX: 392, labelY: 226, kind: 'slag' },
      { d: 'M434 282 H462', kind: 'main' },
      { d: 'M512 314 V360', kind: 'main' },
      { d: 'M480 270 V214 H512 V192', label: '液', labelX: 484, labelY: 208, kind: 'main' },
      { d: 'M640 128 V8 H128 V44', label: '母液', labelX: 360, labelY: 16, kind: 'recycle' },
      { d: 'M128 314 V390 H250', kind: 'slag' },
      { d: 'M256 314 V372 H250', kind: 'slag' },
      { d: 'M384 314 V348 H300 V360', kind: 'slag' },
      { d: 'M640 192 V390 H350', label: '渣', labelX: 648, labelY: 236, kind: 'filtrate' },
      { d: 'M350 390 H768 V192', label: '液', labelX: 540, labelY: 382, kind: 'filtrate' },
      { d: 'M300 424 V432', kind: 'slag' },
    ],
  },
]
