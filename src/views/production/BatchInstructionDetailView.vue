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
      <a-button v-if="order.status === 'pending_release'" @click="editOpen = true">编辑</a-button>
      <a-button v-if="order.status === 'pending_release'" danger @click="removePending"
        >删除</a-button
      >
      <a-button v-if="order.status === 'pending_release'" @click="confirmOpen = true"
        >指定下发</a-button
      >
      <a-button v-if="order.status === 'pending_release'" type="primary" @click="release"
        >下发</a-button
      >
      <a-button
        v-if="order.status === 'pending_release' || order.status === 'running'"
        @click="goRequisition"
        >领料</a-button
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
            <div class="formula-kv-full">
              <span class="k">备注：</span><span class="v">{{ order.remark || '—' }}</span>
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
              <template v-else-if="column.key === 'summary'">
                <a-popover
                  v-if="stepSummaryLines(record.stepNo).length"
                  placement="bottomLeft"
                  trigger="click"
                  overlay-class-name="step-rich-popover"
                >
                  <template #content>
                    <div class="step-rich-list">
                      <div
                        v-for="(line, idx) in stepSummaryLines(record.stepNo)"
                        :key="`sum-${record.stepNo}-${idx}`"
                        class="step-rich-item"
                      >
                        <span class="step-rich-label">{{ line.label }}</span>
                        <span class="step-rich-value">{{ line.value }}</span>
                      </div>
                    </div>
                  </template>
                  <button type="button" class="step-rich-trigger">
                    <span class="step-rich-main">{{ stepSummaryPreview(record.stepNo) }}</span>
                    <span class="step-rich-more">详情</span>
                  </button>
                </a-popover>
                <span v-else class="muted">{{ record.summaryText }}</span>
              </template>
              <template v-else-if="column.key === 'output'">
                <a-popover
                  v-if="stepOutputLines(record.stepNo).length"
                  placement="bottomLeft"
                  trigger="click"
                  overlay-class-name="step-rich-popover"
                >
                  <template #content>
                    <div class="step-rich-list">
                      <div
                        v-for="(line, idx) in stepOutputLines(record.stepNo)"
                        :key="`out-${record.stepNo}-${idx}`"
                        class="step-rich-item"
                      >
                        <a-tag v-if="line.role" size="small" color="blue">{{ line.role }}</a-tag>
                        <span class="step-rich-value">
                          {{ line.name }} · {{ line.qty
                          }}<template v-if="line.disposition"> · {{ line.disposition }}</template>
                        </span>
                      </div>
                    </div>
                  </template>
                  <button type="button" class="step-rich-trigger">
                    <span class="step-rich-main">{{ stepOutputPreview(record.stepNo) }}</span>
                    <span class="step-rich-more">详情</span>
                  </button>
                </a-popover>
                <span v-else class="muted">—</span>
              </template>
              <template v-else-if="column.key === 'qc'">
                <template v-if="stepAssaySummaryLines(record).length">
                  <div v-for="row in stepAssaySummaryLines(record)" :key="row.key" class="qc-line">
                    <span class="qc-scheme-name">{{ row.typeLabel }}</span>
                    <a v-if="row.taskId" class="qc-link" @click="goQcTask(row.taskId)">
                      <a-tag :color="row.statusColor" size="small">{{ row.statusLabel }}</a-tag>
                      <span v-if="row.qcNo" class="qc-no-inline">{{ row.qcNo }}</span>
                    </a>
                    <a-tag v-else :color="row.statusColor" size="small">{{
                      row.statusLabel
                    }}</a-tag>
                    <a-tag v-if="row.hardGate" color="warning" size="small">硬</a-tag>
                  </div>
                </template>
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
                    v-if="stepProcessAssaySchemes(record).length"
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
          <div v-if="feedRows.length" class="feed-groups">
            <div v-for="row in feedRows" :key="row.key" class="feed-group">
              <div class="feed-group-head">
                <div class="feed-formula">
                  <span><i>原料：</i>{{ row.item }}</span>
                  <span><i>编号：</i>{{ row.itemCode }}</span>
                  <span><i>规格：</i>{{ row.specText }}</span>
                  <span><i>阶段：</i>{{ row.stepText }}</span>
                  <span><i>理论投料：</i>{{ row.planQtyText }}</span>
                  <span><i>允差：</i>{{ row.toleranceText }}</span>
                  <span><i>关键物料：</i>{{ row.keyText }}</span>
                  <span><i>辅料：</i>{{ row.auxText }}</span>
                </div>
                <div class="feed-summary">
                  <span
                    ><i>实投</i><b>{{ row.postedText }}</b></span
                  >
                  <span
                    ><i>补料次数</i><b>{{ row.supplementText }}</b></span
                  >
                  <span
                    ><i>偏差</i><b>{{ row.gapText }}</b></span
                  >
                </div>
              </div>
              <a-table
                v-if="row.postings.length"
                class="feed-posting-table"
                :columns="feedPostingColumns"
                :data-source="row.postings"
                :pagination="false"
                size="small"
                row-key="key"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'content'">
                    <span>{{ record.contentText }}</span>
                    <a-button
                      v-if="record.contentPending && order.status === 'running'"
                      type="link"
                      size="small"
                      @click="openFeedContentPatch(record)"
                    >
                      补录含量
                    </a-button>
                  </template>
                </template>
              </a-table>
              <div v-else class="feed-empty">还没有过账</div>
            </div>
          </div>
          <a-empty v-else description="配方未维护投料" />
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
            :row-key="outputRowKey"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag>{{ BATCH_STATUS_LABEL[record.status] || '—' }}</a-tag>
              </template>
              <template v-else-if="column.key === 'inspectConclusion'">
                <a-tag
                  v-if="record.inspectConclusion && record.inspectConclusion !== '—'"
                  :color="inspectConclusionColor(record.inspectConclusion)"
                  >{{ record.inspectConclusion }}</a-tag
                >
                <span v-else>—</span>
              </template>
              <template v-else-if="column.key === 'qcLinks'">
                <template v-if="record.qcLinks?.length">
                  <a-button
                    v-for="link in record.qcLinks"
                    :key="link.taskId || link.qcNo"
                    type="link"
                    size="small"
                    @click="goQcTask(link.taskId)"
                  >
                    {{ link.qcNo }}
                  </a-button>
                </template>
                <span v-else>—</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button
                  v-if="record.status === 'await_decide'"
                  type="link"
                  size="small"
                  @click="openDecideDisposition(record)"
                  >确认去向</a-button
                >
                <a-button
                  v-else-if="record.status === 'pending'"
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
                <a-button
                  v-else-if="record.status === 'await_reextract' && Number(record.remainQty) > 0"
                  type="link"
                  size="small"
                  @click="openReextract(record)"
                  >开再提指令</a-button
                >
                <span v-else-if="record.status === 'await_reuse'">投料时选「回流料」</span>
                <span v-else>—</span>
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
      :ok-button-props="{ disabled: stepConfirmHardGateBlocked }"
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
      <a-alert
        v-if="stepConfirmHardGateBlocked"
        class="prior-assay-hint"
        type="warning"
        show-icon
        message="硬门禁化验未完成或未通过，确认已禁用。请先在「化验」清单完成必做项。"
      />
      <div v-if="stepConfirmAssayChecklist.length" class="modal-basic-card step-report-card">
        <div class="section-title">本步化验清单</div>
        <p class="section-hint">
          硬门禁项须合格后才能确认本步；「记录」项可后补，不挡确认。产出检请在「产出」过账时发起。
        </p>
        <a-table
          :columns="assayChecklistColumns"
          :data-source="stepConfirmAssayChecklist"
          :pagination="false"
          size="small"
          row-key="schemeId"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'gate'">
              <a-tag :color="record.hardGate ? 'warning' : 'default'">{{ record.gateLabel }}</a-tag>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.statusColor">{{ record.statusLabel }}</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button
                v-if="record.taskId"
                type="link"
                size="small"
                @click="goQcTask(record.taskId)"
                >查看</a-button
              >
              <a-button
                v-if="order.status === 'running' && record.canStart"
                type="link"
                size="small"
                @click="startAssayFromChecklist(record, currentStep)"
                >发起</a-button
              >
              <span v-else-if="!record.taskId">—</span>
            </template>
          </template>
        </a-table>
      </div>
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
        <div class="section-title">通用记录</div>
        <p class="section-hint">
          操作人、操作时间默认带出当前登录人与打开时间，可改（事后补录）；出料量、备注选填。本格设备、批指令号只读。
        </p>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="12">
              <a-form-item label="操作人" required>
                <a-input
                  v-model:value="formValues.OP_OPERATOR"
                  size="small"
                  placeholder="可改，便于补录"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="操作时间" required>
                <a-date-picker
                  v-model:value="stepOperatedAtPicker"
                  show-time
                  size="small"
                  style="width: 100%"
                  format="YYYY-MM-DD HH:mm:ss"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  placeholder="可改，便于补录"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="本格设备">
                <a-input :value="stepFixedSystem.equipment" size="small" disabled />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="批指令号">
                <a-input :value="stepFixedSystem.batchNo" size="small" disabled />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="出料量">
                <a-input-number
                  v-model:value="formValues.OP_OUTPUT_QTY"
                  size="small"
                  :min="0"
                  style="width: 100%"
                  placeholder="本步主流转出量，选填"
                  addon-after="kg"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="操作备注" class="remark-item">
                <a-textarea
                  v-model:value="formValues.OP_REMARK"
                  size="small"
                  :rows="2"
                  placeholder="选填"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <div v-if="currentFormFields.length" class="modal-basic-card step-report-card">
        <div class="section-title">
          过程记录
          <span v-if="currentFormTemplate?.templateName" class="tpl-name"
            >（{{ currentFormTemplate.templateName }}）</span
          >
        </div>
        <p class="section-hint">本工序模板上的额外采集项；与上方通用项不重复。</p>
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
      :title="feedModalTitle"
      width="min(1320px, 94vw)"
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
            <a-col v-if="!isReextractOrder" :span="12">
              <a-form-item label="投料来源" required>
                <a-radio-group
                  v-model:value="feedForm.feedSource"
                  size="small"
                  option-type="button"
                  :options="feedSourceOptions"
                  @change="onFeedSourceChange"
                />
              </a-form-item>
            </a-col>
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
        <p class="section-hint">{{ feedSourceHint }}</p>
      </div>

      <div class="feed-lines-title">投料明细</div>
      <a-table
        :columns="feedDraftColumns"
        :data-source="feedLineDrafts"
        :pagination="false"
        size="small"
        bordered
        row-key="key"
        :scroll="{ x: 1480, y: 360 }"
        :locale="{ emptyText: '本阶段没有计划投料，可勾选补加或换阶段' }"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">{{ index + 1 }}</template>
          <template v-else-if="column.key === 'feedLocation'">
            <a-select
              v-if="needsFeedSourceLocation(record)"
              v-model:value="record.locationId"
              size="small"
              allow-clear
              show-search
              option-filter-prop="label"
              style="width: 100%"
              :options="feedLocationOptionsForItem(record.itemId)"
              :placeholder="
                useFeedFifoOnlyMode ? '必选：从哪个储罐/库位扣' : '未选批时必选：从哪个储罐/库位扣'
              "
            />
            <span v-else class="muted">{{ feedLocationFollowText(record) }}</span>
          </template>
          <template v-else-if="column.key === 'batchId'">
            <a-select
              v-model:value="record.batchId"
              size="small"
              allow-clear
              show-search
              option-filter-prop="label"
              style="width: 100%"
              :options="batchOptionsForItem(record.itemId)"
              :placeholder="feedBatchPlaceholder"
              @change="(val) => onFeedBatchChange(record, val)"
            >
              <template #dropdownRender="{ menuNode: menu }">
                <div>
                  <component :is="menu" />
                  <a-divider style="margin: 4px 0" />
                  <div
                    class="search-more-row"
                    @mousedown.prevent
                    @click="openFeedBatchPicker(record)"
                  >
                    搜索更多
                  </div>
                </div>
              </template>
            </a-select>
          </template>
          <template v-else-if="column.key === 'qty'">
            <a-input-number
              v-model:value="record.qty"
              size="small"
              :min="0"
              :step="0.001"
              :formatter="inputNumberFormatter"
              :parser="inputNumberParser"
              style="width: 100%"
              :addon-after="record.unit || 'kg'"
              placeholder="实投"
            />
          </template>
          <template v-else-if="column.key === 'content'">
            <a-input-number
              v-model:value="record.contentPct"
              size="small"
              :min="0"
              :max="100"
              :step="0.01"
              :formatter="inputNumberFormatter"
              :parser="inputNumberParser"
              style="width: 100%"
              addon-after="%"
              :placeholder="feedContentPlaceholder(record)"
            />
          </template>
          <template v-else-if="column.key === 'qcNo'">
            <a-button
              v-if="record.qcTaskId || (record.qcNo && record.qcNo !== '—')"
              type="link"
              size="small"
              @click="openFeedBatchQc(record)"
            >
              {{ record.qcNo || '查看检单' }}
            </a-button>
            <span v-else>—</span>
          </template>
          <template v-else-if="column.key === 'qcResult'">
            <a
              v-if="record.qcTaskId || (record.qcNo && record.qcNo !== '—')"
              class="qc-link"
              @click="openFeedBatchQc(record)"
            >
              <a-tag
                v-if="record.qcResult && record.qcResult !== '—'"
                :color="inspectConclusionColor(record.qcResult)"
              >
                {{ record.qcResult }}
              </a-tag>
              <span v-else>查看化验单</span>
            </a>
            <a-tag
              v-else-if="record.qcResult && record.qcResult !== '—'"
              :color="inspectConclusionColor(record.qcResult)"
            >
              {{ record.qcResult }}
            </a-tag>
            <span v-else>—</span>
          </template>
        </template>
      </a-table>
    </a-modal>

    <SelectMaterialBatchModal
      v-model:open="feedBatchPickerOpen"
      :item-id="feedBatchPickerRow?.itemId || ''"
      :unit-label="feedBatchPickerRow?.unit || 'kg'"
      :order="order"
      :feed-source="feedForm.feedSource"
      :selected-ids="feedBatchPickerSelectedIds"
      @selected="onFeedBatchesPicked"
    />

    <a-modal
      :open="assayOpen"
      :title="`化验清单 · ${assayStep?.name || ''}`"
      :width="assayModalWidth"
      wrap-class-name="batch-assay-modal-wrap"
      class="batch-assay-modal"
      :mask-closable="false"
      destroy-on-close
      :footer="null"
      @cancel="assayOpen = false"
    >
      <a-alert
        v-if="priorAssayHintForAssay"
        class="prior-assay-hint"
        type="info"
        show-icon
        :message="priorAssayHintForAssay.text"
      />
      <div class="modal-basic-card step-report-card">
        <div class="section-title">本步必做 / 可做化验</div>
        <p class="section-hint">
          下列为过程检清单（投料前核对、中控取样、转序放行）。硬门禁未合格不能确认本步；记录项可多次取样。产出检请在本步「产出」过账时按产出行勾选并发起。
        </p>
        <a-table
          :columns="assayChecklistColumns"
          :data-source="assayChecklistRows"
          :pagination="false"
          size="small"
          :locale="{ emptyText: '本步未配置过程检方案' }"
          row-key="schemeId"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'gate'">
              <a-tag :color="record.hardGate ? 'warning' : 'default'">{{ record.gateLabel }}</a-tag>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.statusColor">{{ record.statusLabel }}</a-tag>
              <a-button
                v-if="record.taskId"
                type="link"
                size="small"
                @click="openAssayQcPreview(record.taskId)"
              >
                {{ record.qcNo || '检单' }}
              </a-button>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button
                v-if="record.canStart"
                type="link"
                size="small"
                :loading="assayStartingId === record.schemeId"
                @click="startAssayFromChecklist(record, assayStep)"
              >
                {{ record.doneOnce ? '再次发起' : '发起' }}
              </a-button>
              <span v-else-if="record.hasPending" class="muted">已发起</span>
              <span v-else-if="record.doneOnce && !record.allowMultiple" class="muted">已完成</span>
              <span v-else>—</span>
            </template>
          </template>
        </a-table>
        <a-alert
          v-if="assayFinishedHint"
          style="margin-top: 12px"
          type="info"
          show-icon
          :message="assayFinishedHint"
        />
      </div>
      <div class="assay-modal-footer">
        <a-button @click="assayOpen = false">关闭</a-button>
      </div>
    </a-modal>

    <QcTaskDetailDrawer v-model:open="assayQcDrawerOpen" :task="assayQcPreviewTask" />

    <a-modal
      :open="openOutput"
      title="产出入库"
      :width="1320"
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
        <p class="section-hint">
          联副产品可先选「待判定」落暂存位并化验，出结果后再定回用/再提/入库/废弃。配方已配置产出检的行强制勾选且不可改；未配置的可选手勾。同一物料同阶段多次过账默认共用一张产出化验单；若需复检可勾「强制新建」。过程检请在「化验」清单发起。
        </p>
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
          <template v-if="column.key === 'disposition'">
            <a-select
              v-model:value="record.disposition"
              size="small"
              style="width: 100%"
              :options="outputDispositionOptionsFor(record.role)"
              placeholder="请选择"
              @change="onOutputDispositionChange(record)"
            />
          </template>
          <template v-else-if="column.key === 'location'">
            <a-select
              v-if="createsOutputBatchDisposition(record.disposition)"
              v-model:value="record.locationId"
              size="small"
              allow-clear
              show-search
              option-filter-prop="label"
              style="width: 100%"
              :options="locationOptionsFor(record.disposition)"
              :placeholder="locationPlaceholder(record.disposition)"
            />
            <span v-else>—</span>
          </template>
          <template v-else-if="column.key === 'actual'">
            <a-input-number
              v-model:value="record.actual"
              size="small"
              :min="0"
              :step="0.001"
              :formatter="inputNumberFormatter"
              :parser="inputNumberParser"
              :addon-after="record.unit || undefined"
              style="width: 100%"
            />
          </template>
          <template v-else-if="column.key === 'inboundQc'">
            <div class="output-assay-cell">
              <a-checkbox
                :checked="(record.assayScopes || []).includes('成品检')"
                :disabled="record.assayLocked"
                @change="(e) => onOutputAssayCheck(record, e?.target?.checked)"
              >
                产出化验
              </a-checkbox>
              <a-checkbox
                v-if="
                  (record.assayScopes || []).includes('成品检') && hasExistingOutputAssay(record)
                "
                v-model:checked="record.forceNewAssay"
              >
                强制新建
              </a-checkbox>
            </div>
          </template>
        </template>
      </a-table>
      <div class="output-qc-list-block">
        <div class="section-title">关联产出化验单</div>
        <a-table
          :columns="outputRelatedQcColumns"
          :data-source="outputRelatedQcRows"
          :pagination="false"
          size="small"
          row-key="key"
          :locale="{ emptyText: '本阶段暂无关联产出化验单；勾选产出化验并确认后生成' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="record.statusColor" size="small">{{ record.statusLabel }}</a-tag>
            </template>
            <template v-else-if="column.key === 'qcNo'">
              <a-button
                v-if="record.taskId"
                type="link"
                size="small"
                @click="goQcTask(record.taskId)"
              >
                {{ record.qcNo || '查看' }}
              </a-button>
              <span v-else>—</span>
            </template>
          </template>
        </a-table>
      </div>
    </a-modal>
    <a-modal
      :open="decideOpen"
      title="确认产出去向"
      :width="520"
      :mask-closable="false"
      destroy-on-close
      :confirm-loading="decideSaving"
      @cancel="closeDecideDisposition"
      @ok="saveDecideDisposition"
    >
      <div class="modal-basic-card">
        <div class="section-title">基本信息</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="24">
              <a-form-item label="产出">
                <span>{{ decideForm.itemLabel || '—' }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="批次号">
                <span>{{ decideForm.batchNo || '—' }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="检验结论">
                <a-tag
                  v-if="decideForm.inspectConclusion && decideForm.inspectConclusion !== '—'"
                  :color="inspectConclusionColor(decideForm.inspectConclusion)"
                  >{{ decideForm.inspectConclusion }}</a-tag
                >
                <span v-else>—</span>
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="最终去向" required>
                <a-select
                  v-model:value="decideForm.disposition"
                  size="small"
                  style="width: 100%"
                  :options="finalDispositionOptions"
                  placeholder="回用 / 再提 / 入库 / 废弃"
                  @change="onDecideDispositionChange"
                />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="去向位置" required>
                <a-select
                  v-model:value="decideForm.locationId"
                  size="small"
                  allow-clear
                  show-search
                  option-filter-prop="label"
                  style="width: 100%"
                  :options="locationOptionsFor(decideForm.disposition)"
                  :placeholder="locationPlaceholder(decideForm.disposition)"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <p class="section-hint">
          待判定在化验出结果后再定去向。选回用或再提时，若已勾选化验则按硬门禁校验。
        </p>
      </div>
    </a-modal>
    <a-modal
      :open="feedContentPatchOpen"
      title="补录投料含量"
      :width="400"
      :mask-closable="false"
      destroy-on-close
      ok-text="保存"
      :confirm-loading="feedContentPatchSaving"
      @cancel="closeFeedContentPatch"
      @ok="saveFeedContentPatch"
    >
      <div class="modal-basic-card">
        <div class="section-title">基本信息</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="24">
              <a-form-item label="批次">
                <span>{{ feedContentPatch.batchNo || '—' }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="含量" required>
                <a-input-number
                  v-model:value="feedContentPatch.contentPct"
                  size="small"
                  :min="0"
                  :max="100"
                  :step="0.01"
                  :formatter="inputNumberFormatter"
                  :parser="inputNumberParser"
                  style="width: 100%"
                  addon-after="%"
                  placeholder="请输入含量"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <p class="section-hint">可手填；也可等过程检带含量字段完成后再自动回填。两种方式不互斥。</p>
      </div>
    </a-modal>
    <ConfirmReleaseBatchModal v-model:open="confirmOpen" :order-id="order.id" />
    <PendingBatchEditModal v-model:open="editOpen" :order-id="order.id" />
  </FormCreateShell>
  <a-empty v-else description="未找到批次指令" />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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
  OUTPUT_DISPOSITION_LABEL,
  OUTPUT_DISPOSITION_OPTIONS,
  createsOutputBatchDisposition,
  isStockOutputDisposition,
  locationKindForDisposition,
  normalizeOutputAssayScopes,
  normalizeOutputDisposition,
  stepParamRows,
} from '@/store/processFormulaStore'
import {
  formatNumber,
  formatQtyWithUnit,
  inputNumberFormatter,
  inputNumberParser,
  roundNumber,
} from '@/utils/numberFormat'
import { displayInspectConclusion, inspectConclusionColor } from '@/utils/inspectConclusion'
import { resolveBatchInspectInfo } from '@/utils/resolveBatchInspect'
import QcTaskDetailDrawer from '@/views/quality/components/QcTaskDetailDrawer.vue'
import { round3 } from '@/utils/processBatchMath'
import {
  ORDER_STATUS_LABEL,
  cancelBatchOrder,
  completeOrder,
  confirmOutputDisposition,
  deletePendingOrder,
  completionErrors,
  confirmStep,
  createReextract,
  createRework,
  getBatchOrder,
  getStepQcLink,
  getStepQcRecords,
  backfillFeedContentFromAssay,
  postFeeds,
  postOutput,
  releaseOrder,
  releaseOutputBatch,
} from '@/store/batchInstructionStore'
import { getProcessById, resolveDefaultExecutors } from '@/store/processConfigStore'
import {
  formatProcessGate,
  normalizeProcessGate,
  PROCESS_GATE_HARD,
} from '@/mock/processConfigSeed'
import {
  createOutputInboundQc,
  createProcessQcFromBatchStep,
  getQcTaskById,
  listQcTasks,
  QC_TASK_RESULT,
  QC_TASK_STATUS,
} from '@/store/qcTaskStore'
import { qcBizScopeLabel } from '@/constants/qcBizScopeLabel'
import { formatProductionLineLabel } from '@/store/productionLineStore'
import ConfirmReleaseBatchModal from '@/views/production/components/ConfirmReleaseBatchModal.vue'
import PendingBatchEditModal from '@/views/production/components/PendingBatchEditModal.vue'
import {
  assayTypeLabel,
  buildPriorInProcessAssayHint,
  isAssaySchemeHardGate,
  isFinishedAssayScheme,
  isProcessAssayScheme,
  resolveAssaySchemesForStep,
} from '@/utils/qcProcessConfig'
import {
  BATCH_STATUS_LABEL,
  getMaterialBatch,
  listFeedableBatches,
  listFeedSourceLocations,
  listMaterialBatches,
  listTanks,
  planFeedFifoAllocations,
} from '@/store/materialBatchStore'
import {
  PROCESS_FEED_DEDUCT_MODES,
  getProcessFeedDeductMode,
  functionParamState,
} from '@/store/functionParamStore'
import { resolveStepFormTemplate } from '@/utils/processFormTemplateSnapshot'
import {
  isProcessFormSystemField,
  resolveProcessFormSystemValue,
} from '@/utils/processFormSystemField'
import { PROCESS_FORM_SYSTEM_KEYS } from '@/mock/qcFieldLibrary'
import ProcessStepReportFields from '@/views/production/components/ProcessStepReportFields.vue'
import SelectMaterialBatchModal from '@/views/production/components/SelectMaterialBatchModal.vue'
import { filterTemplateFieldsBeyondFixed } from '@/utils/stepConfirmFixedFields'
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
  { title: '设备', dataIndex: 'equipmentText', width: 160 },
  { title: '岗位', dataIndex: 'positionText', width: 140 },
  { title: '配方要求', dataIndex: 'limitText', width: 200 },
  { title: '转序条件', dataIndex: 'transitionText', width: 160 },
  { title: '门禁判定', key: 'done', width: 100 },
  { title: '化验', key: 'qc', width: 240 },
  { title: '实绩摘要', key: 'summary', width: 200 },
  { title: '产出', key: 'output', width: 200 },
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
const feedPostingColumns = [
  { title: '时间', dataIndex: 'at', width: 170 },
  { title: '执行人', dataIndex: 'operator', width: 120 },
  { title: '原料批次', dataIndex: 'batchNo', width: 160 },
  { title: '本次实投', dataIndex: 'qtyText', align: 'right', width: 120 },
  { title: '含量', key: 'content', width: 160 },
]
const feedDraftColumns = computed(() => {
  const cols = [
    { title: '序号', key: 'index', width: 56, align: 'center', fixed: 'left' },
    { title: '原料', dataIndex: 'item', width: 120, ellipsis: true, fixed: 'left' },
    { title: '编号', dataIndex: 'itemCode', width: 110, ellipsis: true },
    { title: '规格', dataIndex: 'specText', width: 100, ellipsis: true },
    { title: '理论量', dataIndex: 'planQtyText', width: 110, align: 'right' },
    { title: '已投', dataIndex: 'postedText', width: 100, align: 'right' },
  ]
  // 两者皆可：先批后罐——有批则罐随批；未选批才强调选罐/库位
  if (!useFeedFifoOnlyMode.value) {
    cols.push({
      title: useFeedEitherMode.value ? '原料批次（可选）' : '原料批次',
      key: 'batchId',
      width: 280,
    })
  }
  if (useFeedFifoOnlyMode.value || useFeedEitherMode.value) {
    cols.push({
      title: useFeedFifoOnlyMode.value ? '来源储罐/库位' : '来源储罐/库位（未选批时）',
      key: 'feedLocation',
      width: 220,
    })
  }
  cols.push(
    { title: '实投量', key: 'qty', width: 140 },
    { title: '含量 (%)', key: 'content', width: 160 },
  )
  if (!useFeedFifoOnlyMode.value) {
    cols.push(
      { title: '化验单号', key: 'qcNo', width: 140, ellipsis: true },
      { title: '检验结论', key: 'qcResult', width: 110 },
    )
  }
  return cols
})
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
  { title: '角色', dataIndex: 'roleLabel', width: 90 },
  { title: '物料', dataIndex: 'item', width: 160, ellipsis: true },
  { title: '阶段', dataIndex: 'stepText', width: 110 },
  { title: '批次号', dataIndex: 'batchNo', width: 150 },
  { title: '处理方式', dataIndex: 'dispositionLabel', width: 90 },
  { title: '去向位置', dataIndex: 'locationName', width: 110 },
  { title: '数量', dataIndex: 'qtyText', align: 'right', width: 100 },
  { title: '剩余', dataIndex: 'remainText', align: 'right', width: 100 },
  { title: '放行状态', key: 'status', width: 100 },
  { title: '检验结论', key: 'inspectConclusion', width: 100 },
  { title: '化验单号', key: 'qcLinks', width: 180 },
  { title: '操作', key: 'action', width: 160 },
]
const expectColumns = [
  { title: '角色', dataIndex: 'roleLabel', width: 100 },
  { title: '物料', dataIndex: 'item' },
  { title: '预期', dataIndex: 'qtyText', align: 'right', width: 120 },
  { title: '已产', dataIndex: 'postedText', align: 'right', width: 120 },
  { title: '本次实产', key: 'actual', width: 150 },
  { title: '处理方式', key: 'disposition', width: 120 },
  { title: '去向位置', key: 'location', width: 160 },
  { title: '产出化验', key: 'inboundQc', width: 168 },
]
const outputRelatedQcColumns = [
  { title: '物料', dataIndex: 'item', width: 180 },
  { title: '角色', dataIndex: 'roleLabel', width: 90 },
  { title: '化验类型', dataIndex: 'scopeLabel', width: 110 },
  { title: '化验单号', key: 'qcNo', width: 160 },
  { title: '状态', key: 'status', width: 120 },
]
const assayChecklistColumns = [
  { title: '化验类型', dataIndex: 'typeLabel', width: 120 },
  { title: '业务类型', dataIndex: 'bizLabel', width: 100 },
  { title: '门禁', key: 'gate', width: 90 },
  { title: '状态', key: 'status', width: 200 },
  { title: '发起', key: 'action', width: 110 },
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
      positionText: stepPositionText(step, proc),
      formTemplateText: tpl?.templateName || '—',
      limitText: formatStepParams(step) || '—',
      outputText: stepOutputText(step.stepNo),
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
function stepPositionText(step, proc) {
  if (Array.isArray(step?.positionNames)) {
    const saved = step.positionNames.map((name) => String(name || '').trim()).filter(Boolean)
    return saved.join('、') || '—'
  }
  const defaults = resolveDefaultExecutors(proc)
  return defaults.join('、') || '—'
}

function stepOutputLines(stepNo) {
  const rows = (order.value?.outputs || []).filter((row) => Number(row.stepNo) === Number(stepNo))
  return rows.map((row) => {
    const unit = itemUnit(row.itemId) || order.value?.unit || ''
    return {
      role: roleLabel[row.role] || '',
      name: itemLabel(row.itemId) || '产出',
      qty: formatQtyWithUnit(row.qty, unit),
      disposition: OUTPUT_DISPOSITION_LABEL[normalizeOutputDisposition(row.disposition)] || '',
    }
  })
}

function stepOutputText(stepNo) {
  const lines = stepOutputLines(stepNo)
  if (!lines.length) return '—'
  return lines
    .map((line) => [line.role, line.name, line.qty, line.disposition].filter(Boolean).join(' '))
    .join('；')
}

function stepOutputPreview(stepNo) {
  const lines = stepOutputLines(stepNo)
  if (!lines.length) return '—'
  const first = [lines[0].role, lines[0].name, lines[0].qty].filter(Boolean).join(' ')
  if (lines.length === 1) return first
  return `${first} 等${lines.length}项`
}

/** 步骤实绩摘要：投料合计 + 全部工艺参数实绩；仅确认无数值时显示「已确认」；否则 — */
function stepSummaryLines(stepNo) {
  const current = order.value
  if (!current) return []
  const feeds = (current.feeds || []).filter((row) => Number(row.stepNo) === Number(stepNo))
  const params = (current.paramActuals || []).filter((row) => Number(row.stepNo) === Number(stepNo))
  const lines = []
  if (feeds.length) {
    const qty = feeds.reduce((sum, row) => sum + Number(row.qty || 0), 0)
    const unit = itemUnit(feeds[0].itemId) || current.unit || ''
    lines.push({ label: '投料', value: formatQtyWithUnit(qty, unit) })
  }
  params.forEach((row) => {
    lines.push({ label: row.key || '参数', value: String(row.value ?? '—') })
  })
  return lines
}

function stepSummaryText(stepNo) {
  const lines = stepSummaryLines(stepNo)
  if (lines.length) return lines.map((line) => `${line.label} ${line.value}`).join('；')
  if (order.value?.confirmedSteps?.includes(stepNo)) return '已确认'
  return '—'
}

function stepSummaryPreview(stepNo) {
  const lines = stepSummaryLines(stepNo)
  if (!lines.length) return stepSummaryText(stepNo)
  const first = `${lines[0].label} ${lines[0].value}`
  if (lines.length === 1) return first
  return `${first} 等${lines.length}项`
}

function contentWithUnit(value) {
  if (value == null || value === '') return '—'
  const pct = contentToPct(value)
  if (pct == null) return '—'
  return `${formatNumber(pct, 4)}%`
}

/** 库存/批次含量按 0~1 小数存储；界面按百分比录入与展示。最多 4 位小数、不补尾零。 */
function contentToPct(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const pct = Math.abs(n) <= 1 ? n * 100 : n
  return roundNumber(pct, 4)
}

function contentPctToFraction(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return roundNumber(n / 100, 6)
}

const feedRows = computed(() => {
  const posted = order.value?.feeds || []
  return (order.value?.theoreticalFeeds || []).map((line, index) => {
    const feeds = posted.filter((row) => row.itemId === line.itemId)
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
          : `±${Number((Number(line.tolerance) * 100).toFixed(2))}%`,
      keyText: line.isKeyMaterial ? '是' : '否',
      auxText: line.isAuxiliary ? '是' : '否',
      postedText: feeds.length ? formatQtyWithUnit(postedQty, unit) : '—',
      supplementText: feeds.length ? String(Math.max(0, feeds.length - 1)) : '—',
      gapText: feeds.length && planQty > 0 ? formatQtyWithUnit(postedQty - planQty, unit) : '—',
      postings: feeds.map((row, feedIndex) => ({
        key: row.id || `${line.itemId}-${row.materialBatchId || row.batchNo}-${feedIndex}`,
        feedId: row.id || '',
        at: row.at || '—',
        operator: row.operator || '—',
        batchNo: row.batchNo || '—',
        qtyText: formatQtyWithUnit(row.qty, unit),
        contentPending: Boolean(row.contentPending),
        contentText: row.contentPending ? '待补录' : contentWithUnit(row.contentUsed),
      })),
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

function outputQcLinksFor(row) {
  const records = (order.value?.outputQcRecords || []).filter((qc) => {
    if (qc.itemId !== row.itemId) return false
    if (row.role && qc.role && qc.role !== row.role) return false
    if (row.stepNo && qc.stepNo && Number(qc.stepNo) !== Number(row.stepNo)) return false
    return Boolean(qc.taskId || qc.qcNo)
  })
  const seen = new Set()
  return records
    .map((qc) => {
      const task = qc.taskId ? getQcTaskById(qc.taskId) : null
      return {
        taskId: qc.taskId || task?.id || '',
        qcNo: task?.qcNo || qc.qcNo || '—',
        bizScope: qc.bizScope || '',
      }
    })
    .filter((link) => {
      const key = link.taskId || link.qcNo
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const outRows = computed(() =>
  (order.value?.outputs || []).map((row) => {
    const batch = getMaterialBatch(row.batchId)
    const step = (order.value?.routeSnapshot || []).find(
      (s) => Number(s.stepNo) === Number(row.stepNo),
    )
    const unit = itemUnit(row.itemId) || order.value?.unit || ''
    const name = itemLabel(row.itemId) || '—'
    const disposition =
      normalizeOutputDisposition(row.disposition) ||
      (row.batchId ? dispositionFromLocation(row.locationId || batch?.locationId) : '')
    const locationId = createsOutputBatchDisposition(disposition)
      ? row.locationId || batch?.locationId || ''
      : ''
    const remainQty = Number(batch?.qty) || 0
    const qc = resolveMaterialBatchQc(batch)
    const qcLinks = outputQcLinksFor(row)
    const fromLink = qcLinks
      .map((link) => {
        const task = link.taskId ? getQcTaskById(link.taskId) : null
        return displayInspectConclusion(task?.qcResult)
      })
      .find((text) => text && text !== '—')
    return {
      ...row,
      roleLabel: roleLabel[row.role] || row.role,
      dispositionLabel: OUTPUT_DISPOSITION_LABEL[disposition] || '—',
      item: unit ? `${name} ${unit}` : name,
      batchNo: row.batchNo || '—',
      locationName: tankName(locationId),
      qtyText: formatQtyWithUnit(row.qty, unit),
      remainText: formatQtyWithUnit(remainQty, unit),
      remainQty,
      stepText: row.stepNo ? `${row.stepNo}${step?.name ? ` ${step.name}` : ''}`.trim() : '—',
      status: batch?.status,
      inspectConclusion: fromLink || qc.qcResult,
      qcLinks,
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
  filterTemplateFieldsBeyondFixed(currentFormTemplate.value?.fields || []),
)
const formSystemCtx = computed(() => ({
  operatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  equipmentId: currentStep.value?.equipmentId || '',
  equipmentLabel: currentStep.value?.equipmentName || '',
  batchNo: order.value?.batchNo || '',
}))
const stepFixedSystem = computed(() => ({
  equipment: resolveProcessFormSystemValue(PROCESS_FORM_SYSTEM_KEYS.EQUIPMENT, formSystemCtx.value),
  batchNo: resolveProcessFormSystemValue(PROCESS_FORM_SYSTEM_KEYS.BATCH_NO, formSystemCtx.value),
}))
const stepOperatedAtPicker = computed({
  get: () => formValues.OP_OPERATED_AT || undefined,
  set: (value) => {
    formValues.OP_OPERATED_AT = value || ''
  },
})
const openFeed = ref(false)
const feedForm = reactive({ stepNo: undefined, extra: false, feedSource: 'fresh' })
const feedSourceOptions = [
  { value: 'fresh', label: '线边新料' },
  { value: 'recycle', label: '回流料' },
]
const isReextractOrder = computed(() => Boolean(order.value?.reextractOfBatchId))
/** 线边新料才吃功能参数；回流/再提强制选手选，投料来源不另增第三档 */
const processFeedDeductMode = computed(() => {
  void functionParamState.params.processFeedDeductMode
  return getProcessFeedDeductMode()
})
const useFeedFifoOnlyMode = computed(() => {
  if (isReextractOrder.value) return false
  if (feedForm.feedSource === 'recycle') return false
  return processFeedDeductMode.value === PROCESS_FEED_DEDUCT_MODES.LOCATION_FIFO
})
const useFeedEitherMode = computed(() => {
  if (isReextractOrder.value) return false
  if (feedForm.feedSource === 'recycle') return false
  return processFeedDeductMode.value === PROCESS_FEED_DEDUCT_MODES.EITHER
})
const feedModalTitle = computed(() => {
  if (isReextractOrder.value) return '再提投料'
  return feedForm.feedSource === 'recycle' ? '回流投料' : '投料过账'
})
const feedSourceHint = computed(() => {
  if (isReextractOrder.value) {
    return '本单为再提指令，只可选对应的待再提批次。行内选批次或点「搜索更多」。'
  }
  if (feedForm.feedSource === 'recycle') {
    return '回流料：确认回用后出现；若产出勾选化验且硬门禁，须化验合格后才可选。'
  }
  if (useFeedFifoOnlyMode.value) {
    return '线边新料 · 按库位先进先出：只选来源储罐/库位（混罐场景），不选手选批次；系统在该罐/仓内扣减。含量可手填，也可空着后补（手补或过程检回填）。'
  }
  if (useFeedEitherMode.value) {
    return '线边新料 · 两者皆可：想追溯到批 → 选手选批次（库位随批）；罐内已混批 → 不选批、改选来源储罐/库位。含量可手填或空着后补，不依赖过程检。'
  }
  return '线边新料：已领到线边即可投；列表展示检验结论，不看放行状态。'
})
const feedBatchPlaceholder = computed(() => {
  if (feedForm.feedSource === 'recycle') return '搜索回流批次'
  if (useFeedEitherMode.value) return '选批=按批扣；不选=再选储罐/库位'
  return '搜索批次号'
})

function needsFeedSourceLocation(record) {
  if (useFeedFifoOnlyMode.value) return true
  if (useFeedEitherMode.value && !record?.batchId) return true
  return false
}

function feedLocationFollowText(record) {
  if (record?.batchId) {
    const name = tankName(record.locationId)
    return name !== '—' ? `随批次 · ${name}` : '随所选批次'
  }
  return '—'
}

function feedLocationOptionsForItem(itemId) {
  return listFeedSourceLocations(itemId, order.value, {
    source: feedForm.feedSource === 'recycle' ? 'recycle' : 'fresh',
  })
}

function feedContentPlaceholder(record) {
  if (needsFeedSourceLocation(record)) return '可手填，或空着后补'
  if (record?.convertByContent) return '必填'
  return '可选'
}

const feedContentPatchOpen = ref(false)
const feedContentPatchSaving = ref(false)
const feedContentPatch = reactive({
  feedId: '',
  batchNo: '',
  contentPct: null,
})

function openFeedContentPatch(record) {
  feedContentPatch.feedId = record.feedId || ''
  feedContentPatch.batchNo = record.batchNo || ''
  feedContentPatch.contentPct = null
  feedContentPatchOpen.value = true
}

function closeFeedContentPatch() {
  feedContentPatchOpen.value = false
}

function saveFeedContentPatch() {
  const frac = contentPctToFraction(feedContentPatch.contentPct)
  if (!(Number(frac) > 0)) {
    message.warning('请填写含量')
    return
  }
  feedContentPatchSaving.value = true
  try {
    const res = backfillFeedContentFromAssay(order.value.id, {
      feedId: feedContentPatch.feedId,
      content: frac,
    })
    if (!res.ok || !res.updated) {
      message.warning(res.message || '补录失败')
      return
    }
    message.success('含量已补录')
    feedContentPatchOpen.value = false
  } finally {
    feedContentPatchSaving.value = false
  }
}
const feedLineDrafts = ref([])
const feedBatchPickerOpen = ref(false)
const feedBatchPickerRow = ref(null)
const openOutput = ref(false)
const confirmOpen = ref(false)
const editOpen = ref(false)
const decideOpen = ref(false)
const decideSaving = ref(false)
const decideForm = reactive({
  outputId: '',
  batchId: '',
  itemLabel: '',
  batchNo: '',
  inspectConclusion: '—',
  disposition: undefined,
  locationId: '',
  itemId: '',
  role: '',
})
const outputForm = reactive({ stepNo: undefined, extra: false })
const outputDrafts = ref([])
const deviation = ref('')
function locationOptionsFor(disposition) {
  const kind = locationKindForDisposition(disposition)
  return listTanks()
    .filter((row) => {
      if (!kind) return true
      const rowKind = row.kind === 'tank' ? 'tank' : 'silo'
      return rowKind === kind
    })
    .map((row) => ({ value: row.id, label: row.name }))
}

function outputDispositionOptionsFor(role) {
  if (role === 'main') {
    return OUTPUT_DISPOSITION_OPTIONS.filter((item) => isStockOutputDisposition(item.value))
  }
  return OUTPUT_DISPOSITION_OPTIONS
}

function outputRowKey(row) {
  return row.id || row.batchId || `${row.role}-${row.itemId}-${row.at || ''}`
}

function dispositionFromLocation(locationId) {
  if (!locationId) return 'warehouse'
  const row = listTanks().find((tank) => tank.id === locationId)
  return row?.kind === 'tank' ? 'tank' : 'warehouse'
}

function defaultOutputDisposition(role, itemId) {
  if (role === 'recycle') return 'reuse'
  if (role === 'waste') return 'scrap'
  if (role === 'co' || role === 'by') return 'pending_decide'
  const name = itemLabel(itemId) || ''
  if (role === 'main') {
    if (name.includes('卤') || name.includes('液') || name.includes('水') || name.includes('漆')) {
      return 'tank'
    }
    return 'warehouse'
  }
  return 'pending_decide'
}

function locationPlaceholder(disposition) {
  if (disposition === 'tank') return '选择储罐'
  if (disposition === 'warehouse') return '选择仓库'
  if (disposition === 'reuse') return '回流罐或仓'
  if (disposition === 'reextract') return '待再提位置'
  if (disposition === 'pending_decide') return '暂存位置'
  if (disposition === 'scrap') return '废弃位置'
  return '选择位置'
}

const finalDispositionOptions = OUTPUT_DISPOSITION_OPTIONS.filter(
  (item) => item.value !== 'pending_decide',
)

function onOutputDispositionChange(record) {
  if (!createsOutputBatchDisposition(record.disposition)) {
    record.locationId = ''
    return
  }
  const options = locationOptionsFor(record.disposition)
  if (record.locationId && !options.some((opt) => opt.value === record.locationId)) {
    record.locationId = ''
  }
  if (!record.locationId) {
    record.locationId = defaultOutputLocation(record.itemId, record.role, record.disposition)
  }
}

function outputSaveLead(rows) {
  const stock = rows.filter((row) => isStockOutputDisposition(row.disposition)).length
  const hold = rows.filter(
    (row) => row.disposition === 'reuse' || row.disposition === 'reextract',
  ).length
  if (stock === rows.length) return '产出已入库'
  if (hold === rows.length) return '产出已登记为待回用或待再提批次'
  if (stock && hold) return `产出已登记，其中 ${stock} 行已入库，${hold} 行待回用或再提`
  if (stock) return `产出已登记，其中 ${stock} 行已入库`
  return '产出已登记'
}

function tankName(locationId) {
  if (!locationId) return '—'
  return listTanks().find((tank) => tank.id === locationId)?.name || '—'
}

function defaultOutputLocation(itemId, role, disposition) {
  const kind = locationKindForDisposition(disposition)
  const tanks = listTanks().filter((row) => {
    if (!kind) return true
    const rowKind = row.kind === 'tank' ? 'tank' : 'silo'
    return rowKind === kind
  })
  const tankIds = new Set(tanks.map((tank) => tank.id))
  const counts = new Map()
  listMaterialBatches().forEach((batch) => {
    if (batch.itemId !== itemId || !batch.locationId || !tankIds.has(batch.locationId)) return
    counts.set(batch.locationId, (counts.get(batch.locationId) || 0) + 1)
  })
  let best = ''
  let bestCount = 0
  counts.forEach((count, id) => {
    if (count > bestCount) {
      best = id
      bestCount = count
    }
  })
  if (best) return best
  const name = itemLabel(itemId) || ''
  const byName = (keyword) =>
    tanks.find((tank) => String(tank.name || '').includes(keyword))?.id || ''
  if (disposition === 'tank' || disposition === 'reuse') {
    if (name.includes('卤')) return byName('卤')
    if (name.includes('回收') || disposition === 'reuse')
      return byName('回收') || tanks[0]?.id || ''
    if (name.includes('漆')) return byName('成品漆') || byName('漆')
    return tanks[0]?.id || ''
  }
  if (disposition === 'reextract' || disposition === 'pending_decide') {
    if (name.includes('渣')) return byName('渣')
    if (name.includes('卤')) return byName('卤')
    if (disposition === 'pending_decide')
      return byName('回收') || byName('暂存') || tanks[0]?.id || ''
    return byName('渣') || tanks[0]?.id || ''
  }
  if (disposition === 'scrap') return byName('渣') || tanks[0]?.id || ''
  if (name.includes('渣') || role === 'waste') return byName('渣')
  if (role === 'main') return byName('工碳') || byName('成品') || tanks[0]?.id || ''
  return tanks[0]?.id || ''
}
const outputStepOptions = computed(() =>
  (order.value?.routeSnapshot || []).map((step) => ({
    value: step.stepNo,
    label: `${step.stepNo} ${step.name || ''}`,
  })),
)

function stepHasOutputs(stepNo) {
  return (order.value?.expectedOutputs || []).some((line) => Number(line.stepNo) === Number(stepNo))
}

/** 配方/计划产出行上已配置的产出检；有配置则强制勾选不可改。 */
function formulaAssayScopes(line) {
  if (Array.isArray(line?.assayScopes) && line.assayScopes.length) {
    return normalizeOutputAssayScopes(line.assayScopes)
  }
  const formula = getFormula(order.value?.formulaId)
  const live = (formula?.outputs || []).find(
    (row) => row.itemId === line?.itemId && row.role === line?.role,
  )
  return normalizeOutputAssayScopes(live?.assayScopes)
}

function onOutputAssayCheck(record, checked) {
  if (record?.assayLocked) return
  record.assayScopes = checked ? ['成品检'] : []
  if (!checked) record.forceNewAssay = false
}

/** 同物料同角色同阶段是否已有有效产出化验单（用于显示「强制新建」） */
function hasExistingOutputAssay(record) {
  const stepNo = Number(record?.stepNo || outputForm.stepNo)
  return (order.value?.outputQcRecords || []).some((qc) => {
    if (qc.itemId !== record?.itemId) return false
    if (record?.role && qc.role && qc.role !== record.role) return false
    if (stepNo > 0 && qc.stepNo && Number(qc.stepNo) !== stepNo) return false
    if (String(qc.bizScope || '成品检').trim() !== '成品检') return false
    if (!qc.taskId && !qc.qcNo) return false
    const task = qc.taskId ? getQcTaskById(qc.taskId) : null
    if (task?.bizScope && task.bizScope !== '成品检') return false
    if (task && task.qcStatus === QC_TASK_STATUS.CANCELLED) return false
    return true
  })
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
    const lineStep = Number(line.stepNo) > 0 ? Number(line.stepNo) : stepNo
    const unit = itemUnit(line.itemId) || order.value?.unit || ''
    const name = itemLabel(line.itemId) || '—'
    const forcedScopes = formulaAssayScopes(line)
    const assayLocked = forcedScopes.length > 0
    return {
      key: `${line.role}-${line.itemId}-${index}`,
      role: line.role,
      stepNo: lineStep,
      roleLabel: roleLabel[line.role] || line.role,
      itemId: line.itemId,
      item: unit ? `${name} ${unit}` : name,
      unit,
      qty: line.qty,
      qtyText: formatQtyWithUnit(line.qty, unit),
      posted,
      postedText: posted > 0 ? formatQtyWithUnit(posted, unit) : '—',
      actual: remain > 0 ? remain : null,
      disposition: defaultOutputDisposition(line.role, line.itemId),
      locationId: (() => {
        const way = defaultOutputDisposition(line.role, line.itemId)
        return createsOutputBatchDisposition(way)
          ? defaultOutputLocation(line.itemId, line.role, way)
          : ''
      })(),
      assayLocked,
      assayScopes: assayLocked ? forcedScopes : [],
      forceNewAssay: false,
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
  const fifoOnly = useFeedFifoOnlyMode.value
  const either = useFeedEitherMode.value
  feedLineDrafts.value = lines.map((line, index) => {
    const posted = postedQtyForItem(line.itemId)
    const remain = Math.max(0, Number(line.qty || 0) - posted)
    const source = feedForm.feedSource === 'recycle' ? 'recycle' : 'fresh'
    const batches = listFeedableBatches(line.itemId, order.value, { source })
    const preferred = batches[0]
    const card = itemMasterCard(line.itemId)
    const unit = itemUnit(line.itemId) || order.value?.unit || 'kg'
    // 强制 FIFO / 两者皆可默认不选手选批次（未选=罐内先进先出）；选手选模式才预填首批
    const preselectBatch = !fifoOnly && !either
    const selected = preselectBatch ? preferred : null
    const qc = selected
      ? resolveMaterialBatchQc(selected)
      : { qcNo: '—', qcResult: '—', qcTaskId: '' }
    const useFifoDraft = fifoOnly || either
    return {
      key: `${line.itemId}-${index}`,
      itemId: line.itemId,
      item: card.name || itemLabel(line.itemId),
      itemCode: card.code || '—',
      specText: card.specModel || '—',
      unit,
      planQty: line.qty,
      planQtyText: formatQtyWithUnit(line.qty, unit),
      posted,
      postedText: formatQtyWithUnit(posted, unit),
      convertByContent: Boolean(line.convertByContent),
      batchId: selected?.id || undefined,
      // 不预填库位，避免「先库后批」的错觉；仅选手选批时带出批所在库位
      locationId: selected?.locationId || undefined,
      qty: remain > 0 ? remain : null,
      // FIFO/未选批：不预填含量；选手选才带出批含量。均可手改/后补
      contentPct: selected ? contentToPct(selected.content) : null,
      qcNo: qc.qcNo,
      qcResult: qc.qcResult,
      qcTaskId: qc.qcTaskId,
      fifoDraft: useFifoDraft,
    }
  })
}

function resolveMaterialBatchQc(batch) {
  return resolveBatchInspectInfo(batch)
}

function batchOptionsForItem(itemId) {
  return listFeedableBatches(itemId, order.value, {
    source: feedForm.feedSource === 'recycle' ? 'recycle' : 'fresh',
  }).map((batch) => {
    const qc = resolveMaterialBatchQc(batch)
    const qcTag = qc.qcResult && qc.qcResult !== '—' ? ` 检验${qc.qcResult}` : ''
    return {
      value: batch.id,
      label: `${batch.batchNo}${qcTag} 剩余 ${batch.qty}${batch.unit || ''} 含量 ${contentWithUnit(batch.content)} 效期 ${batch.expiryDate || '—'}`,
    }
  })
}

function onFeedBatchChange(record, batchId) {
  const batch = batchId ? getMaterialBatch(batchId) : null
  record.batchId = batchId || undefined
  if (batch) {
    record.contentPct = contentToPct(batch.content)
    record.locationId = batch.locationId || undefined
  } else {
    // 清空批次 → 改走选罐/库位：含量置空，库位留给用户选（不预填）
    record.contentPct = null
    record.locationId = undefined
  }
  const qc = resolveMaterialBatchQc(batch)
  record.qcNo = qc.qcNo
  record.qcResult = qc.qcResult
  record.qcTaskId = qc.qcTaskId
}

function openFeedBatchQc(record) {
  if (!record) return
  let task = record.qcTaskId ? getQcTaskById(record.qcTaskId) : null
  if (!task && record.qcNo && record.qcNo !== '—') {
    task = listQcTasks().find((row) => String(row.qcNo || '').trim() === String(record.qcNo).trim())
  }
  if (!task) {
    message.warning('未找到完整化验单，仅有检验结论时可在质检列表核对')
    return
  }
  assayQcPreviewTask.value = task
  assayQcDrawerOpen.value = true
}

const feedBatchPickerSelectedIds = computed(() => {
  const id = feedBatchPickerRow.value?.batchId
  return id ? [id] : []
})

function openFeedBatchPicker(record) {
  feedBatchPickerRow.value = record
  feedBatchPickerOpen.value = true
}

function cloneFeedDraftBase(row) {
  return {
    itemId: row.itemId,
    item: row.item,
    itemCode: row.itemCode,
    specText: row.specText,
    unit: row.unit,
    planQty: row.planQty,
    planQtyText: row.planQtyText,
    posted: row.posted,
    postedText: row.postedText,
    convertByContent: row.convertByContent,
  }
}

function makeFeedDraftRow(base, batch, qty) {
  const qc = resolveMaterialBatchQc(batch)
  return {
    ...cloneFeedDraftBase(base),
    key: `${base.itemId}-${batch?.id || 'none'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    batchId: batch?.id || undefined,
    qty: qty == null ? null : qty,
    contentPct: contentToPct(batch?.content),
    qcNo: qc.qcNo,
    qcResult: qc.qcResult,
    qcTaskId: qc.qcTaskId,
  }
}

/** 搜索更多多选确认后：一个批次一行，实投量按剩余量顺序分摊原行数量。 */
function onFeedBatchesPicked(batches) {
  const row = feedBatchPickerRow.value
  const list = (Array.isArray(batches) ? batches : batches ? [batches] : []).filter((b) => b?.id)
  if (!row) return
  if (!list.length) {
    onFeedBatchChange(row, undefined)
    return
  }
  if (list.length === 1) {
    onFeedBatchChange(row, list[0].id)
    return
  }
  const idx = feedLineDrafts.value.findIndex((item) => item.key === row.key)
  if (idx < 0) return
  let left = Number(row.qty) > 0 ? round3(row.qty) : null
  const nextRows = list.map((batch) => {
    let qty = null
    if (left != null && left > 0) {
      const available = Number(batch.qty) || 0
      const take = round3(Math.min(left, available))
      if (take > 0) {
        qty = take
        left = round3(left - take)
      }
    }
    return makeFeedDraftRow(row, batch, qty)
  })
  feedLineDrafts.value.splice(idx, 1, ...nextRows)
}

function batchNo(id) {
  return getMaterialBatch(id)?.batchNo || '—'
}

function removePending() {
  Modal.confirm({
    title: '删除批次指令',
    content: `删除「${order.value?.batchNo || ''}」？只有待下发且尚未投料的指令可以删除。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      try {
        deletePendingOrder(order.value.id)
        message.success('已删除')
        goBack()
      } catch (error) {
        message.error(error.message || '删除失败')
      }
    },
  })
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
  () => [feedForm.stepNo, feedForm.extra, feedForm.feedSource],
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
  feedForm.feedSource = order.value?.reextractOfBatchId ? 'reextract' : 'fresh'
  openFeed.value = true
  buildFeedLineDrafts()
}

function onFeedSourceChange() {
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

function stepProcessAssaySchemes(step) {
  return stepAssaySchemes(step).filter(isProcessAssayScheme)
}

function stepHasOutputAssayHint(step) {
  return stepAssaySchemes(step).some(isFinishedAssayScheme)
}

function latestRecordForScheme(records, scheme) {
  const list = (records || []).filter(
    (row) =>
      (scheme.id && row.schemeId === scheme.id) ||
      (!scheme.id &&
        row.bizScope === scheme.bizScope &&
        String(row.templateCode || '') === String(scheme.templateCode || '')),
  )
  return list.length ? list[list.length - 1] : null
}

function buildAssayChecklistForStep(step, { processOnly = true } = {}) {
  void assayListTick.value
  const schemes = processOnly ? stepProcessAssaySchemes(step || {}) : stepAssaySchemes(step || {})
  // 始终读批次 stepQcMap，避免 stepRows 快照上的 assayRecords 过期导致状态不刷新
  const records = getStepQcRecords(order.value, step?.stepNo) || []
  return schemes.map((scheme) => {
    const hardGate = isAssaySchemeHardGate(scheme)
    const latest = latestRecordForScheme(records, scheme)
    const task = latest?.taskId ? getQcTaskById(latest.taskId) : null
    const qcStatus = task?.qcStatus || latest?.qcStatus || ''
    const qcResult = task?.qcResult || latest?.qcResult || ''
    const qcNo = task?.qcNo || latest?.qcNo || ''
    const taskId = task?.id || latest?.taskId || ''
    const pending =
      Boolean(taskId) &&
      qcStatus !== QC_TASK_STATUS.COMPLETED &&
      qcStatus !== QC_TASK_STATUS.CANCELLED
    const completed = qcStatus === QC_TASK_STATUS.COMPLETED
    const passed = completed && (qcResult === QC_TASK_RESULT.PASS || qcResult === '合格')
    const failed =
      completed &&
      (qcResult === QC_TASK_RESULT.FAIL ||
        String(qcResult).includes('不') ||
        String(qcResult).includes('失败'))
    let statusLabel = '未发起'
    let statusColor = 'default'
    if (pending) {
      statusLabel = '待质检'
      statusColor = 'processing'
    } else if (passed) {
      statusLabel = qcResult || '质检通过'
      statusColor = 'success'
    } else if (failed) {
      statusLabel = qcResult || '不合格'
      statusColor = 'error'
    } else if (completed) {
      statusLabel = qcResult || '已完成'
      statusColor = 'warning'
    }
    const allowMultiple = scheme.allowMultiple !== false
    // 待检时不在「发起」列再点开抽屉，状态列已展示检单号
    const canStart = order.value?.status === 'running' && !pending && (!completed || allowMultiple)
    return {
      schemeId: scheme.id,
      typeLabel: assayTypeLabel(scheme.assayType, scheme.bizScope) || scheme.name || '化验',
      bizLabel: qcBizScopeLabel(scheme.bizScope),
      hardGate,
      gateLabel: hardGate ? '硬门禁' : '记录',
      statusLabel,
      statusColor,
      qcNo,
      taskId,
      hasPending: pending,
      doneOnce: completed,
      allowMultiple,
      canStart,
      passed,
    }
  })
}

function stepProcessAssayChecklist(step) {
  return buildAssayChecklistForStep(step, { processOnly: true })
}

/** 本阶段产出化验摘要（来自 outputQcRecords + 配方已配未发起） */
function stepOutputAssayChecklist(step) {
  void assayListTick.value
  const stepNo = Number(step?.stepNo)
  if (!(stepNo > 0) || !order.value) return []
  const byKey = new Map()
  ;(order.value.outputQcRecords || []).forEach((qc) => {
    if (Number(qc.stepNo) !== stepNo) return
    if (String(qc.bizScope || '成品检').trim() !== '成品检') return
    if (!qc.taskId && !qc.qcNo) return
    const task = qc.taskId ? getQcTaskById(qc.taskId) : null
    if (task?.bizScope && task.bizScope !== '成品检') return
    const key = `${qc.role || ''}|${qc.itemId || ''}`
    byKey.set(key, { qc, task })
  })
  ;(order.value.expectedOutputs || []).forEach((line) => {
    if (Number(line.stepNo) !== stepNo) return
    const scopes = normalizeOutputAssayScopes(line.assayScopes)
    if (!scopes.length) return
    const key = `${line.role || ''}|${line.itemId || ''}`
    if (byKey.has(key)) return
    byKey.set(key, { qc: { itemId: line.itemId, role: line.role }, task: null, planned: true })
  })
  if (!byKey.size && stepHasOutputAssayHint(step)) {
    return [
      {
        key: `out-hint-${stepNo}`,
        typeLabel: '产出化验',
        statusLabel: '产出时发起',
        statusColor: 'default',
        qcNo: '',
        taskId: '',
        hardGate: false,
      },
    ]
  }
  return [...byKey.entries()].map(([key, row]) => {
    const { qc, task, planned } = row
    const qcStatus = task?.qcStatus || qc?.qcStatus || ''
    const qcResult = task?.qcResult || qc?.qcResult || ''
    const taskId = task?.id || qc?.taskId || ''
    const qcNo = task?.qcNo || qc?.qcNo || ''
    const name = itemLabel(qc?.itemId) || ''
    const role = roleLabel[qc?.role] || ''
    let statusLabel = planned ? '未发起' : '待质检'
    let statusColor = planned ? 'default' : 'processing'
    if (taskId) {
      if (qcStatus === QC_TASK_STATUS.COMPLETED) {
        statusLabel = qcResult || '已完成'
        statusColor =
          qcResult === QC_TASK_RESULT.PASS || qcResult === '合格'
            ? 'success'
            : String(qcResult).includes('不')
              ? 'error'
              : 'warning'
      } else if (qcStatus === QC_TASK_STATUS.CANCELLED) {
        statusLabel = '已终止'
        statusColor = 'default'
      }
    }
    const typeLabel = ['产出化验', role, name].filter(Boolean).join(' · ')
    return {
      key: `out-${key}`,
      typeLabel,
      statusLabel,
      statusColor,
      qcNo,
      taskId,
      hardGate: false,
    }
  })
}

/** 工艺阶段「化验」列：过程检 + 产出检 */
function stepAssaySummaryLines(step) {
  const processRows = stepProcessAssayChecklist(step).map((row) => ({
    key: `proc-${row.schemeId || row.typeLabel}`,
    typeLabel: row.typeLabel || '过程化验',
    statusLabel: row.statusLabel,
    statusColor: row.statusColor,
    qcNo: row.qcNo || '',
    taskId: row.taskId || '',
    hardGate: row.hardGate,
  }))
  return [...processRows, ...stepOutputAssayChecklist(step)]
}

const outputRelatedQcRows = computed(() => {
  const stepNo = Number(outputForm.stepNo)
  const draftKeys = new Set((outputDrafts.value || []).map((row) => `${row.role}|${row.itemId}`))
  const records = order.value?.outputQcRecords || []
  return records
    .filter((qc) => {
      if (!qc.taskId && !qc.qcNo) return false
      // 本列表只展示产出化验（成品检），过程检在「化验」清单
      const scope = String(qc.bizScope || '成品检').trim()
      if (scope !== '成品检') return false
      if (stepNo > 0 && qc.stepNo && Number(qc.stepNo) !== stepNo) return false
      if (draftKeys.size && !draftKeys.has(`${qc.role}|${qc.itemId}`)) return false
      const task = qc.taskId ? getQcTaskById(qc.taskId) : null
      // 历史脏数据：挂到产出列表但任务其实是过程检 → 剔除
      if (task?.bizScope && task.bizScope !== '成品检') return false
      return true
    })
    .map((qc, index) => {
      const task = qc.taskId ? getQcTaskById(qc.taskId) : null
      const qcStatus = task?.qcStatus || qc.qcStatus || ''
      const qcResult = task?.qcResult || qc.qcResult || ''
      let statusLabel = '待质检'
      let statusColor = 'processing'
      if (qcStatus === QC_TASK_STATUS.COMPLETED) {
        statusLabel = qcResult || '已完成'
        statusColor =
          qcResult === QC_TASK_RESULT.PASS || qcResult === '合格'
            ? 'success'
            : String(qcResult).includes('不')
              ? 'error'
              : 'warning'
      } else if (qcStatus === QC_TASK_STATUS.CANCELLED) {
        statusLabel = '已终止'
        statusColor = 'default'
      }
      const unit = itemUnit(qc.itemId) || ''
      const name = itemLabel(qc.itemId) || '—'
      return {
        key: `${qc.taskId || qc.qcNo || index}`,
        item: unit ? `${name} ${unit}` : name,
        roleLabel: roleLabel[qc.role] || qc.role || '—',
        scopeLabel: qcBizScopeLabel('成品检'),
        qcNo: task?.qcNo || qc.qcNo || '—',
        taskId: task?.id || qc.taskId || '',
        statusLabel,
        statusColor,
      }
    })
})

const assayOpen = ref(false)
const assayStep = ref(null)
const assayStartingId = ref('')
const assayListTick = ref(0)
const assayModalWidth = ref(960)
const assayQcDrawerOpen = ref(false)
const assayQcPreviewTask = ref(null)

function syncAssayModalWidth() {
  if (typeof window === 'undefined') return
  assayModalWidth.value = Math.min(1200, Math.max(960, Math.floor(window.innerWidth * 0.9)))
}

onMounted(() => {
  syncAssayModalWidth()
  window.addEventListener('resize', syncAssayModalWidth)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', syncAssayModalWidth)
})

function openAssayQcPreview(taskId) {
  if (!taskId) return
  const task = getQcTaskById(taskId)
  if (!task) {
    message.warning('未找到质检单')
    return
  }
  assayQcPreviewTask.value = task
  assayQcDrawerOpen.value = true
}

const assayChecklistRows = computed(() =>
  buildAssayChecklistForStep(assayStep.value || {}, { processOnly: true }),
)

const assayFinishedHint = computed(() => {
  const finished = stepAssaySchemes(assayStep.value || {}).filter(isFinishedAssayScheme)
  if (!finished.length) return ''
  const names = finished.map((s) => assayTypeLabel(s.assayType, s.bizScope) || s.name).join('、')
  return `本步另配有产出检「${names}」：请在「产出」过账时按产出行勾选并发起，不在此清单发起。`
})

const stepConfirmAssayChecklist = computed(() =>
  stepOpen.value ? buildAssayChecklistForStep(currentStep.value || {}, { processOnly: true }) : [],
)

const stepConfirmHardGateBlocked = computed(() => {
  if (!stepOpen.value || order.value?.status !== 'running') return false
  const gate = normalizeProcessGate(currentStep.value?.gateMode)
  if (gate !== PROCESS_GATE_HARD) return false
  const rows = stepConfirmAssayChecklist.value
  const hardRows = rows.filter((row) => row.hardGate)
  const targets = hardRows.length ? hardRows : rows
  if (!targets.length) return false
  return targets.some((row) => !row.passed)
})

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
  syncAssayModalWidth()
  assayStep.value = step
  assayOpen.value = true
}

async function startAssayFromChecklist(row, step) {
  if (!row?.schemeId || !step?.stepNo) return
  assayStartingId.value = row.schemeId
  try {
    const result = createProcessQcFromBatchStep({
      orderId: order.value.id,
      stepNo: step.stepNo,
      schemeId: row.schemeId,
    })
    if (!result.ok) {
      message.error(result.message || '发起化验失败')
      return
    }
    assayListTick.value += 1
    if (result.created) {
      message.success(`已发起化验 ${result.task.qcNo}`)
    } else {
      message.info(`已有待检单 ${result.task.qcNo}，状态列可查看`)
    }
  } catch (error) {
    message.error(error.message || '发起化验失败')
  } finally {
    assayStartingId.value = ''
  }
}

function goRequisition() {
  if (!order.value?.id) return
  const path = `/production/material-requisition/create?batchId=${order.value.id}`
  openTab(path, '申请领料')
  router.push(path)
}

function goInbound(link) {
  if (!link?.id) return
  const path = `/inventory/inbound/${link.id}`
  openTab(path, link.docNo ? `入库单 ${link.docNo}` : '入库单详情')
  router.push(path)
}

function goQcTask(taskId) {
  openAssayQcPreview(taskId)
}

function openStep(step) {
  currentStep.value = step
  stepActuals.value = stepParamRows(step).map((param) =>
    param.target == null ? null : param.target,
  )
  Object.keys(formValues).forEach((key) => delete formValues[key])
  const ctx = {
    equipmentId: step.equipmentId || '',
    equipmentLabel: step.equipmentName || '',
    batchNo: order.value?.batchNo || '',
    operatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  }
  formValues.OP_OPERATOR = resolveProcessFormSystemValue(PROCESS_FORM_SYSTEM_KEYS.OPERATOR, ctx)
  formValues.OP_OPERATED_AT = ctx.operatedAt
  formValues.OP_OUTPUT_QTY = null
  formValues.OP_REMARK = ''
  const tpl = resolveStepFormTemplate(step)
  filterTemplateFieldsBeyondFixed(tpl?.fields || []).forEach((field) => {
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
    const lines = []
    const fifoOnly = useFeedFifoOnlyMode.value
    const either = useFeedEitherMode.value
    let usedFifo = false
    let usedPick = false
    let pendingContent = false
    for (const row of feedLineDrafts.value || []) {
      if (!(Number(row.qty) > 0)) continue
      const feedSource = isReextractOrder.value
        ? 'reextract'
        : feedForm.feedSource === 'recycle'
          ? 'recycle'
          : 'fresh'
      const useFifo = fifoOnly || (either && !row.batchId)
      if (useFifo) {
        if (!row.locationId) {
          throw new Error(`${row.item || '原料'} 请选择来源库位（储罐/仓库）`)
        }
        planFeedFifoAllocations(row.itemId, row.qty, order.value, {
          source: 'fresh',
          locationId: row.locationId,
        })
        const contentUsed = contentPctToFraction(row.contentPct)
        const emptyContent = !(Number(contentUsed) > 0)
        lines.push({
          fifo: true,
          itemId: row.itemId,
          locationId: row.locationId,
          qty: row.qty,
          stepNo: feedForm.stepNo,
          contentUsed,
          allowEmptyContent: true,
          feedSource,
        })
        usedFifo = true
        if (emptyContent) pendingContent = true
        continue
      }
      if (!row.batchId) continue
      if (row.convertByContent && !(Number(row.contentPct) > 0)) {
        throw new Error(`${row.item || '原料'} 按含量折算，请填写含量`)
      }
      const batch = getMaterialBatch(row.batchId)
      const available = Number(batch?.qty) || 0
      if (Number(row.qty) > available + 1e-9) {
        throw new Error(
          `批次 ${batch?.batchNo || row.batchId} 剩余量不足（剩余 ${available}${row.unit || ''}）`,
        )
      }
      lines.push({
        batchId: row.batchId,
        qty: row.qty,
        stepNo: feedForm.stepNo,
        contentUsed: contentPctToFraction(row.contentPct),
        feedSource,
      })
      usedPick = true
    }
    if (!lines.length) {
      message.warning(fifoOnly || either ? '请至少填写一行实投量' : '请至少选择一批并填写实投量')
      return
    }
    postFeeds(order.value.id, lines)
    openFeed.value = false
    let tip = '投料已记账，原料批次重量和罐液位已扣减'
    if (isReextractOrder.value) tip = '再提投料已记账'
    else if (feedForm.feedSource === 'recycle') tip = '回流投料已记账'
    else if (usedFifo && usedPick) tip = '投料已记账，部分选手选批次、部分按库位先进先出扣减'
    else if (usedFifo) tip = '投料已记账，已按所选储罐/库位扣减'
    if (pendingContent) tip += '；含量待补录（可手补或化验回填）'
    message.success(tip)
  } catch (error) {
    message.error(error.message)
  }
}

function saveOutput() {
  const postedRows = (outputDrafts.value || []).filter((row) => Number(row.actual) > 0)
  const missingWay = postedRows.find((row) => !row.disposition)
  if (missingWay) {
    message.warning(`${missingWay.item} 请选择处理方式`)
    return
  }
  const missingLocation = postedRows.find(
    (row) => createsOutputBatchDisposition(row.disposition) && !row.locationId,
  )
  if (missingLocation) {
    message.warning(
      `${missingLocation.item} 请选择${locationPlaceholder(missingLocation.disposition)}`,
    )
    return
  }
  try {
    postOutput(order.value.id, {
      deviation: deviation.value,
      stepNo: outputForm.stepNo,
      rows: postedRows.map((row) => {
        const scopes = normalizeOutputAssayScopes(row.assayScopes)
        return {
          role: row.role,
          itemId: row.itemId,
          qty: row.actual,
          disposition: row.disposition,
          locationId: createsOutputBatchDisposition(row.disposition) ? row.locationId : '',
          assayScopes: scopes,
          assayHardGate: scopes.length > 0,
        }
      }),
    })
  } catch (error) {
    message.error(error.message)
    return
  }
  const created = []
  const skipped = []
  const failed = []
  postedRows.forEach((row) => {
    ;(row.assayScopes || []).forEach((bizScope) => {
      const forceNew = Boolean(row.forceNewAssay)
      const result = createOutputInboundQc({
        orderId: order.value.id,
        stepNo: row.stepNo || outputForm.stepNo,
        itemId: row.itemId,
        role: row.role,
        inspectQty: row.actual,
        bizScope,
        forceNew,
      })
      const label = `${row.item} · ${qcBizScopeLabel(bizScope)}`
      if (!result.ok) failed.push(`${label}：${result.message || '生成失败'}`)
      else if (result.created) {
        created.push(forceNew ? `${result.task.qcNo}（强制新建）` : result.task.qcNo)
      } else skipped.push(result.task?.qcNo || label)
    })
  })
  openOutput.value = false
  assayListTick.value += 1
  const lead = outputSaveLead(postedRows)
  const stockOnly = postedRows.every((row) => isStockOutputDisposition(row.disposition))
  if (failed.length) {
    message.warning(`${lead}。化验单未全部生成：${failed.join('；')}`)
    return
  }
  if (created.length) {
    message.success(`${lead}，已生成化验单 ${created.join('、')}`)
    return
  }
  if (skipped.length) {
    message.success(`${lead}。已关联既有化验单 ${skipped.join('、')}（多次过账共用，未新建）`)
    return
  }
  message.success(
    stockOnly ? `${lead}，得率差已计算。产出批次待成品放行后才能发货` : `${lead}，得率差已计算`,
  )
}

function openDecideDisposition(record) {
  decideForm.outputId = record.id || ''
  decideForm.batchId = record.batchId || ''
  decideForm.itemLabel = record.item || itemLabel(record.itemId) || '—'
  decideForm.batchNo = record.batchNo || '—'
  decideForm.inspectConclusion = record.inspectConclusion || '—'
  decideForm.itemId = record.itemId || ''
  decideForm.role = record.role || ''
  decideForm.disposition = undefined
  decideForm.locationId = record.locationId || ''
  decideOpen.value = true
}

function onDecideDispositionChange() {
  const options = locationOptionsFor(decideForm.disposition)
  if (decideForm.locationId && !options.some((opt) => opt.value === decideForm.locationId)) {
    decideForm.locationId = ''
  }
  if (!decideForm.locationId && decideForm.disposition) {
    decideForm.locationId = defaultOutputLocation(
      decideForm.itemId,
      decideForm.role,
      decideForm.disposition,
    )
  }
}

function closeDecideDisposition() {
  decideOpen.value = false
}

function saveDecideDisposition() {
  if (!decideForm.disposition) {
    message.warning('请选择最终去向')
    return
  }
  if (!decideForm.locationId) {
    message.warning(`请选择${locationPlaceholder(decideForm.disposition)}`)
    return
  }
  decideSaving.value = true
  try {
    confirmOutputDisposition(order.value.id, {
      outputId: decideForm.outputId,
      batchId: decideForm.batchId,
      disposition: decideForm.disposition,
      locationId: decideForm.locationId,
    })
    message.success('已确认产出去向')
    decideOpen.value = false
  } catch (error) {
    message.error(error.message)
  } finally {
    decideSaving.value = false
  }
}

function openReextract(record) {
  try {
    const created = createReextract({
      sourceBatchId: record.batchId,
      qty: record.remainQty || record.qty,
    })
    message.success(`已生成再提指令 ${created.batchNo}`)
    openTab(`/production/work-orders/${created.id}`, `批次指令 ${created.batchNo}`)
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
    const created = createRework({
      sourceBatchId: record.batchId,
      qty: record.remainQty || record.qty,
    })
    message.success(`已生成返工指令 ${created.batchNo}，投料时扣原批次`)
    openTab(`/production/batch-instructions/${created.id}`, `批次指令 ${created.batchNo}`)
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

.qc-link {
  cursor: pointer;
}

.output-assay-checks {
  display: flex;
  flex-wrap: wrap;
  column-gap: 8px;
  row-gap: 4px;
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

.formula-kv-full {
  grid-column: 1 / -1;
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

.feed-groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feed-group {
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.feed-group-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
}

.feed-formula {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  min-width: 0;
  flex: 1;
  font-size: 14px;
  line-height: 22px;
  color: #1f2329;
}

.feed-formula i,
.feed-summary i {
  font-style: normal;
  color: #4e5969;
}

.feed-summary {
  display: flex;
  flex-shrink: 0;
  gap: 16px;
  padding: 8px 12px;
  background: #e7f3f1;
  border-radius: 8px;
}

.feed-summary span {
  display: flex;
  flex-direction: column;
  min-width: 72px;
}

.feed-summary i {
  font-size: 12px;
  line-height: 18px;
}

.feed-summary b {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: #1f2329;
}

.feed-empty {
  padding: 8px 16px 12px;
  color: #86909c;
  font-size: 13px;
  line-height: 22px;
}

.feed-posting-table {
  margin: 0 12px 12px;
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

.qc-scheme-name {
  font-size: 12px;
  color: #4e5969;
}

.qc-no-inline {
  margin-left: 4px;
  font-size: 12px;
  color: #307068;
}

.output-assay-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.output-qc-list-block {
  margin-top: 12px;
}

.output-qc-list-block .section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.assay-modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.prior-assay-hint {
  margin-bottom: 12px;
}

.search-more-row {
  padding: 6px 12px;
  color: #307068;
  cursor: pointer;
  font-size: 13px;
}

.search-more-row:hover {
  background: #f2f3f5;
}

.step-rich-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.step-rich-main {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1f2329;
  font-size: 13px;
}

.step-rich-more {
  flex-shrink: 0;
  color: #307068;
  font-size: 12px;
}
</style>

<style lang="less">
.step-rich-popover {
  .step-rich-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 220px;
    max-width: 360px;
  }

  .step-rich-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: 20px;
  }

  .step-rich-label {
    flex-shrink: 0;
    color: #4e5969;
    font-size: 13px;
  }

  .step-rich-value {
    color: #1f2329;
    font-size: 13px;
    word-break: break-all;
  }
}

.batch-assay-modal-wrap {
  .ant-modal {
    max-width: min(1200px, 90vw);
    top: 24px;
    padding-bottom: 0;
  }

  .ant-modal-content {
    display: flex;
    flex-direction: column;
    max-height: 90vh;
  }

  .ant-modal-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
}
</style>
