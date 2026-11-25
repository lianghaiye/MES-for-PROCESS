<template>
  <FormCreateShell page-mode :title="isEdit ? '编辑配方' : '新增配方'" @cancel="goBack">
    <template #footer>
      <a-button @click="goBack">取消</a-button>
      <a-button v-if="isEdit" @click="handleSaveAsNew">另存为新配方</a-button>
      <a-button @click="handleSave">保存</a-button>
      <a-button type="primary" @click="handleSaveAndPublish">保存并发布</a-button>
    </template>
    <p v-if="isEdit" class="page-hint">
      当前为待发布版本，保存只改这一版。生效配方请先「升版」再编辑。另存为新配方时，编号与当前相同或留空会新生成编号。
    </p>
    <div class="modal-basic-card">
      <div class="section-title">基本信息</div>
      <a-form layout="inline" class="horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="6">
            <a-form-item label="配方编号">
              <a-input v-model:value="form.formulaNo" size="small" placeholder="留空则自动生成" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="配方类型" required>
              <a-select
                v-model:value="form.formulaType"
                size="small"
                :options="formulaTypeOptions"
                placeholder="请选择"
              />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="配方名称" required>
              <a-input v-model:value="form.name" size="small" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="配方版本">
              <span class="readonly-value">{{ formulaVersionText }}</span>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="主产品" required>
              <MasterItemSelect
                v-model="form.itemId"
                modal-title="选择主产品"
                placeholder="请选择主产品"
                @change="syncMainOutput"
              />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="基准批量" required>
              <a-input-number
                v-model:value="form.baseBatchQty"
                size="small"
                :min="0.001"
                style="width: 100%"
                addon-after="kg"
                @change="syncMainExpected"
              />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="理论得率" required>
              <a-input-number
                v-model:value="form.theoreticalYield"
                size="small"
                :min="0"
                :max="1"
                :step="0.01"
                style="width: 100%"
                @change="syncMainExpected"
              />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="工艺路线">
              <a-select
                v-model:value="form.routeId"
                size="small"
                allow-clear
                show-search
                option-filter-prop="label"
                :options="routeOptions"
                placeholder="请选择工艺路线"
                style="width: 100%"
                @change="onRouteChange"
              />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="默认配方">
              <a-switch v-model:checked="form.isDefault" size="small" />
            </a-form-item>
          </a-col>
          <a-col v-if="form.itemId" :span="24">
            <div class="product-info-box">
              <div class="info-grid-row">
                <div v-for="item in productInfoItems" :key="item.label" class="info-grid-cell">
                  <span class="info-label">{{ item.label }}</span>
                  <span class="info-value">{{ item.value }}</span>
                </div>
              </div>
              <div class="info-row">
                <span class="info-label">备注</span>
                <span class="info-value">{{ masterText(form.itemId, 'remark') }}</span>
              </div>
            </div>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <div class="block">
      <div class="block-head">
        <span>工艺阶段</span>
        <a-button size="small" @click="addStep">添加阶段</a-button>
      </div>
      <p class="block-hint">
        请先维护工艺阶段，再填写产出与投料所属阶段。阶段从工序配置中选择，同一道工序可以出现多次；选中后带出该工序参数，设定值可按本配方修改。设备可先选分类，再多选候选台；有工艺路线时，候选设备优先落在路线该工序挂的设备上。执行时用本阶段选定的设备，产线不改这台设备。
      </p>
      <a-table
        :columns="stageColumns"
        :data-source="stageRows"
        :pagination="false"
        size="small"
        row-key="key"
        :scroll="{ x: 1280 }"
        :locale="{ emptyText: '还没有阶段' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'stepNo'">{{ record.stepIndex + 1 }}</template>
          <template v-else-if="column.key === 'stepName'">
            <a-select
              :value="stepProcessValue(record.step)"
              size="small"
              show-search
              option-filter-prop="label"
              :options="processStepOptions"
              placeholder="请选择工序"
              style="width: 100%"
              @change="(value) => onStepProcessChange(record.step, value)"
            />
          </template>
          <template v-else-if="column.key === 'equipmentCategory'">
            <a-select
              v-model:value="record.step.equipmentCategory"
              size="small"
              allow-clear
              show-search
              option-filter-prop="label"
              :options="equipmentCategoryOpts"
              placeholder="设备分类"
              style="width: 100%"
              @change="() => onEquipmentCategoryChange(record.step)"
            />
          </template>
          <template v-else-if="column.key === 'equipment'">
            <EquipmentSearchSelect
              v-model="record.step.equipmentIds"
              :options="equipmentOptions(record.step)"
              :allow-ids="equipmentAllowIds(record.step)"
              :category-filter="record.step.equipmentCategory || ''"
              placeholder="候选设备（可多选）"
              :max-tag-count="1"
            />
          </template>
          <template v-else-if="column.key === 'name'">
            <a-input
              v-if="record.param"
              v-model:value="record.param.name"
              size="small"
              placeholder="如温度"
            />
            <span v-else>—</span>
          </template>
          <template v-else-if="column.key === 'unit'">
            <a-select
              v-if="record.param"
              v-model:value="record.param.unit"
              size="small"
              show-search
              allow-clear
              :options="paramUnitOptions"
              placeholder="请选择"
              style="width: 100%"
            />
            <span v-else>—</span>
          </template>
          <template v-else-if="column.key === 'target'">
            <a-input-number
              v-if="record.param"
              v-model:value="record.param.target"
              size="small"
              style="width: 100%"
            />
            <span v-else>—</span>
          </template>
          <template v-else-if="column.key === 'min'">
            <a-input-number
              v-if="record.param"
              v-model:value="record.param.min"
              size="small"
              style="width: 100%"
            />
            <span v-else>—</span>
          </template>
          <template v-else-if="column.key === 'max'">
            <a-input-number
              v-if="record.param"
              v-model:value="record.param.max"
              size="small"
              style="width: 100%"
            />
            <span v-else>—</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="addParam(record.step)">添加参数</a-button>
            <a-button type="link" size="small" danger @click="removeStageRow(record)"
              >删除</a-button
            >
          </template>
        </template>
      </a-table>
    </div>

    <div class="block">
      <div class="block-head">
        <span>产出</span>
        <a-button size="small" @click="addOutput">添加产出</a-button>
      </div>
      <p class="block-hint">
        主产品预期数量 = 基准批量 ×
        理论得率。联产品、副产品、回收料、废弃物按一个基准批量单独填写；请指定在哪一工序产出。产出行只配
        <strong>产出化验</strong>
        （门禁可改，不回写工序主数据）；过程检在工艺阶段/工序化验清单配置。记产出时按勾选带出检单。
      </p>
      <a-table
        :columns="outputColumns"
        :data-source="form.outputs"
        :pagination="false"
        size="small"
        row-key="key"
        :scroll="{ x: 1980 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <a-select
              v-model:value="record.role"
              size="small"
              :options="outputRoleOptions(record)"
              style="width: 120px"
              :disabled="record.role === 'main'"
            />
          </template>
          <template v-else-if="column.key === 'item'">
            <MasterItemSelect
              v-model="record.itemId"
              placeholder="请选择物料"
              :disabled="record.role === 'main'"
            />
          </template>
          <template v-else-if="column.key === 'code'">{{
            masterText(record.itemId, 'code')
          }}</template>
          <template v-else-if="column.key === 'materialType'">{{
            masterText(record.itemId, 'materialType')
          }}</template>
          <template v-else-if="column.key === 'specModel'">{{
            masterText(record.itemId, 'specModel')
          }}</template>
          <template v-else-if="column.key === 'stage'">
            <a-select
              v-model:value="record.stepKey"
              size="small"
              allow-clear
              placeholder="产出工序"
              :options="stageOptions"
              style="width: 100%"
              @change="() => onOutputStepChange(record)"
            />
          </template>
          <template v-else-if="column.key === 'assay'">
            <div class="output-assay-panel">
              <template v-if="!record.stepKey">
                <span class="output-assay-empty">请先选产出工序</span>
              </template>
              <div v-else class="output-assay-row">
                <a-checkbox
                  :checked="outputAssayEnabled(record)"
                  @change="(e) => onOutputAssayToggle(record, e.target.checked)"
                >
                  产出化验
                </a-checkbox>
                <a-select
                  :value="outputAssayGateMode(record)"
                  size="small"
                  :options="PROCESS_GATE_OPTIONS"
                  :disabled="!outputAssayEnabled(record)"
                  :placeholder="outputAssayEnabled(record) ? '请选择门禁' : '勾选后必选'"
                  style="flex: 1; min-width: 140px"
                  @change="(value) => onOutputAssayGateSelect(record, value)"
                />
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'qty'">
            <span v-if="record.role === 'main'">{{ mainExpectedText }}</span>
            <a-input-number
              v-else
              v-model:value="record.expectedQty"
              size="small"
              :min="0"
              style="width: 120px"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button
              v-if="record.role !== 'main'"
              type="link"
              size="small"
              danger
              @click="removeOutput(record.key)"
              >删除</a-button
            >
            <span v-else>—</span>
          </template>
        </template>
      </a-table>
    </div>

    <div class="block">
      <div class="block-head">
        <span>投料明细</span>
        <a-space :size="8">
          <a-button size="small" @click="convertOpen = true">换算工具</a-button>
          <a-button size="small" @click="addLine">添加投料</a-button>
        </a-space>
      </div>
      <p class="block-hint">
        投料量与配比二选一。开启「按有效含量折算」时，右侧「理论投料」=（投料量或基准批量×配比）×(1+损耗)÷有效含量；配方有效含量只用于算出计划领用量。现场实投以手填或原料批次有效含量为准，缺有效含量不能过账。
      </p>
      <div class="ratio-bar">
        <span>配比合计 {{ ratioPercentText }}</span>
        <a-tag v-if="ratioOnly && ratioOk" color="success">已到 100%</a-tag>
        <span v-else-if="ratioOnly" class="ratio-warn">须到 100% 才能保存</span>
        <span v-else-if="hasFeedQtyLine" class="ratio-note">投料量行不计入，不要求 100%</span>
        <span v-else class="ratio-note">配比行填齐后，合计须到 100%</span>
      </div>
      <a-table
        :columns="lineColumns"
        :data-source="form.lines"
        :pagination="false"
        size="small"
        row-key="key"
        :scroll="{ x: 2360 }"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">{{ index + 1 }}</template>
          <template v-else-if="column.key === 'item'">
            <MasterItemSelect
              v-model="record.itemId"
              placeholder="请选择物料"
              @change="(id) => id && fillFromMaster(record, id)"
            />
          </template>
          <template v-else-if="column.key === 'code'">{{
            masterText(record.itemId, 'code')
          }}</template>
          <template v-else-if="column.key === 'materialType'">{{
            masterText(record.itemId, 'materialType')
          }}</template>
          <template v-else-if="column.key === 'specModel'">{{
            masterText(record.itemId, 'specModel')
          }}</template>
          <template v-else-if="column.key === 'feedQty'">
            <a-input-number
              v-model:value="record.feedQty"
              size="small"
              :min="0"
              :disabled="feedQtyLocked(record)"
              :placeholder="feedQtyLocked(record) ? '已填配比' : '与配比二选一'"
              addon-after="kg"
              style="width: 100%"
              @change="onFeedQtyChange(record)"
            />
          </template>
          <template v-else-if="column.key === 'ratio'">
            <a-input-number
              :value="percentValue(record.ratio)"
              size="small"
              :min="0"
              :max="100"
              :step="1"
              :disabled="ratioLocked(record)"
              :placeholder="ratioLocked(record) ? '已填投料量' : '占基准批量'"
              addon-after="%"
              style="width: 100%"
              @change="(value) => onRatioPercent(record, value)"
            />
          </template>
          <template v-else-if="column.key === 'loss'">
            <a-input-number
              :value="percentValue(record.lossRate)"
              size="small"
              :min="0"
              :step="1"
              addon-after="%"
              style="width: 100%"
              @change="(value) => onLossPercent(record, value)"
            />
          </template>
          <template v-else-if="column.key === 'tolerance'">
            <a-input-number
              :value="percentValue(record.tolerance)"
              size="small"
              :min="0"
              :step="1"
              addon-after="%"
              placeholder="允许偏离"
              style="width: 100%"
              @change="(value) => onTolerancePercent(record, value)"
            />
          </template>
          <template v-else-if="column.key === 'keyMaterial'">
            <a-switch v-model:checked="record.isKeyMaterial" size="small" />
          </template>
          <template v-else-if="column.key === 'auxiliary'">
            <a-switch v-model:checked="record.isAuxiliary" size="small" />
          </template>
          <template v-else-if="column.key === 'seq'">
            <a-input-number v-model:value="record.feedSequence" size="small" :min="1" />
          </template>
          <template v-else-if="column.key === 'stage'">
            <a-select
              v-model:value="record.stepKey"
              size="small"
              allow-clear
              placeholder="不指定"
              :options="stageOptions"
              style="width: 100%"
            />
          </template>
          <template v-else-if="column.key === 'contentFlag'">
            <a-switch v-model:checked="record.convertByContent" size="small" />
          </template>
          <template v-else-if="column.key === 'content'">
            <a-input-number
              :value="percentValue(record.content)"
              size="small"
              :min="0"
              :max="100"
              :step="0.1"
              :disabled="!record.convertByContent"
              placeholder="如 98.5"
              addon-after="%"
              style="width: 100%"
              @change="(value) => onContentPercent(record, value)"
            />
          </template>
          <template v-else-if="column.key === 'theoreticalQty'">
            <span :class="{ muted: lineTheoreticalQty(record) === '—' }">{{
              lineTheoreticalQty(record)
            }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" danger @click="removeLine(record.key)"
              >删除</a-button
            >
          </template>
        </template>
      </a-table>
    </div>

    <a-modal
      v-model:open="convertOpen"
      title="换算工具"
      :width="520"
      :mask-closable="true"
      destroy-on-close
    >
      <div class="mode-switch">
        <div class="mode-switch-label">换算方式</div>
        <a-radio-group
          v-model:value="convertDraft.unit"
          option-type="button"
          button-style="solid"
          size="small"
          :options="feedConvertUnitOptions"
        />
        <div class="mode-switch-hint">{{ convertModeHint }}</div>
      </div>
      <a-form layout="inline" class="horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="12">
            <a-form-item label="数量">
              <a-input-number
                v-model:value="convertDraft.qty"
                size="small"
                :min="0"
                :addon-after="convertUnitAddon"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col v-if="convertDraft.unit !== 'g'" :span="12">
            <a-form-item label="密度">
              <a-input-number
                v-model:value="convertDraft.density"
                size="small"
                :min="0"
                addon-after="kg/L"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
      <div class="convert-result-card">
        <span class="convert-result-label">折合公斤</span>
        <span class="convert-result-value">{{ convertKgText }}</span>
      </div>
      <p class="convert-tip">结果不会写入投料明细，请把公斤数自行填到对应行的投料量。</p>
      <template #footer>
        <a-button @click="convertOpen = false">关闭</a-button>
      </template>
    </a-modal>
  </FormCreateShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import FormCreateShell from '@/components/FormCreateShell.vue'
import { useFormCreatePage } from '@/composables/useFormCreatePage'
import MasterItemSelect from '@/views/product-process/components/MasterItemSelect.vue'
import EquipmentSearchSelect from '@/views/product-process/components/EquipmentSearchSelect.vue'
import { getProcessById, processConfigState } from '@/store/processConfigStore'
import { getProcessRouteById, processRouteState } from '@/store/processRouteStore'
import { collectRouteEquipmentIds, countGridProcesses } from '@/utils/processRouteGrid'
import {
  deviceLabelById,
  equipmentState,
  formatDeviceLabel,
  listDevices,
} from '@/store/equipmentStore'
import { EQUIPMENT_CATEGORY_OPTIONS, EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
import {
  PROCESS_GATE_HARD,
  PROCESS_GATE_OPTIONS,
  PROCESS_GATE_RECORD,
} from '@/mock/processConfigSeed'
import {
  calcTheoreticalFeed,
  convertToFeedKg,
  isRatioOnlyFormula,
  ratiosClosed,
  sumFeedRatios,
  theoreticalOutput,
} from '@/utils/processBatchMath'
import {
  createProcessQcConfig,
  isFinishedAssayScheme,
  normalizeProcessQcConfigs,
} from '@/utils/qcProcessConfig'
import {
  FORMULA_TYPE_OPTIONS,
  assayScopesFromSchemes,
  getFormula,
  itemMasterCard,
  itemMasterProfile,
  itemUnit,
  OUTPUT_ROLE_OPTIONS,
  normalizeOutputAssayScopes,
  publishFormula,
  saveFormula,
  stepParamRows,
} from '@/store/processFormulaStore'
import {
  getEnabledProcessParamUnitOptions,
  processParamUnitState,
} from '@/store/processParamUnitStore'

const route = useRoute()
const { goBack } = useFormCreatePage('/product-process/bom')
const isEdit = computed(() => Boolean(route.params.id) && !route.path.endsWith('/new'))

let keySeq = 1
function nextKey() {
  keySeq += 1
  return `k-${keySeq}`
}

function blankParam(name = '', unit = '') {
  return { key: nextKey(), name, unit, target: null, min: null, max: null }
}

function resolveStepProcess(step) {
  const byId = step?.processId ? getProcessById(step.processId) : null
  if (byId) return byId
  const name = String(step?.name || '').trim()
  if (!name) return null
  return (
    processConfigState.processes.find((item) => item.name === name && item.status === '使用中') ||
    processConfigState.processes.find((item) => item.name === name) ||
    null
  )
}

function paramsFromProcess(proc) {
  const rows = (proc?.params || []).filter((param) => String(param.name || '').trim())
  if (!rows.length) return [blankParam()]
  return rows.map((param) => ({
    key: nextKey(),
    name: param.name,
    unit: param.unit || '',
    target: param.target ?? null,
    min: param.min ?? null,
    max: param.max ?? null,
  }))
}

function assaySchemesFromProcess(proc, existing) {
  if (Array.isArray(existing) && existing.length) {
    return normalizeProcessQcConfigs(existing)
  }
  return normalizeProcessQcConfigs(proc?.qcConfigs || [])
}

function blankStep(name, params, processId = '', equipmentPartial = {}, assaySchemes) {
  const proc = resolveStepProcess({ name, processId })
  const fromLegacy =
    typeof equipmentPartial === 'string'
      ? { equipmentId: equipmentPartial }
      : equipmentPartial || {}
  let equipmentIds = Array.isArray(fromLegacy.equipmentIds) ? [...fromLegacy.equipmentIds] : []
  if (!equipmentIds.length && fromLegacy.equipmentId) {
    equipmentIds = [fromLegacy.equipmentId]
  }
  return {
    key: nextKey(),
    name: proc?.name || name || '',
    processId: proc?.id || '',
    equipmentCategory: fromLegacy.equipmentCategory || undefined,
    equipmentIds,
    params: params?.length ? params : paramsFromProcess(proc),
    assaySchemes: assaySchemesFromProcess(proc, assaySchemes),
  }
}

function blankLine(stepKey) {
  return {
    key: nextKey(),
    itemId: undefined,
    feedQty: null,
    ratio: null,
    lossRate: 0,
    tolerance: null,
    feedSequence: 1,
    stepKey,
    convertByContent: false,
    content: null,
    isKeyMaterial: false,
    isAuxiliary: false,
  }
}

const form = reactive({
  formulaNo: '',
  name: '',
  formulaType: 'standard',
  itemId: undefined,
  baseBatchQty: 30,
  theoreticalYield: 0.95,
  isDefault: false,
  routeId: undefined,
  outputs: [],
  lines: [blankLine()],
  steps: [blankStep('投料'), blankStep('保温'), blankStep('灌装')],
})

const existing = isEdit.value ? getFormula(route.params.id) : null
onMounted(() => {
  if (existing?.status === 'active') {
    message.warning('生效配方请使用「升版」生成待发布版本后再编辑')
    goBack()
  }
})
if (existing) {
  form.formulaNo = existing.formulaNo || ''
  form.name = existing.name
  form.formulaType = existing.formulaType || 'standard'
  form.itemId = existing.itemId
  form.baseBatchQty = existing.baseBatchQty
  form.theoreticalYield = existing.theoreticalYield
  form.isDefault = Boolean(existing.isDefault)
  form.routeId = existing.routeId || undefined
  form.steps = (existing.steps || []).map((step) => {
    const params = stepParamRows(step).map((param) => ({ ...param, key: nextKey() }))
    return blankStep(
      step.name,
      params.length ? params : [blankParam()],
      step.processId,
      {
        equipmentCategory: step.equipmentCategory,
        equipmentIds: step.equipmentIds,
        equipmentId: step.equipmentId,
      },
      step.assaySchemes,
    )
  })
  form.outputs = existing.outputs.map((o) => {
    const step = form.steps[(Number(o.stepNo) || 0) - 1] || form.steps[form.steps.length - 1]
    const row = {
      ...o,
      key: nextKey(),
      stepKey: step?.key,
      assayScopes: normalizeOutputAssayScopes(o.assayScopes),
    }
    syncOutputAssayScopes(row)
    return row
  })
  form.lines = existing.lines.map((line) => {
    const profile = itemMasterProfile(line.itemId)
    const step = form.steps[(Number(line.stepNo) || 0) - 1]
    return {
      ...line,
      key: nextKey(),
      stepKey: step?.key,
      tolerance: line.tolerance ?? null,
      isKeyMaterial: line.isKeyMaterial ?? profile.isKeyMaterial,
      isAuxiliary: line.isAuxiliary ?? profile.isAuxiliary,
    }
  })
} else {
  const presetItemId = route.query.itemId ? String(route.query.itemId) : undefined
  form.itemId = presetItemId
  if (route.query.itemName) form.name = `${route.query.itemName}配方`
  const mainOutput = {
    key: nextKey(),
    role: 'main',
    itemId: presetItemId,
    expectedQty: null,
    stepKey: form.steps[form.steps.length - 1]?.key,
    assayScopes: [],
  }
  form.outputs = [mainOutput]
  syncOutputAssayScopes(mainOutput)
  if (form.lines[0]) form.lines[0].stepKey = form.steps[0]?.key
}
syncMainExpected()

function outputRoleOptions(record) {
  if (record.role === 'main') return OUTPUT_ROLE_OPTIONS
  return OUTPUT_ROLE_OPTIONS.filter((item) => item.value !== 'main')
}

const outputColumns = [
  { title: '角色', key: 'role', width: 140 },
  { title: '物料', key: 'item', width: 200 },
  { title: '编码', key: 'code', width: 120 },
  { title: '类型', key: 'materialType', width: 90 },
  { title: '规格', key: 'specModel', width: 150 },
  { title: '产出工序', key: 'stage', width: 160 },
  { title: '产出化验 / 门禁', key: 'assay', width: 320 },
  { title: '预期数量', key: 'qty', width: 140, align: 'right' },
  { title: '操作', key: 'action', width: 80 },
]
const lineColumns = [
  { title: '序号', key: 'index', width: 64, align: 'center' },
  { title: '物料', key: 'item', width: 180 },
  { title: '编码', key: 'code', width: 120 },
  { title: '类型', key: 'materialType', width: 90 },
  { title: '规格', key: 'specModel', width: 150 },
  { title: '投料量', key: 'feedQty', width: 150 },
  { title: '配比', key: 'ratio', width: 140 },
  { title: '损耗', key: 'loss', width: 130 },
  { title: '允差(±)', key: 'tolerance', width: 140 },
  { title: '顺序', key: 'seq', width: 90 },
  { title: '所属阶段', key: 'stage', width: 160 },
  { title: '关键物料', key: 'keyMaterial', width: 100 },
  { title: '辅料', key: 'auxiliary', width: 80 },
  { title: '按有效含量折算', key: 'contentFlag', width: 110 },
  { title: '有效含量(%)', key: 'content', width: 130 },
  { title: '理论投料', key: 'theoreticalQty', width: 120, align: 'right' },
  { title: '操作', key: 'action', width: 80 },
]
function stageCell(record) {
  return { rowSpan: record.rowSpan }
}

const stageColumns = [
  { title: '阶段', key: 'stepNo', width: 64, align: 'center', customCell: stageCell },
  { title: '阶段名称', key: 'stepName', width: 160, customCell: stageCell },
  { title: '设备分类', key: 'equipmentCategory', width: 120, customCell: stageCell },
  { title: '候选设备', key: 'equipment', width: 260, customCell: stageCell },
  { title: '参数', key: 'name', width: 120 },
  { title: '单位', key: 'unit', width: 90 },
  { title: '设定值', key: 'target', width: 100 },
  { title: '下限', key: 'min', width: 90 },
  { title: '上限', key: 'max', width: 90 },
  { title: '操作', key: 'action', width: 140 },
]

const equipmentCategoryOpts = EQUIPMENT_CATEGORY_OPTIONS
const stageOptions = computed(() =>
  form.steps.map((step, index) => ({
    value: step.key,
    label: `${index + 1} ${step.name || '未命名'}`,
  })),
)

const stageRows = computed(() => {
  const rows = []
  form.steps.forEach((step, stepIndex) => {
    const params = step.params.length ? step.params : [null]
    params.forEach((param, paramIndex) => {
      rows.push({
        key: param?.key || `${step.key}-empty`,
        step,
        param,
        stepIndex,
        rowSpan: paramIndex === 0 ? params.length : 0,
      })
    })
  })
  return rows
})

const paramUnitOptions = computed(() => {
  void processParamUnitState.units
  const options = getEnabledProcessParamUnitOptions()
  const known = new Set(options.map((item) => item.value))
  form.steps.forEach((step) => {
    step.params.forEach((param) => {
      if (param.unit && !known.has(param.unit)) {
        known.add(param.unit)
        options.push({ label: param.unit, value: param.unit })
      }
    })
  })
  return options
})

const formulaTypeOptions = FORMULA_TYPE_OPTIONS
const productInfoItems = computed(() => {
  if (!form.itemId) return []
  return [
    { label: '产品编码', value: masterText(form.itemId, 'code') },
    { label: '类型', value: masterText(form.itemId, 'materialType') },
    { label: '规格', value: masterText(form.itemId, 'specModel') },
    { label: '库存单位', value: itemUnit(form.itemId) || '—' },
  ]
})
const formulaVersionText = computed(() => existing?.version || 'V1.0')
const mainExpectedText = computed(() =>
  String(theoreticalOutput(form.baseBatchQty, form.theoreticalYield)),
)
const ratioSum = computed(() => sumFeedRatios(form.lines))
const ratioPercentText = computed(() => `${(ratioSum.value * 100).toFixed(2)}%`)
const ratioOnly = computed(() => isRatioOnlyFormula(form.lines))
const hasFeedQtyLine = computed(() => form.lines.some((line) => hasPositive(line.feedQty)))
const ratioOk = computed(() => ratiosClosed(form.lines))

function syncMainExpected() {
  const main = form.outputs.find((row) => row.role === 'main')
  if (!main) return
  main.expectedQty = theoreticalOutput(form.baseBatchQty, form.theoreticalYield)
}

function syncMainOutput() {
  const main = form.outputs.find((row) => row.role === 'main')
  if (main) main.itemId = form.itemId
  syncMainExpected()
}

function addOutput() {
  const row = {
    key: nextKey(),
    role: 'by',
    itemId: undefined,
    expectedQty: null,
    stepKey: form.steps[form.steps.length - 1]?.key,
    assayScopes: [],
  }
  form.outputs.push(row)
  syncOutputAssayScopes(row)
}

function findOutputStep(record) {
  if (!record?.stepKey) return null
  return form.steps.find((step) => step.key === record.stepKey) || null
}

function ensureStepAssaySchemes(step) {
  if (!step) return []
  if (!Array.isArray(step.assaySchemes)) step.assaySchemes = []
  if (step.assaySchemes.length) return step.assaySchemes
  const proc = resolveStepProcess(step)
  step.assaySchemes = assaySchemesFromProcess(proc)
  return step.assaySchemes
}

function outputAssaySchemes(record) {
  const step = findOutputStep(record)
  if (!step) return []
  return ensureStepAssaySchemes(step).filter(isFinishedAssayScheme)
}

function outputAssayEnabled(record) {
  return outputAssaySchemes(record).length > 0
}

function outputAssayGateMode(record) {
  return outputAssaySchemes(record)[0]?.gateMode || undefined
}

function syncOutputAssayScopes(record) {
  if (!record) return
  const schemes = outputAssaySchemes(record)
  record.assayScopes = assayScopesFromSchemes(schemes)
}

function onOutputStepChange(record) {
  const step = findOutputStep(record)
  if (step) ensureStepAssaySchemes(step)
  syncOutputAssayScopes(record)
}

function ensureOutputAssayScheme(record, gateMode = PROCESS_GATE_HARD) {
  const step = findOutputStep(record)
  if (!step) return null
  ensureStepAssaySchemes(step)
  let scheme = outputAssaySchemes(record)[0]
  if (!scheme) {
    scheme = createProcessQcConfig({
      bizScope: '成品检',
      assayType: 'finished',
      gateMode: gateMode === PROCESS_GATE_HARD ? PROCESS_GATE_HARD : PROCESS_GATE_RECORD,
      allowMultiple: true,
    })
    step.assaySchemes.push(scheme)
  }
  return scheme
}

function onOutputAssayToggle(record, checked) {
  if (!record?.stepKey) return
  if (checked) {
    const scheme = ensureOutputAssayScheme(record, PROCESS_GATE_HARD)
    if (scheme) {
      scheme.bizScope = '成品检'
      scheme.assayType = 'finished'
      scheme.name = '产出化验'
      scheme.templateCode = ''
      if (!scheme.gateMode) scheme.gateMode = PROCESS_GATE_HARD
      scheme.hardGate = scheme.gateMode === PROCESS_GATE_HARD
    }
    syncOutputAssayScopes(record)
    return
  }
  const step = findOutputStep(record)
  if (!step || !Array.isArray(step.assaySchemes)) return
  const finishedIds = new Set(outputAssaySchemes(record).map((row) => row.id))
  step.assaySchemes = step.assaySchemes.filter((row) => !finishedIds.has(row.id))
  syncOutputAssayScopes(record)
}

function onOutputAssayGateSelect(record, gateMode) {
  if (!gateMode) {
    message.warning('已启用产出化验，请选择门禁')
    return
  }
  const scheme = ensureOutputAssayScheme(record, gateMode)
  if (!scheme) return
  scheme.bizScope = '成品检'
  scheme.assayType = 'finished'
  scheme.name = '产出化验'
  scheme.templateCode = ''
  scheme.gateMode = gateMode === PROCESS_GATE_HARD ? PROCESS_GATE_HARD : PROCESS_GATE_RECORD
  scheme.hardGate = scheme.gateMode === PROCESS_GATE_HARD
  syncOutputAssayScopes(record)
}

function removeOutput(key) {
  form.outputs = form.outputs.filter((o) => o.key !== key)
}

function addLine() {
  form.lines.push(blankLine(form.steps[0]?.key))
}

function removeLine(key) {
  form.lines = form.lines.filter((line) => line.key !== key)
}

function addStep() {
  form.steps.push(blankStep('', [blankParam()]))
}

function addParam(step) {
  step.params.push(blankParam())
}

function removeStep(key) {
  form.steps = form.steps.filter((step) => step.key !== key)
  form.lines.forEach((line) => {
    if (line.stepKey === key) line.stepKey = undefined
  })
  form.outputs.forEach((row) => {
    if (row.stepKey === key) {
      row.stepKey = form.steps[form.steps.length - 1]?.key
      syncOutputAssayScopes(row)
    }
  })
}

function removeStageRow(record) {
  if (!record.param || record.step.params.length <= 1) {
    removeStep(record.step.key)
    return
  }
  record.step.params = record.step.params.filter((param) => param.key !== record.param.key)
}

function hasPositive(value) {
  return value !== '' && value != null && Number(value) > 0
}

function feedQtyLocked(record) {
  return hasPositive(record.ratio) && !hasPositive(record.feedQty)
}

function ratioLocked(record) {
  return hasPositive(record.feedQty) && !hasPositive(record.ratio)
}

function onFeedQtyChange(record) {
  if (hasPositive(record.feedQty)) record.ratio = null
}

const feedConvertUnitOptions = [
  { value: 'g', label: '克' },
  { value: 'mL', label: '毫升' },
  { value: 'L', label: '升' },
]
const convertOpen = ref(false)
const convertDraft = reactive({ qty: null, unit: 'g', density: null })
const convertUnitAddon = computed(() => ({ g: 'g', mL: 'mL', L: 'L' })[convertDraft.unit] || 'g')
const convertModeHint = computed(() => {
  if (convertDraft.unit === 'g') return '1000 g = 1 kg，不使用密度'
  if (convertDraft.unit === 'mL') return '公斤 = 毫升 × 密度（kg/L）÷ 1000'
  return '公斤 = 升 × 密度（kg/L）'
})
const convertKgText = computed(() => {
  const kg = convertToFeedKg(convertDraft.qty, convertDraft.unit, convertDraft.density)
  return kg == null ? '—' : `${kg} kg`
})

function onRatioChange(record) {
  if (hasPositive(record.ratio)) record.feedQty = null
}

function percentValue(fraction) {
  if (fraction === '' || fraction == null) return null
  const number = Number(fraction)
  if (Number.isNaN(number)) return null
  return Number((number * 100).toFixed(2))
}

function fractionFromPercent(percent) {
  if (percent === '' || percent == null) return null
  return Number((Number(percent) / 100).toFixed(4))
}

function onRatioPercent(record, percent) {
  record.ratio = fractionFromPercent(percent)
  onRatioChange(record)
}

function onLossPercent(record, percent) {
  record.lossRate = fractionFromPercent(percent) || 0
}

function onTolerancePercent(record, percent) {
  record.tolerance = fractionFromPercent(percent)
}

function onContentPercent(record, percent) {
  record.content = fractionFromPercent(percent)
}

function lineTheoreticalQty(record) {
  const calc = calcTheoreticalFeed(record, form.baseBatchQty)
  if (!calc.ok) return '—'
  const unit = itemUnit(record.itemId) || 'kg'
  return `${calc.qty} ${unit}`
}

const processStepOptions = computed(() => {
  const options = processConfigState.processes
    .filter((item) => item.status === '使用中')
    .map((item) => ({ label: item.name, value: item.id }))
  form.steps.forEach((step) => {
    if (step.processId && !options.some((item) => item.value === step.processId)) {
      options.push({ label: step.name || step.processId, value: step.processId })
    } else if (
      !step.processId &&
      step.name &&
      !options.some((item) => item.value === `legacy:${step.name}`)
    ) {
      options.push({ label: step.name, value: `legacy:${step.name}` })
    }
  })
  return options
})

function stepProcessValue(step) {
  if (step.processId) return step.processId
  return step.name ? `legacy:${step.name}` : undefined
}

const routeOptions = computed(() => {
  void processRouteState.routes
  const options = processRouteState.routes
    .filter(
      (item) =>
        item.status !== '已归档' &&
        (countGridProcesses(item.grid) > 0 || (item.units || []).length > 0),
    )
    .map((item) => ({
      value: item.id,
      label: `${item.code || ''} ${item.name || ''}`.trim(),
    }))
  if (form.routeId && !options.some((item) => item.value === form.routeId)) {
    const current = getProcessRouteById(form.routeId)
    options.unshift({
      value: form.routeId,
      label: current ? `${current.code || ''} ${current.name || ''}`.trim() : form.routeId,
    })
  }
  return options
})

function selectableDevices(step) {
  void equipmentState.devices
  const proc = step?.processId ? getProcessById(step.processId) : null
  const allowedByProcess = proc?.equipmentIds?.length ? new Set(proc.equipmentIds) : null
  const route = form.routeId ? getProcessRouteById(form.routeId) : null
  const onProcess = collectRouteEquipmentIds(route, step?.processId)
  const routeIds = onProcess.length ? onProcess : collectRouteEquipmentIds(route, '')
  let devices = listDevices().filter((device) => device.status !== EQUIPMENT_STATUS.SCRAPPED)
  if (step?.equipmentCategory) {
    devices = devices.filter((device) => device.category === step.equipmentCategory)
  }
  if (routeIds.length) {
    const allowed = new Set(routeIds)
    devices = devices.filter((device) => allowed.has(device.id))
    devices.sort((a, b) => routeIds.indexOf(a.id) - routeIds.indexOf(b.id))
  }
  if (allowedByProcess) devices = devices.filter((device) => allowedByProcess.has(device.id))
  return devices
}

function equipmentOptions(step) {
  const options = selectableDevices(step).map((device) => ({
    value: device.id,
    label: formatDeviceLabel(device),
  }))
  ;(step.equipmentIds || []).forEach((id) => {
    if (id && !options.some((item) => item.value === id)) {
      options.unshift({
        value: id,
        label: deviceLabelById(id) || id,
      })
    }
  })
  return options
}

function equipmentAllowIds(step) {
  return selectableDevices(step).map((device) => device.id)
}

function reconcileEquipment(step, prefill) {
  if (!Array.isArray(step.equipmentIds)) step.equipmentIds = []
  const devices = selectableDevices(step)
  const ids = new Set(devices.map((device) => device.id))
  step.equipmentIds = step.equipmentIds.filter((id) => ids.has(id))
  if (!step.equipmentIds.length && prefill && devices.length === 1) {
    step.equipmentIds = [devices[0].id]
  }
}

function onEquipmentCategoryChange(step) {
  reconcileEquipment(step, false)
}

function onRouteChange() {
  form.steps.forEach((step) => reconcileEquipment(step, true))
}

function onStepProcessChange(step, value) {
  if (String(value || '').startsWith('legacy:')) {
    step.processId = ''
    step.name = String(value).slice('legacy:'.length)
    step.assaySchemes = []
    reconcileEquipment(step, true)
    form.outputs.forEach((row) => {
      if (row.stepKey === step.key) syncOutputAssayScopes(row)
    })
    return
  }
  const proc = getProcessById(value)
  step.processId = proc?.id || ''
  step.name = proc?.name || step.name
  step.params = paramsFromProcess(proc)
  step.assaySchemes = assaySchemesFromProcess(proc)
  reconcileEquipment(step, true)
  form.outputs.forEach((row) => {
    if (row.stepKey === step.key) syncOutputAssayScopes(row)
  })
}

function fillFromMaster(record, itemId) {
  const profile = itemMasterProfile(itemId)
  record.isKeyMaterial = profile.isKeyMaterial
  record.isAuxiliary = profile.isAuxiliary
}

function masterText(itemId, field) {
  if (!itemId) return '—'
  const value = itemMasterCard(itemId)[field]
  if (value == null || value === '') return '—'
  return String(value)
}

function assignLineSteps() {
  const stepNoByKey = new Map(form.steps.map((step, index) => [step.key, index + 1]))
  form.lines.forEach((line) => {
    line.stepNo = stepNoByKey.get(line.stepKey) || null
  })
  form.outputs.forEach((row) => {
    row.stepNo = stepNoByKey.get(row.stepKey) || null
    syncOutputAssayScopes(row)
  })
}

function handleSave() {
  try {
    syncMainOutput()
    assignLineSteps()
    saveFormula(form, existing?.id)
    message.success('保存成功')
    goBack()
  } catch (error) {
    message.error(error.message || '保存失败')
  }
}

function handleSaveAndPublish() {
  try {
    syncMainOutput()
    assignLineSteps()
    const saved = saveFormula(form, existing?.id)
    publishFormula(saved.id)
    message.success('保存并发布成功，当前版本已生效')
    goBack()
  } catch (error) {
    message.error(error.message || '保存并发布失败')
  }
}

function handleSaveAsNew() {
  try {
    syncMainOutput()
    assignLineSteps()
    const payload = { ...form, isDefault: false }
    const typedNo = String(payload.formulaNo || '').trim()
    if (!typedNo || typedNo === existing?.formulaNo) payload.formulaNo = ''
    const sourceName = existing?.name?.trim()
    if (sourceName && String(payload.name || '').trim() === sourceName) {
      payload.name = `${sourceName} 副本`
    }
    const created = saveFormula(payload)
    message.success(`已另存为新配方 ${created.formulaNo}，待发布。原配方未改动`)
    goBack()
  } catch (error) {
    message.error(error.message || '保存失败')
  }
}
</script>

<style scoped>
.modal-basic-card {
  margin-bottom: 8px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}
.section-title,
.block-head {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
}
.block {
  margin-bottom: 8px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}
.block-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.block-hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 20px;
  color: #86909c;
}
.page-hint {
  margin: 0 0 8px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 22px;
  color: #4e5969;
  background: #f7f8fa;
  border-radius: 8px;
}
.readonly-value {
  display: inline-block;
  min-height: 32px;
  line-height: 32px;
  color: #1f2329;
}
.product-info-box {
  width: 100%;
  margin: 4px 0 8px;
  padding: 10px 12px;
  background: #e7f2f0;
  border: 1px solid #a9c6c2;
  border-radius: 6px;
  box-sizing: border-box;
}
.info-grid-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px 12px;
  margin-bottom: 8px;
}
.info-grid-cell,
.info-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  line-height: 22px;
  font-size: 13px;
}
.info-label {
  flex: 0 0 auto;
  color: rgba(0, 0, 0, 0.45);
  white-space: nowrap;
}
.info-value {
  flex: 1;
  min-width: 0;
  color: rgba(0, 0, 0, 0.88);
  word-break: break-all;
}
.mode-switch {
  margin-bottom: 12px;
}
.mode-switch-label {
  margin-bottom: 6px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}
.mode-switch-hint,
.convert-tip {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 20px;
  color: rgba(0, 0, 0, 0.45);
}
.convert-result-card {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 12px;
  background: #e7f2f0;
  border: 1px solid #a9c6c2;
  border-radius: 6px;
}
.convert-result-label {
  color: rgba(0, 0, 0, 0.45);
  font-size: 13px;
}
.convert-result-value {
  color: rgba(0, 0, 0, 0.88);
  font-size: 16px;
  font-weight: 600;
}
.ratio-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #1f2329;
}
.muted {
  color: #86909c;
}

.ratio-note {
  color: #4e5969;
}
.ratio-warn {
  color: #d4380d;
}
.output-assay-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
}

.output-assay-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.output-assay-empty {
  color: #86909c;
  font-size: 12px;
}
</style>
