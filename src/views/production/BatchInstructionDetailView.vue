<template>
  <FormCreateShell v-if="order" page-mode detail-mode :title="order.batchNo">
    <template #header-extra>
      <a-tag
        :color="
          order.status === 'done'
            ? 'success'
            : order.status === 'running'
              ? 'processing'
              : order.status === 'cancelled'
                ? 'default'
                : 'warning'
        "
      >
        {{ ORDER_STATUS_LABEL[order.status] }}
      </a-tag>
    </template>
    <template #footer>
      <a-button v-if="order.status === 'pending_release'" type="primary" @click="release"
        >下发</a-button
      >
      <a-button v-if="order.status === 'running'" @click="openFeedFor()">投料</a-button>
      <a-button v-if="order.status === 'running' && hasPendingOutput" @click="openOutputFor()"
        >产出入库</a-button
      >
      <a-button v-if="order.status === 'running'" type="primary" @click="finish">完成</a-button>
      <a-button
        v-if="order.status === 'pending_release' || order.status === 'running'"
        danger
        @click="cancelOrder"
        >作废</a-button
      >
      <a-button @click="goBack">返回列表</a-button>
    </template>

    <div class="batch-detail-stack">
      <div class="plan-metric-bar">
        <div class="plan-metric-item">
          <div class="plan-metric-label">当前阶段</div>
          <div class="plan-metric-value">{{ stageText }}</div>
        </div>
        <div class="plan-metric-item">
          <div class="plan-metric-label">步骤进度</div>
          <div class="plan-metric-value">{{ stepProgressText }}</div>
        </div>
        <div class="plan-metric-item">
          <div class="plan-metric-label">实投</div>
          <div class="plan-metric-value">{{ feedQtyText }}</div>
        </div>
        <div class="plan-metric-item">
          <div class="plan-metric-label">实际产出</div>
          <div class="plan-metric-value accent">{{ actualOutputText }}</div>
        </div>
        <div class="plan-metric-item">
          <div class="plan-metric-label">得率差</div>
          <div class="plan-metric-value">{{ order.yieldGap ?? '—' }}</div>
        </div>
      </div>

      <div class="batch-detail-tabs">
        <a-tabs
          v-model:active-key="detailTab"
          class="detail-tabs detail-tabs-pill detail-tabs-pill--nav-only"
        >
          <a-tab-pane key="info" tab="基本信息" />
          <a-tab-pane key="feed" tab="投料明细" />
          <a-tab-pane key="ebr" tab="批记录（EBR）" />
          <a-tab-pane key="output" tab="产出与追溯" />
          <a-tab-pane key="route" tab="工艺路线" />
          <a-tab-pane key="log" :tab="`操作日志 (${operationLogs.length})`" />
        </a-tabs>
      </div>

      <div v-show="detailTab === 'info'" class="batch-tab-pane">
        <DetailSectionCard title="基本信息">
          <div class="meta-bar">
            <span
              ><i>创建时间</i><b>{{ order.createdAt || '—' }}</b></span
            >
            <span
              ><i>产线</i><b>{{ productionLineText }}</b></span
            >
            <span
              ><i>来源计划</i><b>{{ order.sourceLabel || '—' }}</b></span
            >
          </div>
          <div class="formula-kv">
            <div>
              <span class="k">主产品：</span><span class="v">{{ itemLabel(order.itemId) }}</span>
            </div>
            <div>
              <span class="k">配方：</span
              ><span class="v">{{ order.formulaName }} {{ order.formulaVersion }}</span>
            </div>
            <div>
              <span class="k">工艺路线：</span><span class="v">{{ routeText }}</span>
            </div>
            <div>
              <span class="k">计划投料量：</span><span class="v">{{ qtyText }}</span>
            </div>
            <div>
              <span class="k">批序：</span><span class="v">{{ seqText }}</span>
            </div>
            <div>
              <span class="k">理论产出：</span><span class="v">{{ theoreticalOutputText }}</span>
            </div>
            <div v-if="order.reworkOfBatchId">
              <span class="k">前批次：</span
              ><span class="v">{{ batchNo(order.reworkOfBatchId) }}</span>
            </div>
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="工艺阶段">
          <a-table
            :columns="stepColumns"
            :data-source="stepRows"
            :pagination="false"
            size="small"
            row-key="stepNo"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'done'">
                <a-tag :color="record.confirmed ? 'success' : 'default'">{{
                  record.confirmed ? '已确认' : '未确认'
                }}</a-tag>
              </template>
              <template v-else-if="column.key === 'gate'">
                <a-tag :color="record.gateLabel === '硬门禁' ? 'warning' : 'default'">{{
                  record.gateLabel
                }}</a-tag>
              </template>
              <template v-else-if="column.key === 'qc'">
                <template v-if="stepAssayRecords(record).length">
                  <div
                    v-for="row in stepAssayRecords(record).slice(-2)"
                    :key="row.taskId"
                    class="qc-line"
                  >
                    <a-button type="link" size="small" @click="goQcTask(row.taskId)">
                      {{ row.schemeName || row.qcNo || '检单' }}
                    </a-button>
                    <a-tag
                      :color="
                        row.qcResult === '质检通过' || row.qcResult === '合格'
                          ? 'success'
                          : row.qcStatus === '待质检'
                            ? 'processing'
                            : 'default'
                      "
                    >
                      {{ row.qcResult || row.qcStatus || '待质检' }}
                    </a-tag>
                  </div>
                </template>
                <span v-else-if="stepAssaySchemes(record).length" class="muted">可化验</span>
                <span v-else>—</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <template v-if="order.status === 'running'">
                  <a-button
                    v-if="stepHasFeeds(record.stepNo)"
                    type="link"
                    size="small"
                    @click="openFeedFor(record.stepNo)"
                    >投料</a-button
                  >
                  <a-button
                    v-if="stepAssaySchemes(record).length"
                    type="link"
                    size="small"
                    @click="openAssay(record)"
                    >化验</a-button
                  >
                  <a-button
                    v-if="stepHasOutputs(record.stepNo)"
                    type="link"
                    size="small"
                    @click="openOutputFor(record.stepNo)"
                    >产出</a-button
                  >
                  <a-button type="link" size="small" @click="openStep(record)">
                    {{ record.confirmed ? '重新确认' : '确认本步' }}
                  </a-button>
                </template>
                <template v-else-if="record.qcLink?.taskId">
                  <a-button type="link" size="small" @click="goQcTask(record.qcLink.taskId)"
                    >查看检单</a-button
                  >
                </template>
                <span v-else>—</span>
              </template>
            </template>
          </a-table>
        </DetailSectionCard>
      </div>

      <div v-show="detailTab === 'route'" class="batch-tab-pane">
        <DetailSectionCard title="工艺路线">
          <a-table
            v-if="showRouteSteps"
            :columns="routeStepColumns"
            :data-source="routeStepRows"
            :pagination="false"
            size="small"
            row-key="key"
          />
          <a-table
            v-else
            :columns="unitColumns"
            :data-source="unitRows"
            :pagination="false"
            size="small"
            row-key="key"
            :locale="{ emptyText: '未指定工艺路线' }"
          />
        </DetailSectionCard>
      </div>

      <div v-show="detailTab === 'feed'" class="batch-tab-pane">
        <DetailSectionCard title="投料明细">
          <a-table
            :columns="feedColumns"
            :data-source="feedRows"
            :pagination="false"
            size="small"
            row-key="key"
            :scroll="{ x: 1880 }"
          />
        </DetailSectionCard>
      </div>

      <div v-show="detailTab === 'ebr'" class="batch-tab-pane">
        <DetailSectionCard title="批记录（EBR）">
          <a-table
            :columns="ebrColumns"
            :data-source="ebrRows"
            :pagination="false"
            size="small"
            row-key="key"
            :locale="{ emptyText: '确认工序后，采集数据会出现在这里' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'source'">
                <a-tag v-if="record.source === 'system'" color="blue">系统</a-tag>
                <a-tag v-else-if="record.source === 'param'" color="processing">参数</a-tag>
                <a-tag v-else-if="record.source === 'feed'" color="cyan">投料</a-tag>
                <a-tag v-else-if="record.source === 'qc'" color="purple">过程检</a-tag>
                <a-tag v-else color="default">手工</a-tag>
              </template>
            </template>
          </a-table>
        </DetailSectionCard>

        <DetailSectionCard title="取样、检验与放行">
          <a-table
            :columns="assayColumns"
            :data-source="assayRows"
            :pagination="false"
            size="small"
            row-key="key"
            :locale="{ emptyText: '还没有过程检' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'judge'">
                <a-tag
                  v-if="record.judge !== '—'"
                  :color="
                    record.judge === '质检通过' || record.judge === '合格' ? 'success' : 'default'
                  "
                >
                  {{ record.judge }}
                </a-tag>
                <span v-else>—</span>
              </template>
              <template v-else-if="column.key === 'qcNo'">
                <a-button
                  v-if="record.taskId"
                  type="link"
                  size="small"
                  @click="goQcTask(record.taskId)"
                >
                  {{ record.qcNo }}
                </a-button>
                <span v-else>—</span>
              </template>
            </template>
          </a-table>
        </DetailSectionCard>
      </div>

      <div v-show="detailTab === 'output'" class="batch-tab-pane">
        <DetailSectionCard title="产出与物料平衡">
          <p class="section-hint">投入 {{ feedQtyText }}，产出合计 {{ outputSumText }}。</p>
          <a-table
            :columns="balanceColumns"
            :data-source="balanceRows"
            :pagination="false"
            size="small"
            row-key="key"
            :scroll="{ x: 1100 }"
            :locale="{ emptyText: '配方未维护产出' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'inbound'">
                <template v-if="record.inboundLinks.length">
                  <a
                    v-for="link in record.inboundLinks"
                    :key="link.id"
                    class="doc-link"
                    @click="goInbound(link)"
                    >{{ link.docNo }}</a
                  >
                </template>
                <span v-else>—</span>
              </template>
            </template>
          </a-table>
        </DetailSectionCard>

        <DetailSectionCard title="产出与追溯">
          <a-table
            :columns="outColumns"
            :data-source="outRows"
            :pagination="false"
            size="small"
            row-key="batchId"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag>{{ BATCH_STATUS_LABEL[record.status] || '—' }}</a-tag>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button
                  v-if="record.status === 'pending'"
                  type="link"
                  size="small"
                  @click="releaseOut(record.batchId)"
                  >成品放行</a-button
                >
                <a-button
                  v-else-if="record.status === 'released'"
                  type="link"
                  size="small"
                  @click="rework(record)"
                  >返工</a-button
                >
              </template>
            </template>
          </a-table>
        </DetailSectionCard>
      </div>

      <div v-show="detailTab === 'log'" class="batch-tab-pane">
        <DetailSectionCard title="操作日志">
          <a-table
            :columns="logColumns"
            :data-source="operationLogs"
            row-key="id"
            size="small"
            :pagination="operationLogs.length > 10 ? { pageSize: 10, size: 'small' } : false"
            :locale="{ emptyText: '还没有操作日志' }"
            :scroll="{ x: 720 }"
          />
        </DetailSectionCard>
      </div>
    </div>

    <a-modal
      :open="stepOpen"
      :title="`确认本步 · ${currentStep?.name || ''}`"
      :width="720"
      :mask-closable="false"
      destroy-on-close
      @cancel="stepOpen = false"
      @ok="saveStep"
    >
      <a-alert
        v-if="priorAssayHintForStep"
        class="prior-assay-hint"
        type="info"
        show-icon
        :message="priorAssayHintForStep.text"
      />
      <div v-if="stepFeedSummary.length" class="modal-basic-card step-report-card">
        <div class="section-title">本步投料（只读）</div>
        <p class="section-hint">
          实投量与含量在「投料」过账中填写并扣库存；此处仅汇总，过程记录模板不再采集实投。
        </p>
        <a-table
          :columns="stepFeedSummaryColumns"
          :data-source="stepFeedSummary"
          :pagination="false"
          size="small"
          row-key="key"
        />
      </div>

      <div class="modal-basic-card step-report-card">
        <div class="section-title">工艺参数</div>
        <p class="section-hint">填写本阶段参数实际值；留空表示本项不记。</p>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col v-for="(field, index) in currentParams" :key="field.key" :span="12">
              <a-form-item :label="paramLabel(field)">
                <a-input-number
                  v-model:value="stepActuals[index]"
                  size="small"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col v-if="!currentParams.length" :span="24">
              <span class="muted">本阶段没有工艺参数。</span>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <div class="modal-basic-card step-report-card">
        <div class="section-title">
          过程记录
          <span v-if="currentFormTemplate?.templateName" class="tpl-name"
            >（{{ currentFormTemplate.templateName }}）</span
          >
        </div>
        <ProcessStepReportFields
          :fields="currentFormFields"
          :model="formValues"
          :system-ctx="formSystemCtx"
          @update:model="(v) => Object.assign(formValues, v)"
        />
      </div>
    </a-modal>

    <a-modal
      :open="openFeed"
      title="投料过账"
      :width="960"
      :mask-closable="false"
      destroy-on-close
      @cancel="openFeed = false"
      @ok="saveFeed"
    >
      <a-alert
        v-if="priorAssayHintForFeed"
        class="prior-assay-hint"
        type="info"
        show-icon
        :message="priorAssayHintForFeed.text"
      />
      <div class="modal-basic-card step-report-card">
        <div class="section-title">基本信息</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="12">
              <a-form-item label="阶段" required>
                <a-select
                  v-model:value="feedForm.stepNo"
                  size="small"
                  :options="feedStepOptions"
                  placeholder="请选择阶段"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="补加">
                <a-checkbox v-model:checked="feedForm.extra"
                  >带出其他阶段或未指定阶段的物料</a-checkbox
                >
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <p class="section-hint">
          清单来自配方投料明细；按行选择原料批次、填写实投与含量后过账并扣库存。
        </p>
      </div>

      <div class="feed-lines-title">投料明细</div>
      <a-table
        :columns="feedDraftColumns"
        :data-source="feedLineDrafts"
        :pagination="false"
        size="small"
        row-key="key"
        :locale="{ emptyText: '本阶段没有计划投料，可勾选补加或换阶段' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'batchId'">
            <a-select
              v-model:value="record.batchId"
              size="small"
              allow-clear
              style="width: 100%"
              :options="batchOptionsForItem(record.itemId)"
              placeholder="合格未过期批次"
              @change="(val) => onFeedBatchChange(record, val)"
            />
          </template>
          <template v-else-if="column.key === 'qty'">
            <a-input-number
              v-model:value="record.qty"
              size="small"
              :min="0"
              :precision="3"
              style="width: 100%"
              placeholder="实投"
            />
          </template>
          <template v-else-if="column.key === 'content'">
            <a-input-number
              v-model:value="record.content"
              size="small"
              :min="0"
              :max="1"
              :step="0.01"
              :precision="4"
              style="width: 100%"
              :placeholder="record.convertByContent ? '必填' : '可选'"
            />
          </template>
        </template>
      </a-table>
    </a-modal>

    <a-modal
      :open="assayOpen"
      :title="`化验 · ${assayStep?.name || ''}`"
      :width="520"
      :mask-closable="false"
      destroy-on-close
      ok-text="发起化验"
      @cancel="assayOpen = false"
      @ok="submitAssay"
    >
      <a-alert
        v-if="priorAssayHintForAssay"
        class="prior-assay-hint"
        type="info"
        show-icon
        :message="priorAssayHintForAssay.text"
      />
      <div class="modal-basic-card step-report-card">
        <div class="section-title">选择化验方案</div>
        <p class="section-hint">
          同一方案在未完成时可继续打开；完成后可再次发起复检（方案允许时）。
        </p>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="24">
              <a-form-item label="方案" required>
                <a-select
                  v-model:value="assaySchemeId"
                  size="small"
                  :options="assaySchemeOptions"
                  placeholder="请选择"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <a-table
          v-if="assayHistoryRows.length"
          style="margin-top: 12px"
          :columns="assayHistoryColumns"
          :data-source="assayHistoryRows"
          :pagination="false"
          size="small"
          row-key="taskId"
        />
      </div>
    </a-modal>

    <a-modal
      :open="openOutput"
      title="产出入库"
      :width="720"
      :mask-closable="false"
      destroy-on-close
      @cancel="openOutput = false"
      @ok="saveOutput"
    >
      <div class="modal-basic-card step-report-card">
        <div class="section-title">基本信息</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="12">
              <a-form-item label="阶段" required>
                <a-select
                  v-model:value="outputForm.stepNo"
                  size="small"
                  :options="outputStepOptions"
                  placeholder="产出工序"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="入库罐" required>
                <a-select v-model:value="outputTank" size="small" :options="tankOptions" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="补加">
                <a-checkbox v-model:checked="outputForm.extra"
                  >带出其他阶段或未指定阶段的产出</a-checkbox
                >
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="异常偏差">
                <a-input v-model:value="deviation" size="small" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <p class="section-hint">清单来自配方产出（已关联工序）；按行填实际量后入库。</p>
      </div>
      <a-table
        :columns="expectColumns"
        :data-source="outputDrafts"
        :pagination="false"
        size="small"
        row-key="key"
        :locale="{ emptyText: '本阶段没有计划产出，可勾选补加或换阶段' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'actual'">
            <a-input-number
              v-model:value="record.actual"
              size="small"
              :min="0"
              :precision="3"
              style="width: 100%"
            />
          </template>
        </template>
      </a-table>
    </a-modal>
  </FormCreateShell>
  <a-empty v-else description="未找到批次指令" />
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import FormCreateShell from '@/components/FormCreateShell.vue'
import { currentProcessStep } from '@/utils/processRouteBoard'
import DetailSectionCard from '@/components/DetailSectionCard.vue'
import { useFormCreatePage } from '@/composables/useFormCreatePage'
import { useTabs } from '@/composables/useTabs'
import {
  formatStepParams,
  getFormula,
  itemLabel,
  itemMasterCard,
  itemUnit,
  OUTPUT_ROLE_LABEL,
  stepParamRows,
} from '@/store/processFormulaStore'
import { formatNumber, formatQtyWithUnit } from '@/utils/numberFormat'
import {
  ORDER_STATUS_LABEL,
  cancelBatchOrder,
  completeOrder,
  completionErrors,
  confirmStep,
  createRework,
  getBatchOrder,
  getStepQcLink,
  getStepQcRecords,
  postFeeds,
  postOutput,
  releaseOrder,
  releaseOutputBatch,
} from '@/store/batchInstructionStore'
import { getProcessById } from '@/store/processConfigStore'
import { formatProcessGate, normalizeProcessGate } from '@/mock/processConfigSeed'
import { createProcessQcFromBatchStep, getQcTaskById } from '@/store/qcTaskStore'
import { formatProductionLineLabel } from '@/store/productionLineStore'
import { buildPriorInProcessAssayHint, resolveAssaySchemesForStep } from '@/utils/qcProcessConfig'
import { qcBizScopeLabel } from '@/constants/qcBizScopeLabel'
import {
  BATCH_STATUS_LABEL,
  getMaterialBatch,
  listIssueableBatches,
  listTanks,
} from '@/store/materialBatchStore'
import { resolveStepFormTemplate } from '@/utils/processFormTemplateSnapshot'
import {
  isProcessFormSystemField,
  resolveProcessFormSystemValue,
} from '@/utils/processFormSystemField'
import ProcessStepReportFields from '@/views/production/components/ProcessStepReportFields.vue'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const { openTab } = useTabs()
const { goBack } = useFormCreatePage('/production/work-orders')
const order = computed(() => getBatchOrder(route.params.id))
const productionLineText = computed(() => {
  const current = order.value
  if (!current) return '—'
  if (current.productionLineId) return formatProductionLineLabel(current.productionLineId) || '—'
  if (current.executeBy === 'formula' || current.feedPlanId) return '按配方设备'
  return '—'
})

const unitColumns = [
  { title: '顺序', dataIndex: 'seq', width: 70, align: 'center' },
  { title: '设备', dataIndex: 'equipmentText' },
]
const routeStepColumns = [
  { title: '列', dataIndex: 'stepNo', width: 70 },
  { title: '行', dataIndex: 'rowNo', width: 70 },
  { title: '工序', dataIndex: 'name', width: 120 },
  { title: '设备', dataIndex: 'equipmentText', width: 180 },
  { title: '回流', dataIndex: 'returnText' },
]
const stepColumns = [
  { title: '序', dataIndex: 'stepNo', width: 70 },
  { title: '阶段', dataIndex: 'name', width: 120 },
  { title: '作业能力', dataIndex: 'equipmentText', width: 160 },
  { title: '配方要求', dataIndex: 'limitText', width: 200 },
  { title: '实绩摘要', dataIndex: 'summaryText', width: 180 },
  { title: '转序条件', dataIndex: 'transitionText', width: 160 },
  { title: '门禁判定', key: 'done', width: 100 },
  { title: '化验', key: 'qc', width: 200 },
  { title: '操作', key: 'action', width: 220 },
]
const assayColumns = [
  { title: '取样点', dataIndex: 'point', width: 140 },
  { title: '时间', dataIndex: 'at', width: 160 },
  { title: '检验项', dataIndex: 'item', width: 140 },
  { title: '检单', key: 'qcNo', width: 140 },
  { title: '实测', dataIndex: 'actual', width: 120 },
  { title: '判定', key: 'judge', width: 110 },
]
const logColumns = [
  { title: '操作时间', dataIndex: 'operatedAt', width: 170 },
  { title: '操作', dataIndex: 'action', width: 140 },
  { title: '操作人', dataIndex: 'operator', width: 120 },
  { title: '说明', dataIndex: 'remark' },
]
const balanceColumns = [
  { title: '产出类型', dataIndex: 'roleLabel', width: 100 },
  { title: '物料', dataIndex: 'item', width: 180 },
  { title: '阶段', dataIndex: 'stepText', width: 140 },
  { title: '理论产出', dataIndex: 'planQtyText', align: 'right', width: 120 },
  { title: '实际产出', dataIndex: 'qtyText', align: 'right', width: 120 },
  { title: '占比', dataIndex: 'ratioText', align: 'right', width: 90 },
  { title: '去向批号', dataIndex: 'batchNo', width: 180 },
  { title: '入库单号', key: 'inbound', width: 160 },
]
const assayHistoryColumns = [
  { title: '方案', dataIndex: 'schemeName', width: 120 },
  { title: '检单', dataIndex: 'qcNo', width: 120 },
  { title: '状态', dataIndex: 'statusText' },
]
const feedColumns = [
  { title: '原料', dataIndex: 'item', width: 140 },
  { title: '编号', dataIndex: 'itemCode', width: 120 },
  { title: '规格', dataIndex: 'specText', width: 140 },
  { title: '阶段', dataIndex: 'stepText', width: 120 },
  { title: '理论投料', dataIndex: 'planQtyText', align: 'right', width: 120 },
  { title: '允差(±)', dataIndex: 'toleranceText', align: 'right', width: 90 },
  { title: '实投', dataIndex: 'postedText', align: 'right', width: 110 },
  { title: '补料次数', dataIndex: 'supplementText', align: 'right', width: 90 },
  { title: '偏差', dataIndex: 'gapText', align: 'right', width: 110 },
  { title: '含量', dataIndex: 'contentText', align: 'right', width: 90 },
  { title: '关键物料', dataIndex: 'keyText', width: 90 },
  { title: '辅料', dataIndex: 'auxText', width: 80 },
  { title: '原料批次', dataIndex: 'batches', width: 160 },
  { title: '执行人', dataIndex: 'operatorText', width: 120 },
  { title: '执行时间', dataIndex: 'executedAtText', width: 160 },
]
const feedDraftColumns = [
  { title: '原料', dataIndex: 'item', width: 140 },
  { title: '理论量', dataIndex: 'planQty', width: 90, align: 'right' },
  { title: '已投', dataIndex: 'posted', width: 80, align: 'right' },
  { title: '原料批次', key: 'batchId', width: 260 },
  { title: '实投量', key: 'qty', width: 120 },
  { title: '含量', key: 'content', width: 110 },
]
const stepFeedSummaryColumns = [
  { title: '原料', dataIndex: 'item', width: 140 },
  { title: '理论', dataIndex: 'planQty', width: 90, align: 'right' },
  { title: '已投', dataIndex: 'posted', width: 90, align: 'right' },
  { title: '含量', dataIndex: 'contentText', width: 90, align: 'right' },
  { title: '批次', dataIndex: 'batches' },
]
const ebrColumns = [
  { title: '步骤', dataIndex: 'stepText', width: 120 },
  { title: '项目', dataIndex: 'name', width: 140 },
  { title: '来源', key: 'source', width: 80 },
  { title: '值', dataIndex: 'value' },
  { title: '时间', dataIndex: 'at', width: 160 },
]
const outColumns = [
  { title: '角色', dataIndex: 'roleLabel', width: 100 },
  { title: '物料', dataIndex: 'item' },
  { title: '阶段', dataIndex: 'stepText', width: 120 },
  { title: '批次号', dataIndex: 'batchNo' },
  { title: '数量', dataIndex: 'qty', align: 'right' },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 120 },
]
const expectColumns = [
  { title: '角色', dataIndex: 'roleLabel', width: 100 },
  { title: '物料', dataIndex: 'item' },
  { title: '预期', dataIndex: 'qty', align: 'right', width: 90 },
  { title: '已产', dataIndex: 'posted', align: 'right', width: 90 },
  { title: '本次实产', key: 'actual', width: 140 },
]
const roleLabel = OUTPUT_ROLE_LABEL

const qtyText = computed(() => {
  const row = order.value
  if (!row) return '—'
  if (row.qtyConfirmed === false || row.qty == null || row.qty === '') return '待确认'
  return `${row.qty} ${row.unit || ''}`.trim()
})
const seqText = computed(() => {
  const row = order.value
  if (!row || !(Number(row.batchCount) > 1)) return '—'
  return `${row.seq}/${row.batchCount}`
})
const stageText = computed(() => currentProcessStep(order.value, getFormula)?.text || '—')
const stepProgressText = computed(() => {
  const steps = order.value?.routeSnapshot || []
  if (!steps.length) return '—'
  const done = (order.value?.confirmedSteps || []).length
  return `${done}/${steps.length}`
})
const feedQtyText = computed(() => {
  const rows = order.value?.feeds || []
  if (!rows.length) return '—'
  const sum = rows.reduce((total, row) => total + (Number(row.qty) || 0), 0)
  return `${sum} ${order.value?.unit || ''}`.trim()
})
const actualOutputText = computed(() => {
  const value = order.value?.actualOutput
  if (value == null || value === '') return '—'
  return `${value} ${order.value?.unit || ''}`.trim()
})
const theoreticalOutputText = computed(() => {
  const value = order.value?.theoreticalOutput
  if (value == null || value === '') return '待确认'
  return `${value} ${order.value?.unit || ''}`.trim()
})

const routeText = computed(() => {
  const route = order.value?.equipmentRoute
  if (!route?.routeId && !route?.routeName) return '—'
  return `${route.routeCode || ''} ${route.routeName || ''}`.trim() || '—'
})
const unitRows = computed(() =>
  (order.value?.equipmentRoute?.units || []).map((unit, index) => ({
    key: `${unit.equipmentId || 'unit'}-${index}`,
    seq: index + 1,
    equipmentText: unit.equipmentName || '—',
  })),
)
const routeStepRows = computed(() =>
  (order.value?.equipmentRoute?.steps || []).map((step, index) => ({
    key: `${step.stepNo}-${step.rowNo}-${index}`,
    stepNo: step.stepNo,
    rowNo: step.rowNo,
    name: step.name || '—',
    equipmentText: step.equipmentName || '—',
    returnText: step.returnText || '—',
  })),
)
const showRouteSteps = computed(() => {
  const mode = order.value?.equipmentRoute?.routeMode
  if (mode === 'equipment') return false
  return routeStepRows.value.length > 0
})
const stepRows = computed(() =>
  (order.value?.routeSnapshot || []).map((step) => {
    const tpl = resolveStepFormTemplate(step)
    const qcLink = refreshStepQcLink(order.value, step.stepNo)
    const proc = step.processId ? getProcessById(step.processId) : null
    const gateMode = normalizeProcessGate(step.gateMode || proc?.gateMode)
    const assaySchemes = resolveAssaySchemesForStep(step, proc)
    return {
      ...step,
      assaySchemes,
      gateMode,
      gateLabel: formatProcessGate(gateMode).startsWith('硬') ? '硬门禁' : '记录',
      equipmentText: step.equipmentName || '—',
      formTemplateText: tpl?.templateName || '—',
      limitText: formatStepParams(step) || '—',
      transitionText: [
        formatProcessGate(gateMode).startsWith('硬') ? '硬门禁' : '记录',
        tpl?.templateName,
      ]
        .filter(Boolean)
        .join(' · '),
      summaryText: stepSummaryText(step.stepNo),
      confirmed: order.value.confirmedSteps.includes(step.stepNo),
      qcLink,
      assayRecords: getStepQcRecords(order.value, step.stepNo),
    }
  }),
)
function stepSummaryText(stepNo) {
  const current = order.value
  if (!current) return '—'
  const feeds = (current.feeds || []).filter((row) => Number(row.stepNo) === Number(stepNo))
  const params = (current.paramActuals || []).filter((row) => Number(row.stepNo) === Number(stepNo))
  const parts = []
  if (feeds.length) {
    const qty = feeds.reduce((sum, row) => sum + Number(row.qty || 0), 0)
    const unit = itemUnit(feeds[0].itemId) || current.unit || ''
    parts.push(`投料 ${formatQtyWithUnit(qty, unit)}`)
  }
  if (params.length) {
    parts.push(
      params
        .slice(0, 2)
        .map((row) => `${row.key} ${row.value}`)
        .join('，'),
    )
  }
  if (current.confirmedSteps?.includes(stepNo) && !parts.length) parts.push('已确认')
  return parts.join('；') || '—'
}

function contentWithUnit(value) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const pct = Math.abs(n) <= 1 ? n * 100 : n
  return `${formatNumber(pct, 2)}%`
}

function joinFeedText(feeds, pick) {
  const parts = feeds.map(pick).filter((value) => value != null && value !== '')
  return parts.length ? parts.join('，') : '—'
}

const feedRows = computed(() => {
  const posted = order.value?.feeds || []
  return (order.value?.theoreticalFeeds || []).map((line, index) => {
    const feeds = posted.filter((f) => f.itemId === line.itemId)
    const lastContent = feeds.length ? feeds[feeds.length - 1].contentUsed : null
    const card = itemMasterCard(line.itemId)
    const unit = itemUnit(line.itemId) || order.value?.unit || ''
    const postedQty = feeds.reduce((sum, row) => sum + Number(row.qty), 0) || 0
    const planQty = Number(line.qty)
    return {
      key: `${line.itemId}-${index}`,
      item: card.name || itemLabel(line.itemId) || '—',
      itemCode: card.code || '—',
      specText: card.specModel || '—',
      stepText: line.stepNo ? `${line.stepNo} ${line.stepName || ''}`.trim() : '—',
      planQtyText: formatQtyWithUnit(line.qty, unit),
      toleranceText:
        line.tolerance == null || line.tolerance === ''
          ? '—'
          : `${Number((Number(line.tolerance) * 100).toFixed(2))}%`,
      postedText: formatQtyWithUnit(postedQty, unit),
      supplementText: String(Math.max(0, feeds.length - 1)),
      gapText: feeds.length && planQty > 0 ? formatQtyWithUnit(postedQty - planQty, unit) : '—',
      contentText: contentWithUnit(lastContent),
      keyText: line.isKeyMaterial ? '是' : '否',
      auxText: line.isAuxiliary ? '是' : '否',
      batches: joinFeedText(feeds, (row) => row.batchNo),
      operatorText: joinFeedText(feeds, (row) => row.operator),
      executedAtText: joinFeedText(feeds, (row) => row.at),
    }
  })
})

const assayRows = computed(() => {
  const steps = order.value?.routeSnapshot || []
  return steps.flatMap((step) =>
    getStepQcRecords(order.value, step.stepNo).map((row, index) => ({
      key: `${step.stepNo}-${row.taskId || index}`,
      point: `${step.stepNo} ${step.name || ''}`.trim(),
      at: row.inspectedAt || row.updatedAt || '—',
      item: row.schemeName || '—',
      taskId: row.taskId || '',
      qcNo: row.qcNo || '—',
      actual: '—',
      judge: row.qcResult || row.qcStatus || '—',
    })),
  )
})

const operationLogs = computed(() =>
  (order.value?.operationLogs || []).map((row) => ({
    ...row,
    remark: row.remark || '—',
  })),
)
const outputSum = computed(() =>
  (order.value?.outputs || []).reduce((sum, row) => sum + Number(row.qty || 0), 0),
)
const outputSumText = computed(() =>
  formatQtyWithUnit(outputSum.value, order.value?.unit || itemUnit(order.value?.itemId) || ''),
)
function outputUnit(itemId) {
  return itemUnit(itemId) || order.value?.unit || ''
}

function inboundLinksOf(rows) {
  const seen = new Set()
  return rows
    .filter((row) => row.inboundOrderId && row.inboundOrderNo)
    .filter((row) => {
      if (seen.has(row.inboundOrderId)) return false
      seen.add(row.inboundOrderId)
      return true
    })
    .map((row) => ({ id: row.inboundOrderId, docNo: row.inboundOrderNo }))
}

const balanceRows = computed(() => {
  const outputs = order.value?.outputs || []
  const expected = order.value?.expectedOutputs || []
  const base = outputSum.value
  const used = new Set()
  const steps = order.value?.routeSnapshot || []
  const stepTextOf = (stepNo) => {
    if (!stepNo) return '—'
    const step = steps.find((row) => Number(row.stepNo) === Number(stepNo))
    return `${stepNo} ${step?.name || ''}`.trim()
  }
  const build = (line, matched, index) => {
    const qty = matched.reduce((sum, row) => sum + Number(row.qty || 0), 0)
    const unit = outputUnit(line?.itemId || matched[0]?.itemId)
    const planQty = Number(line?.qty)
    return {
      key: line ? `${line.role}-${line.itemId}-${index}` : matched[0]?.batchId || `out-${index}`,
      roleLabel: roleLabel[line?.role || matched[0]?.role] || line?.role || matched[0]?.role || '—',
      item: itemLabel(line?.itemId || matched[0]?.itemId) || '—',
      stepText: line?.stepNo
        ? `${line.stepNo} ${line.stepName || ''}`.trim()
        : stepTextOf(matched[0]?.stepNo),
      planQtyText: line && planQty > 0 ? formatQtyWithUnit(planQty, unit) : '—',
      qtyText: qty > 0 ? formatQtyWithUnit(qty, unit) : '—',
      ratioText: base > 0 && qty > 0 ? `${formatNumber((qty / base) * 100, 2)}%` : '—',
      batchNo: matched.length
        ? matched
            .map((row) => row.batchNo)
            .filter(Boolean)
            .join('，')
        : '—',
      inboundLinks: inboundLinksOf(matched),
    }
  }
  const rows = expected.map((line, index) => {
    const matched = []
    outputs.forEach((row, rowIndex) => {
      if (used.has(rowIndex)) return
      if (row.itemId !== line.itemId) return
      if (line.role && row.role && row.role !== line.role) return
      used.add(rowIndex)
      matched.push(row)
    })
    return build(line, matched, index)
  })
  outputs.forEach((row, index) => {
    if (used.has(index)) return
    rows.push(build(null, [row], index))
  })
  return rows
})

const ebrRows = computed(() => {
  const rows = []
  ;(order.value?.feeds || []).forEach((feed, index) => {
    const step = (order.value?.routeSnapshot || []).find((s) => s.stepNo === Number(feed.stepNo))
    rows.push({
      key: `feed-${index}`,
      stepText: `${feed.stepNo}${step?.name ? ` ${step.name}` : ''}`,
      name: `${itemLabel(feed.itemId)} 实投`,
      source: 'feed',
      value: `${feed.qty} kg（批次 ${feed.batchNo}${
        feed.contentUsed != null && feed.contentUsed !== '' ? `，含量 ${feed.contentUsed}` : ''
      }）`,
      at: feed.at || '—',
    })
  })
  ;(order.value?.paramActuals || []).forEach((row, index) => {
    rows.push({
      key: `p-${index}`,
      stepText: `${row.stepNo}`,
      name: row.key,
      source: 'param',
      value: row.value,
      at: '—',
    })
  })
  ;(order.value?.formActuals || []).forEach((row, index) => {
    rows.push({
      key: `f-${index}`,
      stepText: `${row.stepNo} ${row.stepName || ''}`.trim(),
      name: row.unit ? `${row.fieldName}（${row.unit}）` : row.fieldName,
      source: row.valueSource === 'system' ? 'system' : 'manual',
      value: row.displayValue ?? row.value,
      at: row.at || '—',
    })
  })
  ;(order.value?.ebrEntries || [])
    .filter((entry) => entry.source === 'qc')
    .forEach((entry, index) => {
      ;(entry.fields || []).forEach((field, fi) => {
        rows.push({
          key: `qc-${index}-${fi}`,
          stepText: `${entry.stepNo} ${entry.stepName || ''}`.trim(),
          name: field.name,
          source: 'qc',
          value: field.value,
          at: entry.at || '—',
        })
      })
    })
  return rows
})
function postedOutputQty(itemId, role) {
  return (order.value?.outputs || [])
    .filter((o) => o.itemId === itemId && (!role || o.role === role))
    .reduce((sum, o) => sum + Number(o.qty || 0), 0)
}

const hasPendingOutput = computed(() => {
  const expected = order.value?.expectedOutputs || []
  if (!expected.length) return !(order.value?.outputs || []).length
  return expected.some(
    (line) => Number(line.qty) > 0 && !(postedOutputQty(line.itemId, line.role) > 0),
  )
})

const outRows = computed(() =>
  (order.value?.outputs || []).map((row) => {
    const batch = getMaterialBatch(row.batchId)
    const step = (order.value?.routeSnapshot || []).find(
      (s) => Number(s.stepNo) === Number(row.stepNo),
    )
    return {
      ...row,
      roleLabel: roleLabel[row.role] || row.role,
      item: itemLabel(row.itemId),
      stepText: row.stepNo ? `${row.stepNo}${step?.name ? ` ${step.name}` : ''}`.trim() : '—',
      status: batch?.status,
    }
  }),
)

const detailTab = ref('info')
const stepOpen = ref(false)
const currentStep = ref(null)
const stepActuals = ref([])
const formValues = reactive({})
const currentParams = computed(() => stepParamRows(currentStep.value || {}))
const currentFormTemplate = computed(() => resolveStepFormTemplate(currentStep.value || {}))
const currentFormFields = computed(() =>
  (currentFormTemplate.value?.fields || []).filter(
    (field) => String(field.code || '').toUpperCase() !== 'OP_ACTUAL_FEED',
  ),
)
const formSystemCtx = computed(() => ({
  operatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  equipmentId: currentStep.value?.equipmentId || '',
  equipmentLabel: currentStep.value?.equipmentName || '',
  batchNo: order.value?.batchNo || '',
}))
const openFeed = ref(false)
const feedForm = reactive({ stepNo: undefined, extra: false })
const feedLineDrafts = ref([])
const openOutput = ref(false)
const outputForm = reactive({ stepNo: undefined, extra: false })
const outputDrafts = ref([])
const outputTank = ref('tank-b')
const deviation = ref('')
const tankOptions = computed(() =>
  listTanks().map((t) => ({ value: t.id, label: `${t.name}（罐容 ${t.capacity}）` })),
)
const outputStepOptions = computed(() =>
  (order.value?.routeSnapshot || []).map((step) => ({
    value: step.stepNo,
    label: `${step.stepNo} ${step.name || ''}`,
  })),
)

function stepHasOutputs(stepNo) {
  return (order.value?.expectedOutputs || []).some((line) => Number(line.stepNo) === Number(stepNo))
}

function buildOutputDrafts() {
  const all = order.value?.expectedOutputs || []
  const stepNo = Number(outputForm.stepNo)
  let lines = all.filter((line) => Number(line.stepNo) === stepNo)
  if (outputForm.extra) {
    const seen = new Set(lines.map((line) => `${line.role}-${line.itemId}`))
    all.forEach((line) => {
      const key = `${line.role}-${line.itemId}`
      if (seen.has(key)) return
      if (Number(line.stepNo) === stepNo) return
      lines = [...lines, line]
      seen.add(key)
    })
  }
  outputDrafts.value = lines.map((line, index) => {
    const posted = postedOutputQty(line.itemId, line.role)
    const remain = Math.max(0, Number(line.qty || 0) - posted)
    return {
      key: `${line.role}-${line.itemId}-${index}`,
      role: line.role,
      roleLabel: roleLabel[line.role] || line.role,
      itemId: line.itemId,
      item: itemLabel(line.itemId),
      qty: line.qty,
      posted,
      actual: remain > 0 ? remain : null,
    }
  })
}

function defaultOutputStepNo() {
  const steps = order.value?.routeSnapshot || []
  const withOut = steps.find((step) =>
    (order.value?.expectedOutputs || []).some(
      (line) =>
        Number(line.stepNo) === Number(step.stepNo) &&
        Number(line.qty) > 0 &&
        !(postedOutputQty(line.itemId, line.role) > 0),
    ),
  )
  return withOut?.stepNo || steps[steps.length - 1]?.stepNo || steps[0]?.stepNo
}

function openOutputFor(stepNo) {
  outputForm.stepNo = stepNo || defaultOutputStepNo()
  outputForm.extra = false
  deviation.value = order.value?.deviation || ''
  openOutput.value = true
  buildOutputDrafts()
}

watch(
  () => route.params.id,
  () => {
    detailTab.value = 'info'
  },
)

watch(
  () => [outputForm.stepNo, outputForm.extra],
  () => {
    if (!openOutput.value) return
    buildOutputDrafts()
  },
)
const feedStepOptions = computed(() =>
  (order.value?.routeSnapshot || []).map((step) => ({
    value: step.stepNo,
    label: `${step.stepNo} ${step.name || ''}`,
  })),
)
const stepFeedSummary = computed(() => {
  const stepNo = currentStep.value?.stepNo
  if (stepNo == null) return []
  const posted = order.value?.feeds || []
  const lines = (order.value?.theoreticalFeeds || []).filter(
    (line) => Number(line.stepNo) === Number(stepNo),
  )
  if (!lines.length) return []
  return lines.map((line, index) => {
    const feeds = posted.filter(
      (f) => f.itemId === line.itemId && Number(f.stepNo) === Number(stepNo),
    )
    const lastContent = feeds.length ? feeds[feeds.length - 1].contentUsed : null
    return {
      key: `sum-${line.itemId}-${index}`,
      item: itemLabel(line.itemId),
      planQty: line.qty,
      posted: feeds.reduce((s, f) => s + Number(f.qty), 0) || 0,
      contentText: lastContent == null || lastContent === '' ? '—' : lastContent,
      batches: feeds.map((f) => `${f.batchNo} ${f.qty}`).join('，') || '—',
    }
  })
})

function postedQtyForItem(itemId) {
  return (order.value?.feeds || [])
    .filter((f) => f.itemId === itemId)
    .reduce((s, f) => s + Number(f.qty || 0), 0)
}

function buildFeedLineDrafts() {
  const all = order.value?.theoreticalFeeds || []
  const stepNo = Number(feedForm.stepNo)
  let lines = all.filter((line) => Number(line.stepNo) === stepNo)
  if (feedForm.extra) {
    const seen = new Set(lines.map((line) => line.itemId))
    all.forEach((line) => {
      if (seen.has(line.itemId)) return
      if (Number(line.stepNo) === stepNo) return
      lines = [...lines, line]
      seen.add(line.itemId)
    })
  }
  if (order.value?.reworkOfBatchId) {
    const src = getMaterialBatch(order.value.reworkOfBatchId)
    if (src && !lines.some((line) => line.itemId === src.itemId)) {
      lines = [
        ...lines,
        {
          itemId: src.itemId,
          qty: order.value.qty,
          convertByContent: false,
        },
      ]
    }
  }
  feedLineDrafts.value = lines.map((line, index) => {
    const posted = postedQtyForItem(line.itemId)
    const remain = Math.max(0, Number(line.qty || 0) - posted)
    const batches = listIssueableBatches(line.itemId)
    const preferred = batches[0]
    return {
      key: `${line.itemId}-${index}`,
      itemId: line.itemId,
      item: itemLabel(line.itemId),
      planQty: line.qty,
      posted,
      convertByContent: Boolean(line.convertByContent),
      batchId: preferred?.id,
      qty: remain > 0 ? remain : null,
      content: preferred?.content ?? null,
    }
  })
}

function batchOptionsForItem(itemId) {
  return listIssueableBatches(itemId).map((batch) => ({
    value: batch.id,
    label: `${batch.batchNo} 剩余 ${batch.qty} 含量 ${batch.content ?? '—'} 效期 ${batch.expiryDate || '—'}`,
  }))
}

function onFeedBatchChange(record, batchId) {
  const batch = getMaterialBatch(batchId)
  record.content = batch?.content ?? null
}

function batchNo(id) {
  return getMaterialBatch(id)?.batchNo || '—'
}

function release() {
  try {
    releaseOrder(order.value.id)
    message.success('已下发')
  } catch (error) {
    message.error(error.message)
  }
}

function cancelOrder() {
  Modal.confirm({
    title: '作废批次指令',
    content: '作废后不可再下发或投料。确认作废？',
    okText: '作废',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      try {
        cancelBatchOrder(order.value.id)
        message.success('已作废')
      } catch (error) {
        message.error(error.message)
      }
    },
  })
}

function paramLabel(field) {
  return field.unit ? `${field.name}（${field.unit}）` : field.name || '参数'
}

watch(
  () => [feedForm.stepNo, feedForm.extra],
  () => {
    if (!openFeed.value) return
    buildFeedLineDrafts()
  },
)

function defaultFeedStepNo() {
  const steps = order.value?.routeSnapshot || []
  const withFeed = steps.find((step) =>
    (order.value?.theoreticalFeeds || []).some(
      (line) => Number(line.stepNo) === Number(step.stepNo),
    ),
  )
  if (withFeed && !order.value?.confirmedSteps?.includes(withFeed.stepNo)) return withFeed.stepNo
  const pending = steps.find((step) => !order.value?.confirmedSteps?.includes(step.stepNo))
  return pending?.stepNo || steps[0]?.stepNo
}

function openFeedFor(stepNo) {
  feedForm.stepNo = stepNo || defaultFeedStepNo()
  feedForm.extra = false
  openFeed.value = true
  buildFeedLineDrafts()
}

function refreshStepQcLink(batchOrder, stepNo) {
  const link = getStepQcLink(batchOrder, stepNo)
  if (!link?.taskId) return link
  const task = getQcTaskById(link.taskId)
  if (!task) return link
  return {
    ...link,
    qcNo: task.qcNo || link.qcNo,
    qcStatus: task.qcStatus || link.qcStatus,
    qcResult: task.qcResult || link.qcResult,
    inspectedAt: task.inspectedAt || link.inspectedAt,
  }
}

function stepHasFeeds(stepNo) {
  return (order.value?.theoreticalFeeds || []).some(
    (line) => Number(line.stepNo) === Number(stepNo),
  )
}

function stepAssaySchemes(step) {
  return resolveAssaySchemesForStep(step, step?.processId ? getProcessById(step.processId) : null)
}

function stepAssayRecords(step) {
  return (step.assayRecords || getStepQcRecords(order.value, step.stepNo) || []).map((row) => {
    const task = row.taskId ? getQcTaskById(row.taskId) : null
    return {
      ...row,
      qcNo: task?.qcNo || row.qcNo,
      qcStatus: task?.qcStatus || row.qcStatus,
      qcResult: task?.qcResult || row.qcResult,
    }
  })
}

const assayOpen = ref(false)
const assayStep = ref(null)
const assaySchemeId = ref(undefined)
const assaySchemeOptions = computed(() =>
  stepAssaySchemes(assayStep.value || {}).map((s) => ({
    value: s.id,
    label: `${s.name || s.assayType}（${qcBizScopeLabel(s.bizScope)}${
      s.gateMode === 'hard' || s.hardGate ? ' · 硬门禁' : ' · 记录'
    }）`,
  })),
)
const assayHistoryRows = computed(() =>
  stepAssayRecords(assayStep.value || {}).map((row) => ({
    ...row,
    statusText: row.qcResult || row.qcStatus || '—',
  })),
)

function priorAssayHint(stepNo) {
  return buildPriorInProcessAssayHint({
    order: order.value,
    currentStepNo: stepNo,
    getQcTaskById,
    getStepQcRecords,
  })
}

const priorAssayHintForStep = computed(() =>
  stepOpen.value ? priorAssayHint(currentStep.value?.stepNo) : null,
)
const priorAssayHintForFeed = computed(() =>
  openFeed.value ? priorAssayHint(feedForm.stepNo) : null,
)
const priorAssayHintForAssay = computed(() =>
  assayOpen.value ? priorAssayHint(assayStep.value?.stepNo) : null,
)

function openAssay(step) {
  assayStep.value = step
  const schemes = stepAssaySchemes(step)
  assaySchemeId.value = schemes[0]?.id
  assayOpen.value = true
}

function submitAssay() {
  try {
    const result = createProcessQcFromBatchStep({
      orderId: order.value.id,
      stepNo: assayStep.value.stepNo,
      schemeId: assaySchemeId.value,
    })
    if (!result.ok) {
      message.error(result.message || '发起化验失败')
      return
    }
    assayOpen.value = false
    if (result.created) {
      message.success(`已发起化验 ${result.task.qcNo}`)
    } else {
      message.info(`已有待检单 ${result.task.qcNo}，打开查看`)
    }
    goQcTask(result.task.id)
  } catch (error) {
    message.error(error.message || '发起化验失败')
  }
}

function goInbound(link) {
  if (!link?.id) return
  const path = `/inventory/inbound/${link.id}`
  openTab(path, link.docNo ? `入库单 ${link.docNo}` : '入库单详情')
  router.push(path)
}

function goQcTask(taskId) {
  if (!taskId) return
  const task = getQcTaskById(taskId)
  const scope = task?.bizScope || '生产过程检'
  if (scope === '成品检') {
    router.push(`/quality/finished-qc/${taskId}`)
    return
  }
  router.push(`/quality/process-qc/${taskId}`)
}

function openStep(step) {
  currentStep.value = step
  stepActuals.value = stepParamRows(step).map((param) =>
    param.target == null ? null : param.target,
  )
  Object.keys(formValues).forEach((key) => delete formValues[key])
  const tpl = resolveStepFormTemplate(step)
  const ctx = {
    equipmentId: step.equipmentId || '',
    equipmentLabel: step.equipmentName || '',
    batchNo: order.value?.batchNo || '',
  }
  ;(tpl?.fields || []).forEach((field) => {
    if (isProcessFormSystemField(field)) {
      formValues[field.code] = resolveProcessFormSystemValue(field.systemKey, ctx)
      return
    }
    formValues[field.code] =
      field.defaultValue !== undefined && field.defaultValue !== ''
        ? field.defaultValue
        : field.type === 'checkbox'
          ? []
          : field.type === 'number'
            ? null
            : ''
  })
  stepOpen.value = true
}

function saveStep() {
  try {
    confirmStep(order.value.id, currentStep.value.stepNo, stepActuals.value, { ...formValues })
    stepOpen.value = false
    message.success('本步已确认，已写入批记录')
  } catch (error) {
    message.error(error.message)
  }
}

function saveFeed() {
  try {
    const lines = (feedLineDrafts.value || [])
      .filter((row) => row.batchId && Number(row.qty) > 0)
      .map((row) => ({
        batchId: row.batchId,
        qty: row.qty,
        stepNo: feedForm.stepNo,
        contentUsed: row.content,
      }))
    postFeeds(order.value.id, lines)
    openFeed.value = false
    message.success('投料已记账，原料批次重量和罐液位已扣减')
  } catch (error) {
    message.error(error.message)
  }
}

function saveOutput() {
  try {
    postOutput(order.value.id, {
      locationId: outputTank.value,
      deviation: deviation.value,
      stepNo: outputForm.stepNo,
      rows: (outputDrafts.value || [])
        .filter((row) => Number(row.actual) > 0)
        .map((row) => ({
          role: row.role,
          itemId: row.itemId,
          qty: row.actual,
        })),
    })
    openOutput.value = false
    message.success('产出已入库，得率差已计算。产出批次待成品放行后才能发货')
  } catch (error) {
    message.error(error.message)
  }
}

function finish() {
  const errors = completionErrors(order.value)
  if (errors.length) {
    message.error(errors.join('；'))
    return
  }
  completeOrder(order.value.id)
  message.success('批次指令已完成')
}

function releaseOut(batchId) {
  try {
    releaseOutputBatch(batchId)
    message.success('产出批次已放行')
  } catch (error) {
    message.error(error.message)
  }
}

function rework(record) {
  try {
    const created = createRework({ sourceBatchId: record.batchId, qty: record.qty })
    message.success(`已生成返工指令 ${created.batchNo}，投料时扣原批次`)
  } catch (error) {
    message.error(error.message)
  }
}
</script>

<style scoped lang="less">
@import '@/styles/process-batch-page.less';
.hint {
  color: #4e5969;
  font-size: 13px;
}

.meta-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #e8e8e8;
}

.meta-bar i {
  margin-right: 6px;
  font-style: normal;
  font-size: 13px;
  color: rgba(78, 89, 105, 0.55);
}

.meta-bar b {
  font-weight: 400;
  font-size: 14px;
  color: #1f2329;
}

.batch-detail-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.batch-detail-tabs {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  margin: 0;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.batch-detail-tabs :deep(.ant-tabs) {
  width: 100%;
}

.batch-detail-tabs :deep(.ant-tabs-nav) {
  margin: 0 !important;
}

.batch-tab-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.batch-tab-pane :deep(.detail-section-card) {
  margin-bottom: 0;
}

.formula-kv {
  column-gap: 20px;
  row-gap: 10px;
}

.formula-kv > div {
  font-size: 14px;
  line-height: 22px;
}

.doc-link {
  margin-right: 8px;
  color: #307068;
  cursor: pointer;
}

.plan-metric-bar {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  margin: 0;
  padding: 12px 4px;
  background: #e7f3f1;
  border: 1px solid #c5e4de;
  border-radius: 8px;
}

.plan-metric-item {
  flex: 1;
  min-width: 0;
  padding: 0 16px;
  border-right: 1px solid #d3e8e3;

  &:last-child {
    border-right: none;
  }
}

.plan-metric-label {
  margin-bottom: 6px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1.4;
}

.plan-metric-value {
  color: rgba(0, 0, 0, 0.88);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-all;

  &.accent {
    color: #307068;
  }
}

.step-report-card {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.section-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: #86909c;
}

.tpl-name {
  font-weight: 400;
  color: #4e5969;
  font-size: 13px;
}

.muted {
  color: #86909c;
  font-size: 13px;
}

.qc-line {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.prior-assay-hint {
  margin-bottom: 12px;
}
</style>
