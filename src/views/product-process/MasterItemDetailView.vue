<template>
  <div class="product-master-detail-page">
    <a-empty v-if="!record" description="未找到该产品" />
    <template v-else>
      <div class="detail-sticky-bar">
        <div class="page-header">
          <div class="header-left">
            <span class="order-no">{{ display(record.code) }}</span>
            <span v-if="record.name" class="product-name">{{ record.name }}</span>
            <a-tag :color="productStatusColor(record.status)">{{ productStatusLabel }}</a-tag>
            <a-tag v-if="record.supplyForm">{{ record.supplyForm }}</a-tag>
            <a-tag v-if="record.materialType">{{ record.materialType }}</a-tag>
          </div>
          <a-space :size="8">
            <a-button size="small" @click="handleEdit">编辑</a-button>
            <a-button size="small" @click="handleMaintainFormula">配方维护</a-button>
            <a-button size="small" @click="handleBack">返回列表</a-button>
          </a-space>
        </div>
        <div class="detail-tabs-wrap">
          <a-tabs
            v-model:active-key="activeTab"
            class="detail-tabs detail-tabs-pill detail-tabs-pill--nav-only"
          >
            <a-tab-pane key="basic" tab="基本信息" />
          </a-tabs>
        </div>
      </div>

      <div class="tab-body">
        <template v-if="activeTab === 'basic'">
          <div class="overview-cards">
            <div
              v-for="card in overviewCards"
              :key="card.key"
              class="overview-card"
              :class="[`tone-${card.tone}`, { clickable: card.clickable }]"
              @click="onOverviewCardClick(card)"
            >
              <div class="overview-label">
                {{ card.label }}
                <a-tooltip v-if="card.tip" :title="card.tip">
                  <InfoCircleOutlined class="overview-tip" />
                </a-tooltip>
              </div>
              <div class="overview-value">{{ card.value }}</div>
            </div>
          </div>
          <DetailSectionCard title="基本信息">
            <DetailInfoGrid :meta-items="capabilityMeta" :fields="basicFields" flush />
          </DetailSectionCard>
          <DetailSectionCard title="单位管理">
            <DetailInfoGrid :fields="unitFields" flush />
            <a-table
              class="detail-sub-table"
              :columns="auxUnitColumns"
              :data-source="auxUnits"
              row-key="id"
              size="small"
              bordered
              :pagination="false"
              :locale="{ emptyText: '暂无辅助单位' }"
            >
              <template #bodyCell="{ column, record: row }">
                <template v-if="column.key === 'roles'">
                  {{ roleLabels(row.roles).join('、') || '—' }}
                </template>
                <template v-else-if="column.key === 'convert'">
                  {{ formatAuxConvertText(row, unitHydrated.baseUnit) }}
                </template>
                <template v-else-if="column.key === 'status'">
                  {{ row.enabled === false ? '停用' : '启用' }}
                </template>
              </template>
            </a-table>
          </DetailSectionCard>
          <DetailSectionCard title="包装规格">
            <a-table
              class="detail-sub-table"
              :columns="packSpecColumns"
              :data-source="packSpecs"
              row-key="id"
              size="small"
              bordered
              :pagination="false"
              :locale="{ emptyText: '暂无包装规格' }"
            >
              <template #bodyCell="{ column, record: row }">
                <template v-if="column.key === 'name'">
                  <span>{{ row.name || '—' }}</span>
                  <a-tag v-if="row.isDefault" color="blue" class="default-tag">默认</a-tag>
                </template>
                <template v-else-if="column.key === 'convert'">
                  {{ formatPackSpecText(row, record.inventoryUnit) }}
                </template>
                <template v-else-if="column.key === 'salesPrice'">
                  {{ formatPackPrice(row.salesPrice, record.inventoryUnit) }}
                </template>
                <template v-else-if="column.key === 'purchasePrice'">
                  {{ formatPackPrice(row.purchasePrice, record.inventoryUnit) }}
                </template>
                <template v-else-if="column.key === 'status'">
                  <a-tag :color="row.enabled === false ? 'default' : 'success'">
                    {{ row.enabled === false ? '停用' : '启用' }}
                  </a-tag>
                </template>
              </template>
            </a-table>
          </DetailSectionCard>
          <DetailSectionCard title="销售">
            <DetailInfoGrid :fields="salesFields" flush />
          </DetailSectionCard>
          <DetailSectionCard title="采购">
            <DetailInfoGrid :fields="purchaseFields" flush />
            <a-table
              class="detail-sub-table"
              :columns="supplierColumns"
              :data-source="purchaseSuppliers"
              row-key="id"
              size="small"
              bordered
              :pagination="false"
              :locale="{ emptyText: '暂无供应商' }"
            >
              <template #bodyCell="{ column, record: row }">
                <template v-if="column.key === 'unitPriceInclTax'">
                  {{
                    displayMoney(calcPurchasePriceInclTax(row.unitPriceExTax, record.inputTaxRate))
                  }}
                </template>
                <template v-else>
                  {{ display(row[column.dataIndex]) }}
                </template>
              </template>
            </a-table>
          </DetailSectionCard>
          <DetailSectionCard title="生产控制">
            <DetailInfoGrid :fields="productionFields" flush />
          </DetailSectionCard>
          <DetailSectionCard title="预警信息">
            <DetailInfoGrid :fields="alertFields" flush />
          </DetailSectionCard>
          <DetailSectionCard v-if="showProductMaterialsSection" title="产品资料">
            <div v-if="productMaterials.length" class="product-material-list">
              <div
                v-for="(file, idx) in productMaterials"
                :key="file.uid || file.url || idx"
                class="product-material-item"
              >
                <a-image
                  v-if="file.fileType === 'image'"
                  :src="file.url || file.thumbUrl"
                  :alt="file.name"
                  class="product-material-thumb"
                />
                <div v-else class="product-material-file">
                  <a-tag>{{ productMaterialTypeLabel(file.fileType) }}</a-tag>
                  <a class="product-material-link" :href="file.url" :download="file.name">{{
                    file.name
                  }}</a>
                </div>
              </div>
            </div>
            <div v-else class="product-material-empty">暂无产品资料</div>
          </DetailSectionCard>
        </template>

        <div v-else-if="activeTab === 'labor'" class="section-card">
          <DetailInfoGrid :fields="laborSwitchFields" flush />
          <a-table
            v-if="record.laborEnabled"
            class="detail-sub-table"
            :columns="laborColumns"
            :data-source="laborRows"
            row-key="id"
            size="small"
            bordered
            :pagination="false"
            :locale="{ emptyText: '暂无工时配置' }"
          >
            <template #bodyCell="{ column, record: row }">
              {{ display(row[column.dataIndex]) }}
            </template>
          </a-table>
        </div>

        <div v-else-if="activeTab === 'bom'" class="section-card">
          <ItemBomInfoTab :item-type="bomItemType" :item-id="record.id || ''" />
        </div>
      </div>

      <a-modal
        v-model:open="bomRefModalOpen"
        title="BOM引用"
        width="760px"
        :footer="null"
        destroy-on-close
      >
        <p class="bom-ref-hint">
          仅展示将该物品作为子件直接引用的 BOM（不含间接引用、已归档），点击 BOM 编码可打开详情。
        </p>
        <a-table
          :columns="bomRefColumns"
          :data-source="overview.bomRefs"
          row-key="id"
          size="small"
          bordered
          :pagination="false"
        >
          <template #bodyCell="{ column, record: row }">
            <template v-if="column.key === 'bomNo'">
              <a class="bom-ref-link">{{ row.bomNo || '—' }}</a>
            </template>
            <template v-else-if="column.key === 'bomStatus'">
              <a-tag :color="bomStatusColor(row.bomStatus)">{{ row.bomStatus }}</a-tag>
            </template>
            <template v-else>
              {{ row[column.dataIndex] ?? '—' }}
            </template>
          </template>
        </a-table>
      </a-modal>
    </template>
  </div>
</template>

<script setup>
import DetailSectionCard from '@/components/DetailSectionCard.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import { productInfoState } from '@/store/productInfoStore'
import { findMaintainFormula } from '@/store/processFormulaStore'
import { materialInfoState } from '@/store/materialInfoStore'
import { productCategoryState } from '@/store/productCategoryStore'
import { materialCategoryState } from '@/store/materialCategoryStore'
import { resolveMasterItemEditRecord } from '@/utils/masterItemSave'
import { ITEM_KIND, resolveItemKind } from '@/utils/masterItemKind'
import { normalizeProductStatus, productStatusColor } from '@/utils/productStatus'
import { flattenCategoryNodes } from '@/mock/materialCategories'
import {
  PLAN_STRATEGY_OPTIONS,
  isPlanStrategyMts,
  formatStorageConditions,
} from '@/mock/productInfoOptions'
import { formatPackPrice, formatPackSpecText, normalizePackSpecs } from '@/utils/packSpec'
import { inboundQcOptions } from '@/mock/materialInfoOptions'
import { hydratePurchaseSuppliers, calcPurchasePriceInclTax } from '@/utils/purchaseSuppliers'
import {
  hydrateUnitManageFromSource,
  formatAuxConvertText,
  roleLabels,
} from '@/utils/unitManageTab'
import { openCreateTab } from '@/utils/openCreateTab'
import { useTabs, tabStore } from '@/composables/useTabs'
import DetailInfoGrid from './components/DetailInfoGrid.vue'
import ItemBomInfoTab from './components/ItemBomInfoTab.vue'
import { buildProductMasterOverview, formatOverviewQty } from '@/utils/productMasterOverview'
import { bomStatusColor } from '@/mock/productBomOptions'
import { stockState } from '@/store/stockStore'
import { inboundOrderState } from '@/store/inboundOrderStore'
import { outboundState } from '@/store/outboundStore'
import { purchaseOrderState } from '@/store/purchaseOrderStore'
import { salesOrderState } from '@/store/salesOrderStore'
import { workOrderState } from '@/store/workOrderStore'
import { assemblyWorkOrderState } from '@/store/assemblyWorkOrderStore'
import { productBomState } from '@/store/productBomStore'

defineOptions({ name: 'MasterItemDetailView' })

const route = useRoute()
const router = useRouter()
const { openTab } = useTabs()
const activeTab = ref('basic')

function findById(list, id) {
  const sid = String(id ?? '')
  return list.find((row) => String(row.id) === sid)
}

const record = computed(() => {
  const id = route.params.id
  if (!id) return null
  void productInfoState.products
  void materialInfoState.materials
  const product = findById(productInfoState.products, id)
  const material = findById(materialInfoState.materials, id)
  const raw = product || material
  return raw ? resolveMasterItemEditRecord(raw) : null
})

const kind = computed(() =>
  resolveItemKind({ canSell: record.value?.canSell, canProduce: record.value?.canProduce }),
)
const productStatusLabel = computed(() => normalizeProductStatus(record.value?.status))
const bomItemType = computed(() => (kind.value === ITEM_KIND.MATERIAL ? 'material' : 'product'))
const bomRefModalOpen = ref(false)

const overview = computed(() => {
  void stockState.records
  void inboundOrderState.orders
  void outboundState.orders
  void purchaseOrderState.orders
  void salesOrderState.orders
  void workOrderState.orders
  void assemblyWorkOrderState.orders
  void productBomState.boms
  if (!record.value) {
    return {
      unit: '件',
      stockText: '—',
      inTransitText: '—',
      ioText: '—',
      bomRefCount: 0,
      bomRefs: [],
      manufacturedQty: 0,
      purchasedQty: 0,
      soldQty: 0,
    }
  }
  return buildProductMasterOverview(record.value)
})

const overviewCards = computed(() => {
  const o = overview.value
  const unit = o.unit || '件'
  const monthTip = '当月'
  return [
    {
      key: 'stock',
      label: '库存量',
      value: o.stockText,
      tone: 'blue',
      tip: '当前现存量（库存单位）',
    },
    {
      key: 'inTransit',
      label: '在途',
      value: o.inTransitText,
      tone: 'cyan',
      tip: '采购在途 + 在制未完工数量（库存单位）',
    },
    {
      key: 'io',
      label: '出入库量',
      value: o.ioText,
      tone: 'purple',
      tip: monthTip,
    },
    {
      key: 'made',
      label: '已制造',
      value: `${formatOverviewQty(o.manufacturedQty)} ${unit}`,
      tone: 'green',
      tip: monthTip,
    },
    {
      key: 'bought',
      label: '已采购',
      value: `${formatOverviewQty(o.purchasedQty)} ${unit}`,
      tone: 'gold',
      tip: monthTip,
    },
    {
      key: 'sold',
      label: '已销售',
      value: `${formatOverviewQty(o.soldQty)} ${unit}`,
      tone: 'red',
      tip: monthTip,
    },
  ]
})

const bomRefColumns = [
  { title: 'BOM编码', dataIndex: 'bomNo', key: 'bomNo', width: 140 },
  { title: 'BOM名称', dataIndex: 'bomName', key: 'bomName', ellipsis: true },
  { title: '状态', dataIndex: 'bomStatus', key: 'bomStatus', width: 88 },
  { title: '母件名称', dataIndex: 'itemName', key: 'itemName', ellipsis: true },
  { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
  { title: '单位用量', dataIndex: 'unitQty', key: 'unitQty', width: 90, align: 'right' },
]

function openBomDetail() {
  return
}

function onOverviewCardClick(card) {
  if (card.key !== 'bomRef' || !card.clickable) return
  const refs = overview.value.bomRefs || []
  if (refs.length === 1) {
    openBomDetail(refs[0])
    return
  }
  if (refs.length > 1) bomRefModalOpen.value = true
}

function display(val) {
  return val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '—'
}

function yesNo(val) {
  if (val === true || val === 1 || val === '1') return '是'
  if (val === false || val === 0 || val === '0') return '否'
  return '—'
}

function displayMoney(val) {
  if (val == null || val === '') return '—'
  const n = Number(val)
  return Number.isFinite(n) ? n.toFixed(2) : '—'
}

function optionLabel(options, value) {
  const hit = (options || []).find((o) => o.value === value || o === value)
  if (!hit) return display(value)
  return typeof hit === 'string' ? hit : display(hit.label)
}

function categoryTitle(tree, key) {
  if (!key) return '—'
  const hit = flattenCategoryNodes(tree).find((n) => n.key === key)
  return display(hit?.title)
}

const production = computed(() => record.value?.production || {})
const alert = computed(() => record.value?.alert || {})

const unitHydrated = computed(() => hydrateUnitManageFromSource(record.value || {}))
const auxUnits = computed(() => unitHydrated.value.auxUnits || [])
const packSpecs = computed(() => {
  const r = record.value || {}
  return normalizePackSpecs(r.packSpecs, r.packSpec, r.inventoryUnit)
})

const packSpecColumns = [
  { title: '规格名称', key: 'name', dataIndex: 'name' },
  { title: '换算说明', key: 'convert' },
  { title: '销售单价', key: 'salesPrice', width: 140, align: 'right' },
  { title: '采购单价', key: 'purchasePrice', width: 140, align: 'right' },
  { title: '状态', key: 'status', width: 88 },
]

const purchaseSuppliers = computed(() => hydratePurchaseSuppliers(record.value || {}))
const laborRows = computed(() =>
  Array.isArray(record.value?.laborRows) ? record.value.laborRows : [],
)

const capabilityMeta = computed(() => {
  const r = record.value || {}
  return [
    { key: 'canSell', label: '可销售', value: yesNo(r.canSell) },
    { key: 'canProduce', label: '可生产', value: yesNo(r.canProduce) },
    { key: 'canPurchase', label: '可采购', value: yesNo(r.canPurchase) },
  ]
})

const basicFields = computed(() => {
  const r = record.value || {}
  const p = production.value
  const fields = [
    { key: 'code', label: '编号', value: display(r.code) },
    { key: 'status', label: '状态', value: productStatusLabel.value },
    { key: 'barcodeType', label: '条码类型', value: display(r.barcodeType) },
    { key: 'materialType', label: '类型', value: display(r.materialType) },
    { key: 'supplyForm', label: '供应型态', value: display(r.supplyForm) },
    { key: 'specModel', label: '规格型号', value: display(r.specModel) },
    { key: 'inventoryUnit', label: '库存单位', value: display(r.inventoryUnit) },
    {
      key: 'shelfLifeDays',
      label: '保质期',
      value: r.shelfLifeDays == null || r.shelfLifeDays === '' ? '—' : `${r.shelfLifeDays} 天`,
    },
    {
      key: 'recheckDays',
      label: '复验期',
      value: r.recheckDays == null || r.recheckDays === '' ? '—' : `${r.recheckDays} 天`,
    },
    {
      key: 'storageCondition',
      label: '储存条件',
      value: display(formatStorageConditions(r.storageCondition)),
    },
    {
      key: 'productCategory',
      label: '产品类别',
      value: categoryTitle(productCategoryState.tree, r.productCategoryKey || r.categoryKey),
    },
    {
      key: 'materialCategory',
      label: '物料类别',
      value: categoryTitle(materialCategoryState.tree, r.materialCategoryKey || r.categoryKey),
    },
    { key: 'productAttribute', label: '产品属性', value: display(r.productAttribute) },
    { key: 'standardSpec', label: '标准规范', value: display(r.standardSpec) },
    {
      key: 'planStrategy',
      label: '计划策略',
      value: optionLabel(PLAN_STRATEGY_OPTIONS, p.planStrategy),
    },
  ]
  if (isPlanStrategyMts(p.planStrategy)) {
    fields.push({ key: 'replenishQty', label: '补货批量', value: display(p.replenishQty) })
  }
  fields.push(
    { key: 'defaultWarehouse', label: '默认存放仓库', value: display(p.defaultWarehouse) },
    { key: 'defaultProcessRoute', label: '默认工艺路线', value: display(p.defaultProcessRoute) },
    { key: 'defaultWorkCenter', label: '默认工作中心', value: display(p.defaultWorkCenter) },
    { key: 'techParams', label: '技术参数', value: display(r.techParams), fullRow: true },
    { key: 'remark', label: '备注', value: display(r.remark), fullRow: true },
  )
  return fields
})

const unitFields = computed(() => [
  { key: 'baseUnit', label: '主单位', value: display(unitHydrated.value.baseUnit) },
])

const auxUnitColumns = [
  { title: '辅助单位', dataIndex: 'unit', key: 'unit', width: 120 },
  { title: '业务角色', key: 'roles', width: 140 },
  { title: '换算说明', key: 'convert' },
  { title: '状态', key: 'status', width: 80 },
]

const salesFields = computed(() => {
  const r = record.value || {}
  const ex = Number(r.unitPrice)
  const rate = Number(r.outputTaxRate)
  const incl =
    Number.isFinite(ex) && Number.isFinite(rate) ? Number((ex * (1 + rate / 100)).toFixed(2)) : ex
  const pack =
    r.standardPackQty != null && r.standardPackQty !== ''
      ? `${r.standardPackQty}${r.standardPackUnit ? ` ${r.standardPackUnit}` : ''}`
      : ''
  return [
    { key: 'unitPrice', label: '标准单价(不含税)', value: displayMoney(r.unitPrice) },
    { key: 'unitPriceInclTax', label: '标准单价(含税)', value: displayMoney(incl) },
    {
      key: 'outputTaxRate',
      label: '销项税',
      value: r.outputTaxRate == null || r.outputTaxRate === '' ? '—' : `${r.outputTaxRate}%`,
    },
    { key: 'standardPackQty', label: '标准包装量', value: display(pack) },
  ]
})

const purchaseFields = computed(() => {
  const r = record.value || {}
  return [
    {
      key: 'inputTaxRate',
      label: '进项税',
      value: r.inputTaxRate == null || r.inputTaxRate === '' ? '—' : `${r.inputTaxRate}%`,
    },
    {
      key: 'purchaseControlStrategy',
      label: '控制策略',
      value: display(r.purchaseControlStrategy || production.value.purchaseControlStrategy),
    },
  ]
})

const supplierColumns = [
  { title: '供应商', dataIndex: 'supplierName', key: 'supplierName' },
  { title: '类型', dataIndex: 'supplierType', key: 'supplierType', width: 120 },
  { title: '采购单价（不含税）', dataIndex: 'unitPriceExTax', key: 'unitPriceExTax', width: 150 },
  { title: '采购单价（含税）', key: 'unitPriceInclTax', width: 140 },
  { title: '币种', dataIndex: 'currency', key: 'currency', width: 80 },
  { title: '供货期（天）', dataIndex: 'leadTimeDays', key: 'leadTimeDays', width: 120 },
]

const productionFields = computed(() => {
  const p = production.value
  return [
    {
      key: 'standardCycleDays',
      label: '标准制造周期',
      value:
        p.standardCycleDays == null || p.standardCycleDays === ''
          ? '—'
          : `${p.standardCycleDays} 天`,
    },
    {
      key: 'inboundQcRequirement',
      label: '入库质检要求',
      value: inboundQcOptions.includes(p.inboundQcRequirement)
        ? p.inboundQcRequirement
        : display(p.inboundQcRequirement),
    },
    { key: 'isKeyPart', label: '关键物料', value: yesNo(p.isKeyPart) },
    { key: 'isAuxiliary', label: '辅料标识', value: yesNo(p.isAuxiliary) },
    { key: 'isHazardous', label: '危险品标识', value: yesNo(p.isHazardous) },
  ]
})

const laborSwitchFields = computed(() => [
  { key: 'laborEnabled', label: '启用工时配置', value: yesNo(record.value?.laborEnabled) },
])

const laborColumns = [
  { title: '工序', dataIndex: 'processName', key: 'processName' },
  { title: '报工类型', dataIndex: 'reportType', key: 'reportType', width: 120 },
  {
    title: '单件标准工时',
    dataIndex: 'standardMinutesPerPiece',
    key: 'standardMinutesPerPiece',
    width: 130,
  },
  {
    title: '整批准备工时',
    dataIndex: 'setupMinutesPerBatch',
    key: 'setupMinutesPerBatch',
    width: 130,
  },
  { title: '计薪方式', dataIndex: 'salaryMethod', key: 'salaryMethod', width: 120 },
  { title: '标准工时单价', dataIndex: 'standardHourlyRate', key: 'standardHourlyRate', width: 130 },
  { title: '单件计件单价', dataIndex: 'pieceRate', key: 'pieceRate', width: 130 },
]

const alertFields = computed(() => {
  const a = alert.value
  const fields = [
    { key: 'stockAlertEnabled', label: '库存预警', value: yesNo(a.stockAlertEnabled) },
  ]
  if (a.stockAlertEnabled) {
    fields.push(
      { key: 'maxStockQty', label: '最高库存', value: display(a.maxStockQty) },
      { key: 'minStockQty', label: '最低库存', value: display(a.minStockQty) },
    )
  }
  fields.push({ key: 'expiryAlertEnabled', label: '过期预警', value: yesNo(a.expiryAlertEnabled) })
  if (a.expiryAlertEnabled) {
    const days = Number(a.expiryAlertDays)
    fields.push({
      key: 'expiryAlertDays',
      label: '提前天数',
      value: Number.isFinite(days) && days > 0 ? `${days} 天` : '—',
    })
  }
  fields.push({
    key: 'defectRateThreshold',
    label: '不良率预警阈值',
    value:
      a.defectRateThreshold == null || a.defectRateThreshold === ''
        ? '—'
        : `${a.defectRateThreshold}%`,
  })
  return fields
})

const showProductMaterialsSection = computed(
  () =>
    kind.value === ITEM_KIND.PRODUCT ||
    kind.value === ITEM_KIND.PRODUCT_MATERIAL ||
    Boolean(record.value?.canSell),
)

function resolveProductMaterialKind(name = '', type = '') {
  const lower = String(name).toLowerCase()
  const mime = String(type || '').toLowerCase()
  if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(lower)) return 'image'
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(lower)) return 'video'
  if (mime.includes('word') || mime === 'application/msword' || /\.docx?$/i.test(lower)) {
    return 'word'
  }
  if (mime.includes('excel') || mime.includes('spreadsheet') || /\.xlsx?$/i.test(lower)) {
    return 'excel'
  }
  return 'file'
}

function productMaterialTypeLabel(kind) {
  return (
    {
      image: '图片',
      video: '视频',
      word: 'Word',
      excel: 'Excel',
      file: '文件',
    }[kind] || '文件'
  )
}

const productMaterials = computed(() => {
  const r = record.value || {}
  const list = Array.isArray(r.productMaterials)
    ? r.productMaterials
    : Array.isArray(r.productImages)
      ? r.productImages
      : []
  return list
    .map((item, i) => {
      const name = item?.name || `产品资料${i + 1}`
      const url = item?.url || item?.thumbUrl || item?.dataUrl || ''
      const type = item?.type || item?.fileType || ''
      const fileType = item?.fileType || resolveProductMaterialKind(name, type)
      return {
        uid: item?.uid || `detail-file-${i}`,
        name,
        url,
        thumbUrl: item?.thumbUrl || (fileType === 'image' ? url : ''),
        fileType,
      }
    })
    .filter((item) => item.url)
    .slice(0, 9)
})

watch(
  record,
  (row) => {
    if (!row) return
    const tab = tabStore.tabs.find((t) => t.path === route.path)
    if (tab) tab.title = `产品 ${row.code || row.name || ''}`.trim()
  },
  { immediate: true },
)

function handleEdit() {
  const id = record.value?.id
  if (!id) return
  openCreateTab(router, openTab, {
    path: `/product-process/products/${id}/edit`,
    title: `编辑产品 ${record.value.code || record.value.name || ''}`.trim(),
  })
}

function handleMaintainFormula() {
  const id = record.value?.id
  if (!id) return
  const hit = findMaintainFormula(id)
  if (hit) {
    const path = `/product-process/bom/${hit.id}`
    openTab(path, hit.name || '配方详情')
    router.push(path)
    return
  }
  const query = new URLSearchParams({ itemId: String(id) })
  if (record.value.name) query.set('itemName', record.value.name)
  const fullPath = `/product-process/bom/new?${query.toString()}`
  openTab(fullPath, '新增配方')
  router.push(fullPath)
}

function handleBack() {
  router.push('/product-process/products')
}
</script>

<style lang="less" scoped>
.product-master-detail-page {
  margin: -12px;
  padding: 12px;
  height: calc(100vh - 112px);
  max-height: calc(100vh - 112px);
  min-height: 0;
  background: var(--page-bg, #f0f2f5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-sticky-bar {
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--page-bg, #f0f2f5);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.order-no {
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
  white-space: nowrap;
}

.product-name {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.65);
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-body {
  flex: 1;
  min-height: 0;
  padding: 12px 0 16px;
  overflow: auto;
}

.section-card {
  background: #fff;
  border-radius: 8px;
  padding: 12px 16px 16px;
  margin-bottom: 8px;
  border: 1px solid #e5e6eb;
  box-shadow: none;
}

.section-title {
  margin-bottom: 8px;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: #1f2329;
}

.detail-sub-table {
  margin-top: 12px;
}

.product-material-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.product-material-item {
  display: flex;
  align-items: center;
}

.product-material-thumb :deep(.ant-image),
.product-material-item :deep(.ant-image) {
  width: 104px;
  height: 104px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
}

.product-material-item :deep(.ant-image-img) {
  width: 104px;
  height: 104px;
  object-fit: cover;
}

.product-material-file {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.product-material-link {
  color: #307068;
  word-break: break-all;
}

.product-material-empty {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 22px;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.overview-card {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e5e6eb;
  padding: 10px 12px;
  min-height: 72px;
}

.overview-card.clickable {
  cursor: pointer;
}

.overview-card.clickable:hover {
  border-color: #a9c6c2;
  box-shadow: 0 2px 8px rgba(48, 112, 104, 0.08);
}

.overview-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 18px;
}

.overview-tip {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
}

.overview-value {
  margin-top: 6px;
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
  line-height: 22px;
  word-break: break-all;
}

.overview-card.tone-blue {
  border-top: 3px solid #307068;
}
.overview-card.tone-cyan {
  border-top: 3px solid #307068;
}
.overview-card.tone-purple {
  border-top: 3px solid #722ed1;
}
.overview-card.tone-orange {
  border-top: 3px solid #fa8c16;
}
.overview-card.tone-green {
  border-top: 3px solid #52c41a;
}
.overview-card.tone-gold {
  border-top: 3px solid #d4b106;
}
.overview-card.tone-red {
  border-top: 3px solid #f5222d;
}

.bom-ref-hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.bom-ref-link {
  color: #307068;
  cursor: pointer;
}

@media (max-width: 1400px) {
  .overview-cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .overview-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
