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
      <a-button v-if="order.status === 'running'" @click="openFeedFor()">投料</a-button>
      <a-button v-if="order.status === 'running' && hasPendingOutput" @click="openOutputFor()"
        >产出登记</a-button
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

      <a-alert
        v-if="completionBlockerVisible"
        class="completion-blocker-alert"
        type="warning"
        show-icon
        message="工艺阶段已全部确认，系统未能自动完成"
        :description="completionBlockerDescription"
      />

      <div class="batch-detail-tabs">
        <a-tabs
          v-model:active-key="detailTab"
          class="detail-tabs detail-tabs-pill detail-tabs-pill--nav-only"
        >
          <a-tab-pane key="info" tab="基本信息" />
          <a-tab-pane key="feed" tab="投料明细" />
          <a-tab-pane key="assay" :tab="`取样检验与放行 (${assayRows.length})`" />
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
              ><i>工作中心</i><b>{{ workCenterText }}</b></span
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
              <span class="k">异常偏差：</span>
              <span class="v">{{ order.deviation || '—' }}</span>
              <template v-if="(order.deviationLogs || []).length > 1">
                <a-button type="link" size="small" @click="deviationLogsOpen = true">
                  历史 ({{ order.deviationLogs.length }})
                </a-button>
              </template>
            </div>
            <div class="formula-kv-full">
              <span class="k">备注：</span><span class="v">{{ order.remark || '—' }}</span>
            </div>
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="工艺阶段">
          <a-table
            class="step-stage-table"
            :columns="stepColumns"
            :data-source="stepRows"
            :pagination="false"
            size="small"
            row-key="stepNo"
            :scroll="{ x: 1580 }"
            :row-class-name="
              (record) => (record.enabledOnOrder === false ? 'step-row-skipped' : '')
            "
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'done'">
                <a-tag :color="record.confirmed ? 'success' : 'default'">{{
                  record.confirmed ? '已确认' : '未确认'
                }}</a-tag>
              </template>
              <template v-else-if="column.key === 'enabled'">
                <a-switch
                  v-if="sameBatchBranchSkipEnabled && canToggleStepEnabled(record)"
                  size="small"
                  :checked="record.enabledOnOrder !== false"
                  :disabled="order?.status !== 'running' && order?.status !== 'pending_release'"
                  checked-children="启用"
                  un-checked-children="关闭"
                  @change="(v) => onToggleStepEnabled(record, v)"
                />
                <span v-else class="muted">—</span>
              </template>
              <template v-else-if="column.key === 'name'">
                <span :class="{ 'step-name-skipped': record.enabledOnOrder === false }">{{
                  record.name || record.processName || '—'
                }}</span>
                <a-tag v-if="record.pathKind === 'branch'" color="processing" class="parallel-tag"
                  >支线</a-tag
                >
                <a-tag v-else-if="record.pathKind === 'sink'" color="warning" class="parallel-tag"
                  >汇合</a-tag
                >
                <a-tag v-if="record.enabledOnOrder === false" class="parallel-tag">本单关闭</a-tag>
              </template>
              <template v-else-if="column.key === 'gate'">
                <a-tag :color="record.gateLabel === '硬门禁' ? 'warning' : 'default'">{{
                  record.gateLabel
                }}</a-tag>
              </template>
              <template v-else-if="column.key === 'summary'">
                <div v-if="stepSummaryLines(record.stepNo).length" class="step-stack-cell">
                  <div
                    v-for="(line, idx) in visibleStepCellItems(
                      stepSummaryLines(record.stepNo),
                      record.stepNo,
                      'summary',
                    )"
                    :key="`sum-${record.stepNo}-${idx}`"
                    class="stack-card"
                  >
                    <div class="stack-card-top">
                      <span class="stack-card-title" :title="line.label">{{ line.label }}</span>
                    </div>
                    <div class="stack-card-bottom">
                      <span class="stack-card-value" :title="String(line.value)">{{
                        line.value
                      }}</span>
                    </div>
                  </div>
                  <a-button
                    v-if="stepSummaryLines(record.stepNo).length > 1"
                    type="link"
                    size="small"
                    class="stack-toggle"
                    @click="toggleStepCellExpand(record.stepNo, 'summary')"
                  >
                    {{
                      isStepCellExpanded(record.stepNo, 'summary')
                        ? '收起'
                        : `详情 (${stepSummaryLines(record.stepNo).length})`
                    }}
                  </a-button>
                </div>
                <span v-else class="muted">{{ record.summaryText }}</span>
              </template>
              <template v-else-if="column.key === 'output'">
                <div v-if="stepOutputLines(record.stepNo).length" class="step-stack-cell">
                  <div
                    v-for="(line, idx) in visibleStepCellItems(
                      stepOutputLines(record.stepNo),
                      record.stepNo,
                      'output',
                    )"
                    :key="`out-${record.stepNo}-${idx}`"
                    class="stack-card"
                  >
                    <div class="stack-card-top">
                      <a-tag v-if="line.role" size="small" color="blue">{{ line.role }}</a-tag>
                      <span class="stack-card-title" :title="line.name">{{ line.name }}</span>
                    </div>
                    <div class="stack-card-bottom">
                      <span
                        class="stack-card-value"
                        :title="[line.qty, line.disposition].filter(Boolean).join(' · ')"
                      >
                        {{ line.qty
                        }}<template v-if="line.disposition"> · {{ line.disposition }}</template>
                      </span>
                    </div>
                  </div>
                  <a-button
                    v-if="stepOutputLines(record.stepNo).length > 1"
                    type="link"
                    size="small"
                    class="stack-toggle"
                    @click="toggleStepCellExpand(record.stepNo, 'output')"
                  >
                    {{
                      isStepCellExpanded(record.stepNo, 'output')
                        ? '收起'
                        : `详情 (${stepOutputLines(record.stepNo).length})`
                    }}
                  </a-button>
                </div>
                <span v-else class="muted">—</span>
              </template>
              <template v-else-if="column.key === 'qc'">
                <div v-if="stepAssaySummaryLines(record).length" class="step-stack-cell">
                  <div
                    v-for="row in visibleStepCellItems(
                      stepAssaySummaryLines(record),
                      record.stepNo,
                      'qc',
                    )"
                    :key="row.key"
                    class="stack-card"
                  >
                    <div class="stack-card-top">
                      <span class="stack-card-title" :title="row.typeLabel">{{
                        row.typeLabel
                      }}</span>
                      <a-tag v-if="row.hardGate" color="warning" size="small">硬</a-tag>
                    </div>
                    <div class="stack-card-bottom">
                      <a-tag :color="row.statusColor" size="small">{{ row.statusLabel }}</a-tag>
                      <a
                        v-if="row.taskId"
                        class="stack-card-link"
                        :title="row.qcNo"
                        @click="goQcTask(row.taskId)"
                      >
                        {{ row.qcNo || '查看' }}
                      </a>
                      <span v-else-if="row.qcNo" class="stack-card-muted" :title="row.qcNo">{{
                        row.qcNo
                      }}</span>
                      <span v-else class="muted">—</span>
                    </div>
                  </div>
                  <a-button
                    v-if="stepAssaySummaryLines(record).length > 1"
                    type="link"
                    size="small"
                    class="stack-toggle"
                    @click="toggleStepCellExpand(record.stepNo, 'qc')"
                  >
                    {{
                      isStepCellExpanded(record.stepNo, 'qc')
                        ? '收起'
                        : `详情 (${stepAssaySummaryLines(record).length})`
                    }}
                  </a-button>
                </div>
                <span v-else class="muted">—</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <div v-if="order.status === 'running'" class="step-action-cell">
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
                  <a-tooltip :title="stepConfirmListBlockTip(record)">
                    <span class="step-confirm-btn-wrap">
                      <a-button
                        type="link"
                        size="small"
                        :disabled="stepConfirmListBlocked(record)"
                        @click="openStep(record)"
                      >
                        {{ record.confirmed ? '重新确认' : '确认本步' }}
                      </a-button>
                    </span>
                  </a-tooltip>
                </div>
                <template v-else-if="record.qcLink?.taskId">
                  <a-button type="link" size="small" @click="goQcTask(record.qcLink.taskId)"
                    >查看检单</a-button
                  >
                </template>
                <span v-else class="muted">—</span>
              </template>
            </template>
          </a-table>
        </DetailSectionCard>
      </div>

      <div v-show="detailTab === 'route'" class="batch-tab-pane">
        <DetailSectionCard title="工艺路线">
          <p class="section-hint">
            下发时的设备路线快照。对照工艺阶段进度；设备显示台账占釜/完好状态；化验与门禁取自配方工序配置（与「工艺阶段」一致）。点「打开阶段」可跳转执行。
          </p>
          <a-table
            v-if="showRouteSteps"
            :columns="routeStepColumns"
            :data-source="routeStepRows"
            :pagination="false"
            size="small"
            :scroll="{ x: 1200 }"
            row-key="key"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'progress'">
                <a-tag :color="record.progressColor">{{ record.progressLabel }}</a-tag>
                <span v-if="record.stageStepNo" class="muted route-stage-ref"
                  >阶段 {{ record.stageStepNo }}</span
                >
              </template>
              <template v-else-if="column.key === 'occupy'">
                <a-tag v-if="record.occupyStatus" :color="record.occupyColor">{{
                  record.occupyStatus
                }}</a-tag>
                <span v-else>—</span>
                <div v-if="record.occupiedBatchNo" class="muted route-occupy-batch">
                  {{ record.occupiedBatchNo }}
                </div>
              </template>
              <template v-else-if="column.key === 'deviceStatus'">
                <a-tag v-if="record.deviceStatus" :color="record.deviceStatusColor">{{
                  record.deviceStatus
                }}</a-tag>
                <span v-else>—</span>
              </template>
              <template v-else-if="column.key === 'assay'">
                <template v-if="record.assayItems.length">
                  <div
                    v-for="(item, idx) in record.assayItems"
                    :key="`${record.key}-assay-${idx}`"
                    class="route-assay-line"
                  >
                    <span>{{ item.typeLabel }}</span>
                    <a-tag :color="item.hardGate ? 'warning' : 'default'" class="route-gate-tag">{{
                      item.gateLabel
                    }}</a-tag>
                  </div>
                </template>
                <span v-else>—</span>
              </template>
              <template v-else-if="column.key === 'gate'">
                <a-tag v-if="record.gateLabel !== '—'" :color="record.gateColor">{{
                  record.gateLabel
                }}</a-tag>
                <span v-else>—</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-tooltip
                  v-if="record.stageStep && order.status === 'running'"
                  :title="stepConfirmListBlockTip(record.stageStep)"
                >
                  <span class="step-confirm-btn-wrap">
                    <a-button
                      type="link"
                      size="small"
                      :disabled="stepConfirmListBlocked(record.stageStep)"
                      @click="openStep(record.stageStep)"
                      >打开阶段</a-button
                    >
                  </span>
                </a-tooltip>
              </template>
            </template>
          </a-table>
          <a-table
            v-else
            :columns="unitColumns"
            :data-source="unitRows"
            :pagination="false"
            size="small"
            row-key="key"
            :locale="{ emptyText: '未指定工艺路线' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'occupy'">
                <a-tag v-if="record.occupyStatus" :color="record.occupyColor">{{
                  record.occupyStatus
                }}</a-tag>
                <span v-else>—</span>
                <div v-if="record.occupiedBatchNo" class="muted route-occupy-batch">
                  {{ record.occupiedBatchNo }}
                </div>
              </template>
              <template v-else-if="column.key === 'deviceStatus'">
                <a-tag v-if="record.deviceStatus" :color="record.deviceStatusColor">{{
                  record.deviceStatus
                }}</a-tag>
                <span v-else>—</span>
              </template>
            </template>
          </a-table>
        </DetailSectionCard>
      </div>

      <div v-show="detailTab === 'feed'" class="batch-tab-pane">
        <div class="filter-card feed-tab-filter">
          <a-form layout="inline" class="filter-form horizontal-form">
            <ListFilterBar
              :field-count="3"
              search-text="搜索"
              reset-text="重置"
              @search="applyFeedTabFilter"
              @reset="resetFeedTabFilter"
            >
              <a-form-item label="阶段">
                <a-select
                  v-model:value="feedTabFilter.stepNo"
                  allow-clear
                  size="small"
                  placeholder="全部阶段"
                  style="width: 100%"
                  :options="feedTabStageOptions"
                />
              </a-form-item>
              <a-form-item label="物料名称">
                <a-input
                  v-model:value="feedTabFilter.itemName"
                  allow-clear
                  size="small"
                  placeholder="请输入"
                  @press-enter="applyFeedTabFilter"
                />
              </a-form-item>
              <a-form-item label="物料编号">
                <a-input
                  v-model:value="feedTabFilter.itemCode"
                  allow-clear
                  size="small"
                  placeholder="请输入"
                  @press-enter="applyFeedTabFilter"
                />
              </a-form-item>
            </ListFilterBar>
          </a-form>
        </div>

        <template v-if="filteredFeedStageGroups.length">
          <DetailSectionCard
            v-for="stage in filteredFeedStageGroups"
            :key="stage.key"
            :title="stage.title"
            :default-collapsed="stage.defaultCollapsed"
          >
            <template #extra>
              <div class="feed-stage-meta">
                <span>物料 {{ stage.materialCount }}</span>
                <span>理论 {{ stage.planQtyText }}</span>
                <span>实投 {{ stage.postedQtyText }}</span>
                <span>过账 {{ stage.postingCount }} 次</span>
              </div>
            </template>
            <div class="feed-stage-body">
              <div v-for="row in stage.materials" :key="row.key" class="feed-material-card">
                <div class="feed-material-head">
                  <div class="feed-material-main">
                    <div class="feed-material-name">
                      <span class="name">{{ row.item }}</span>
                      <a-tag v-if="row.isExtra" color="orange" size="small">补加</a-tag>
                      <a-tag v-if="row.keyText === '是'" color="blue" size="small">关键</a-tag>
                      <a-tag v-if="row.auxText === '是'" size="small">辅料</a-tag>
                    </div>
                    <div class="feed-material-sub">
                      <span>{{ row.itemCode }}</span>
                      <span v-if="row.specText !== '—'">{{ row.specText }}</span>
                      <span>理论 {{ row.planQtyText }}</span>
                      <span v-if="row.toleranceText !== '—'">允差 {{ row.toleranceText }}</span>
                    </div>
                  </div>
                  <div class="feed-material-metrics">
                    <div class="metric">
                      <i>实投</i><b>{{ row.postedText }}</b>
                    </div>
                    <div class="metric">
                      <i>偏差</i><b>{{ row.gapText }}</b>
                    </div>
                    <div class="metric">
                      <i>过账</i><b>{{ row.postings.length }}</b>
                    </div>
                  </div>
                </div>
                <div v-if="row.postings.length" class="feed-posting-block">
                  <div class="feed-posting-toolbar">
                    <span class="feed-posting-label">过账记录（{{ row.postings.length }}）</span>
                    <a-button type="link" size="small" @click="toggleFeedPostingExpand(row.key)">
                      {{ isFeedPostingExpanded(row.key) ? '收起 ▴' : '展开 ▾' }}
                    </a-button>
                  </div>
                  <a-table
                    v-show="isFeedPostingExpanded(row.key)"
                    class="feed-posting-table"
                    :columns="feedPostingColumns"
                    :data-source="row.postings"
                    :pagination="false"
                    size="small"
                    row-key="key"
                    :scroll="{ x: 1100 }"
                  >
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'seq'">{{ record.seq }}</template>
                      <template v-else-if="column.key === 'feedSource'">
                        <a-tag v-if="record.feedSourceLabel !== '—'" color="processing">
                          {{ record.feedSourceLabel }}
                        </a-tag>
                        <span v-else>—</span>
                      </template>
                      <template v-else-if="column.key === 'deductMode'">
                        <a-tag
                          v-if="record.deductModeLabel !== '—'"
                          :color="record.deductModeColor"
                        >
                          {{ record.deductModeLabel }}
                        </a-tag>
                        <span v-else>—</span>
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
                      <template v-else-if="column.key === 'content'">
                        <span>{{ record.contentText }}</span>
                        <a-button
                          v-if="record.contentPending && order.status === 'running'"
                          type="link"
                          size="small"
                          @click="openFeedContentPatch(record)"
                        >
                          补录有效含量
                        </a-button>
                      </template>
                    </template>
                  </a-table>
                </div>
                <div v-else class="feed-empty">本阶段该物料还没有过账</div>
              </div>
            </div>
          </DetailSectionCard>
        </template>
        <DetailSectionCard v-else title="投料明细">
          <a-empty
            :description="feedStageGroups.length ? '没有符合筛选条件的投料明细' : '配方未维护投料'"
          />
        </DetailSectionCard>
      </div>

      <div v-show="detailTab === 'assay'" class="batch-tab-pane">
        <DetailSectionCard title="取样、检验与放行">
          <p class="section-hint">
            过程检执行清单（投料前核对、中控取样、转序放行等）。「实测」为检验项录入值摘要；「化验结果」为整单结论。「工序设备」取自工艺阶段；「取样位置」在发起时可填（非必填）。
          </p>
          <a-table
            :columns="assayColumns"
            :data-source="assayRows"
            :pagination="false"
            size="small"
            row-key="key"
            :locale="{ emptyText: '还没有过程检' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'seq'">{{ record.seq }}</template>
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
              <template v-else-if="column.key === 'gate'">
                <a-tag v-if="record.hardGate" color="warning">硬门禁</a-tag>
                <a-tag v-else>记录</a-tag>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.statusColor">{{ record.statusLabel }}</a-tag>
              </template>
              <template v-else-if="column.key === 'actual'">
                <span :title="record.actualFull || record.actual">{{ record.actual }}</span>
              </template>
              <template v-else-if="column.key === 'judge'">
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
            </template>
          </a-table>
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
      </div>

      <div v-show="detailTab === 'output'" class="batch-tab-pane">
        <!-- 异常偏差属整单产出说明，与登记同源，产出 Tab 同步展示便于对照追溯 -->
        <DetailSectionCard title="异常偏差">
          <a-row :gutter="[24, 8]" class="drawer-basic-info">
            <a-col :span="24">
              <span class="info-label">最新说明：</span>
              <span class="info-value">{{ order.deviation || '—' }}</span>
              <a-button
                v-if="(order.deviationLogs || []).length > 1"
                type="link"
                size="small"
                @click="deviationLogsOpen = true"
              >
                历史 ({{ order.deviationLogs.length }})
              </a-button>
            </a-col>
          </a-row>
          <p class="section-hint" style="margin-top: 8px; margin-bottom: 0">
            在「产出登记」时可补充；留空不改历史，填写则追加一条并更新最新说明。
          </p>
        </DetailSectionCard>

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
              <template v-if="column.key === 'seq'">{{ record.seq }}</template>
              <template v-else-if="column.key === 'inbound'">
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
          <p class="section-hint">
            「处理状态」表示去向是否落地（待处理 / 待入库 / 已入库 /
            待回用等）；「检单状态」为产出化验进度。入仓库与入储罐均生成生产入库单，须仓管确认后才可发货或普通投料；硬门禁另须化验合格。批令不再做成品放行。
          </p>
          <a-table
            :columns="outColumns"
            :data-source="outRows"
            :pagination="false"
            size="small"
            :scroll="{ x: 1820 }"
            :row-key="outputRowKey"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'seq'">{{ record.seq }}</template>
              <template v-else-if="column.key === 'handleStatus'">
                <a-tag :color="record.handleStatusColor">{{ record.handleStatusLabel }}</a-tag>
              </template>
              <template v-else-if="column.key === 'content'">
                <span>{{ record.contentText }}</span>
                <a-button
                  v-if="record.contentPending && order.status === 'running'"
                  type="link"
                  size="small"
                  @click="openOutputContentPatch(record)"
                >
                  补录有效含量
                </a-button>
              </template>
              <template v-else-if="column.key === 'assayGate'">
                <a-tag v-if="record.assayHardGate" color="warning">硬门禁</a-tag>
                <a-tag v-else>记录</a-tag>
              </template>
              <template v-else-if="column.key === 'qcTaskStatus'">
                <a-tag v-if="record.qcTaskStatusLabel !== '—'" :color="record.qcTaskStatusColor">{{
                  record.qcTaskStatusLabel
                }}</a-tag>
                <span v-else>—</span>
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
              <template v-else-if="column.key === 'inbound'">
                <template v-if="record.inboundLinks?.length">
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
              <template v-else-if="column.key === 'action'">
                <a-button
                  v-if="record.handleStatus === 'await_decide'"
                  type="link"
                  size="small"
                  :disabled="record.decideDisabled"
                  :title="record.decideDisabledReason"
                  @click="openDecideDisposition(record)"
                  >确认去向</a-button
                >
                <a-button
                  v-else-if="
                    record.handleStatus === 'await_reextract' && Number(record.remainQty) > 0
                  "
                  type="link"
                  size="small"
                  @click="openReextract(record)"
                  >开再提指令</a-button
                >
                <a-button
                  v-if="record.canSpawnBranch"
                  type="link"
                  size="small"
                  @click="spawnBranchOrder(record)"
                  >开支线指令</a-button
                >
                <a-button
                  v-else-if="record.branchBatchNo"
                  type="link"
                  size="small"
                  @click="goBatchOrder(record.branchOrderId)"
                  >支线 {{ record.branchBatchNo }}</a-button
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

    <!-- 多下游配方时：开支线前先选要用哪张 -->
    <a-modal
      :open="spawnBranchOpen"
      title="选择下游配方"
      :width="520"
      :mask-closable="false"
      destroy-on-close
      @cancel="closeSpawnBranchModal"
    >
      <div class="modal-basic-card">
        <div class="section-title">支线配方</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="24">
              <a-form-item label="下游配方" required>
                <a-select
                  v-model:value="spawnBranchFormulaId"
                  size="small"
                  show-search
                  option-filter-prop="label"
                  :options="spawnBranchFormulaOptions"
                  placeholder="请选择本次下游配方"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </div>
      <template #footer>
        <a-button @click="closeSpawnBranchModal">取消</a-button>
        <a-button type="primary" :loading="spawnBranchSaving" @click="confirmSpawnBranchModal"
          >生成支线指令</a-button
        >
      </template>
    </a-modal>

    <a-modal
      :open="stepOpen"
      :title="stepConfirmModalTitle"
      width="min(1200px, 94vw)"
      wrap-class-name="batch-step-confirm-modal-wrap"
      :mask-closable="false"
      destroy-on-close
      :ok-button-props="{ disabled: stepConfirmSubmitBlocked }"
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
      <a-alert
        v-if="stepConfirmNoEquipmentCandidates"
        class="prior-assay-hint"
        type="warning"
        show-icon
        message="本步没有候选设备。请先在配方阶段或「指定下发」维护候选设备后再确认。"
      />
      <div v-if="stepConfirmAssayChecklist.length" class="modal-basic-card step-report-card">
        <div class="section-title">本步化验清单</div>
        <p class="section-hint">
          硬门禁项须合格后才能确认本步；「记录」项可后补，不挡确认。产出检请在「产出」过账时发起。取样位置按化验类型选填，点「发起」时写入对应检单。
        </p>
        <p class="section-meta">执行设备：{{ stepConfirmEquipmentText }}</p>
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
            <template v-else-if="column.key === 'sampleLocation'">
              <a-input
                v-if="record.canStart"
                v-model:value="assaySampleLocationByScheme[record.schemeId]"
                size="small"
                allow-clear
                placeholder="选填"
              />
              <span v-else>{{ record.sampleLocation || '—' }}</span>
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
                :loading="assayStartingId === record.schemeId"
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
          实投量与有效含量在「投料」过账中填写并扣库存；此处仅汇总，过程记录模板不再采集实投。
        </p>
        <a-table
          :columns="stepFeedSummaryColumns"
          :data-source="stepFeedSummary"
          :pagination="false"
          size="small"
          row-key="key"
        />
      </div>

      <a-alert
        v-if="stepConfirmSequenceBlocked"
        class="prior-assay-hint"
        type="warning"
        show-icon
        :message="stepConfirmSequenceMessage"
      />
      <a-alert
        v-if="stepConfirmFeedBlocked"
        class="prior-assay-hint"
        type="warning"
        show-icon
        message="本步计划投料尚未过账，确认已禁用。请先点「投料」完成后再确认本步。"
      />
      <div class="modal-basic-card step-report-card">
        <div class="section-title">工艺参数</div>
        <p class="section-hint">本步已配置的参数须填写，且落在上下限内；确认时会校验。</p>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col v-for="(field, index) in currentParams" :key="field.key" :span="6">
              <a-form-item :label="paramLabel(field)" required>
                <a-input-number
                  v-model:value="stepActuals[index]"
                  size="small"
                  style="width: 100%"
                  :min="field.min != null && field.min !== '' ? Number(field.min) : undefined"
                  :max="field.max != null && field.max !== '' ? Number(field.max) : undefined"
                  :placeholder="paramPlaceholder(field)"
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
          操作人、操作时间默认带出当前登录人与打开时间，可改（事后补录）；执行设备须从本步候选中选一台；出料量、备注选填。
        </p>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="6">
              <a-form-item label="操作人" required>
                <a-input
                  v-model:value="formValues.OP_OPERATOR"
                  size="small"
                  placeholder="可改，便于补录"
                />
              </a-form-item>
            </a-col>
            <a-col :span="6">
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
              <a-form-item label="执行设备" required>
                <a-select
                  v-model:value="stepExecEquipmentId"
                  size="small"
                  allow-clear
                  show-search
                  option-filter-prop="label"
                  placeholder="从候选中选择"
                  :options="stepEquipmentOptions"
                  :disabled="!stepEquipmentCandidates.length"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :span="6">
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
      width="min(1600px, 96vw)"
      wrap-class-name="batch-feed-modal-wrap"
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
        <p class="section-hint">{{ feedSourceHint }}</p>
      </div>

      <div class="feed-lines-title">投料明细</div>
      <p v-if="feedHasConvertByContent" class="section-hint feed-assay-hint">
        按含量折算物料：「指导量」= 目标有效量 ÷
        批次含量（只读对照）；选批后会预填实投量，可改。理论量仍按配方假定含量。
      </p>
      <a-table
        :columns="feedDraftColumns"
        :data-source="feedLineDrafts"
        :pagination="false"
        size="small"
        bordered
        row-key="key"
        :scroll="{ x: 1900, y: 360 }"
        :row-class-name="(record) => (record.included === false ? 'draft-row-skipped' : '')"
        :locale="{ emptyText: '本阶段没有计划投料，可勾选补加或换阶段' }"
      >
        <template #headerCell="{ column }">
          <template v-if="column.key === 'included'">
            <a-checkbox
              :checked="feedIncludeHeaderChecked"
              :indeterminate="feedIncludeHeaderIndeterminate"
              :disabled="!feedLineDrafts.length"
              @change="(e) => onFeedIncludeCheckAll(e?.target?.checked)"
            >
              本次
            </a-checkbox>
          </template>
          <template v-else>{{ column.title }}</template>
        </template>
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'included'">
            <div class="draft-include-cell">
              <a-checkbox
                :checked="record.included !== false"
                @change="(e) => (record.included = Boolean(e?.target?.checked))"
              />
            </div>
          </template>
          <template v-else-if="column.key === 'index'">{{ index + 1 }}</template>
          <template v-else-if="column.key === 'feedSource'">
            <a-select
              v-model:value="record.feedSource"
              size="small"
              style="width: 100%"
              :options="feedSourceOptions"
              :disabled="record.included === false"
              @change="(val) => onFeedRowSourceChange(record, val)"
            />
          </template>
          <template v-else-if="column.key === 'feedLocation'">
            <a-select
              v-if="needsFeedSourceLocation(record)"
              v-model:value="record.locationId"
              size="small"
              allow-clear
              show-search
              option-filter-prop="label"
              :popup-match-select-width="false"
              :dropdown-style="{ minWidth: '360px' }"
              style="width: 100%"
              :options="feedLocationOptionsForItem(record.itemId, record.feedSource)"
              :placeholder="rowFifoOnly(record) ? '边搜边选库位/储罐' : '未选批时边搜边选库位/储罐'"
              :disabled="record.included === false"
            >
              <template #dropdownRender="{ menuNode: menu }">
                <div>
                  <component :is="menu" />
                  <a-divider style="margin: 4px 0" />
                  <div
                    class="search-more-row"
                    :class="{ 'is-disabled': record.included === false }"
                    @mousedown.prevent
                    @click="record.included !== false && openFeedLocationPicker(record)"
                  >
                    选择更多
                  </div>
                </div>
              </template>
            </a-select>
            <span v-else class="muted">{{ feedLocationFollowText(record) }}</span>
          </template>
          <template v-else-if="column.key === 'batchId'">
            <a-select
              v-if="showFeedBatchSelect(record)"
              :value="feedBatchSelectValue(record)"
              mode="multiple"
              size="small"
              allow-clear
              show-search
              option-filter-prop="label"
              :max-tag-count="1"
              style="width: 100%"
              :options="batchOptionsForItem(record.itemId, record.feedSource)"
              :placeholder="feedBatchPlaceholder(record)"
              :disabled="record.included === false"
              @change="(val) => onFeedBatchSelectChange(record, val)"
            >
              <template #dropdownRender="{ menuNode: menu }">
                <div>
                  <component :is="menu" />
                  <a-divider style="margin: 4px 0" />
                  <div
                    class="search-more-row"
                    :class="{ 'is-disabled': record.included === false }"
                    @mousedown.prevent
                    @click="record.included !== false && openFeedBatchPicker(record)"
                  >
                    搜索更多（可多选）
                  </div>
                </div>
              </template>
            </a-select>
            <span v-else class="muted">按库位近效先出</span>
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
              :disabled="record.included === false"
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
              :disabled="record.included === false"
              @change="() => onFeedContentPctChange(record)"
            />
          </template>
          <template v-else-if="column.key === 'guideQty'">
            <span :class="{ 'feed-guide-qty': record.convertByContent }">
              {{ feedGuideQtyText(record) }}
            </span>
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

      <div class="feed-history-block">
        <div class="feed-lines-title feed-history-title">
          <span
            >本阶段投料记录{{
              feedModalHistoryRows.length ? `（${feedModalHistoryRows.length}）` : ''
            }}</span
          >
          <a-button type="link" size="small" @click="feedHistoryCollapsed = !feedHistoryCollapsed">
            {{ feedHistoryCollapsed ? '展开 ▾' : '收起 ▴' }}
          </a-button>
        </div>
        <a-table
          v-show="!feedHistoryCollapsed"
          class="feed-modal-history-table"
          :columns="feedModalHistoryColumns"
          :data-source="feedModalHistoryRows"
          :pagination="false"
          size="small"
          bordered
          row-key="key"
          :scroll="{ y: 260 }"
          :locale="{ emptyText: '本阶段还没有过账记录' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'seq'">{{ record.seq }}</template>
            <template v-else-if="column.key === 'feedSource'">
              <a-tag v-if="record.feedSourceLabel !== '—'" color="processing">
                {{ record.feedSourceLabel }}
              </a-tag>
              <span v-else>—</span>
            </template>
            <template v-else-if="column.key === 'deductMode'">
              <a-tag v-if="record.deductModeLabel !== '—'" :color="record.deductModeColor">
                {{ record.deductModeLabel }}
              </a-tag>
              <span v-else>—</span>
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
            <template v-else-if="column.key === 'content'">
              <span>{{ record.contentText }}</span>
              <a-button
                v-if="record.contentPending && order.status === 'running'"
                type="link"
                size="small"
                @click="openFeedContentPatch(record)"
              >
                补录有效含量
              </a-button>
            </template>
          </template>
        </a-table>
      </div>
    </a-modal>

    <SelectMaterialBatchModal
      v-model:open="feedBatchPickerOpen"
      :item-id="feedBatchPickerRow?.itemId || ''"
      :unit-label="feedBatchPickerRow?.unit || 'kg'"
      :order="order"
      :feed-source="feedBatchPickerRow?.feedSource || 'fresh'"
      :selected-ids="feedBatchPickerSelectedIds"
      @selected="onFeedBatchesPicked"
    />

    <SelectFeedLocationModal
      v-model:open="feedLocationPickerOpen"
      :item-id="feedLocationPickerRow?.itemId || ''"
      :unit-label="feedLocationPickerRow?.unit || 'kg'"
      :order="order"
      :feed-source="normalizeRowFeedSource(feedLocationPickerRow?.feedSource)"
      :selected-id="feedLocationPickerRow?.locationId || ''"
      @selected="onFeedLocationPicked"
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
          下列为过程检清单（投料前核对、中控取样、转序放行）。硬门禁未合格不能确认本步；记录项可多次取样。产出检请在本步「产出」过账时按产出行勾选并发起。取样位置按化验类型选填，点「发起」时写入对应检单。
        </p>
        <p class="section-meta">工序设备：{{ assayEquipmentText }}</p>
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
            <template v-else-if="column.key === 'sampleLocation'">
              <a-input
                v-if="record.canStart"
                v-model:value="assaySampleLocationByScheme[record.schemeId]"
                size="small"
                allow-clear
                placeholder="选填"
              />
              <span v-else>{{ record.sampleLocation || '—' }}</span>
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
      title="产出登记"
      :width="outputModalWidth"
      :mask-closable="false"
      destroy-on-close
      wrap-class-name="output-register-modal-wrap"
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
              <a-form-item label="当前异常偏差">
                <span class="info-value">{{ order.deviation || '—' }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="补充异常偏差">
                <a-input
                  v-model:value="deviation"
                  size="small"
                  allow-clear
                  placeholder="可选：有新情况再填；将追加到整单记录，不覆盖历史"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <p class="section-hint">
          异常偏差属整单说明：本次留空不影响已有记录；填写则追加一条并更新「最新」展示。默认全部勾选「本次」，取消后该行置灰跳过。硬门禁须先「待判定」再确认最终去向。
        </p>
      </div>

      <div class="feed-lines-title">本次登记</div>
      <a-table
        :columns="expectColumns"
        :data-source="outputDrafts"
        :pagination="false"
        size="small"
        bordered
        row-key="key"
        :scroll="{ x: 1480 }"
        :row-class-name="(record) => (record.included === false ? 'draft-row-skipped' : '')"
        :locale="{ emptyText: '本阶段没有计划产出，可勾选补加或换阶段' }"
      >
        <template #headerCell="{ column }">
          <template v-if="column.key === 'included'">
            <a-checkbox
              :checked="outputIncludeHeaderChecked"
              :indeterminate="outputIncludeHeaderIndeterminate"
              :disabled="!outputDrafts.length"
              @change="(e) => onOutputIncludeCheckAll(e?.target?.checked)"
            >
              本次
            </a-checkbox>
          </template>
          <template v-else-if="column.key === 'inboundQc'">
            <!-- 勾选与文案拆开，避免窄列把「产出化验」截成「产出」 -->
            <div class="output-assay-header">
              <a-checkbox
                :checked="outputAssayHeaderChecked"
                :indeterminate="outputAssayHeaderIndeterminate"
                :disabled="!outputAssayToggleableRows.length"
                @change="(e) => onOutputAssayCheckAll(e?.target?.checked)"
              />
              <span class="output-assay-header-text">产出化验</span>
            </div>
          </template>
          <template v-else>{{ column.title }}</template>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'included'">
            <div class="draft-include-cell">
              <a-checkbox
                :checked="record.included !== false"
                @change="(e) => (record.included = Boolean(e?.target?.checked))"
              />
            </div>
          </template>
          <template v-else-if="column.key === 'disposition'">
            <a-select
              v-model:value="record.disposition"
              size="small"
              style="width: 100%"
              :options="outputDispositionOptionsFor(record.role, record.itemId)"
              placeholder="请选择"
              :disabled="record.included === false"
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
              :disabled="record.included === false"
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
              placeholder="实产"
              :disabled="record.included === false"
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
              :placeholder="record.contentFromAssay ? '已从化验带出' : '选填/可后补'"
              :disabled="record.included === false"
            />
          </template>
          <template v-else-if="column.key === 'inboundQc'">
            <!-- 勾选与文案拆开，避免窄列把「发起化验」截成「发起」 -->
            <div class="output-assay-cell">
              <div class="output-assay-row">
                <a-checkbox
                  :checked="(record.assayScopes || []).includes('成品检')"
                  :disabled="record.assayLocked || record.included === false"
                  @change="(e) => onOutputAssayCheck(record, e?.target?.checked)"
                />
                <span class="output-assay-label">{{
                  record.assayLocked ? '配方必检' : '发起化验'
                }}</span>
              </div>
              <div
                v-if="
                  (record.assayScopes || []).includes('成品检') && hasExistingOutputAssay(record)
                "
                class="output-assay-row"
              >
                <a-checkbox
                  v-model:checked="record.forceNewAssay"
                  :disabled="record.included === false"
                />
                <span class="output-assay-label">强制新建</span>
              </div>
              <span
                v-if="record.hasCompletedAssay && !(record.assayScopes || []).includes('成品检')"
                class="muted"
              >
                已有完成检单，可不发起
              </span>
            </div>
          </template>
        </template>
      </a-table>

      <div class="feed-history-block">
        <div class="feed-lines-title feed-history-title">
          <span
            >本阶段已登记明细{{
              outputModalHistoryRows.length ? `（${outputModalHistoryRows.length}）` : ''
            }}</span
          >
          <a-button
            type="link"
            size="small"
            @click="outputHistoryCollapsed = !outputHistoryCollapsed"
          >
            {{ outputHistoryCollapsed ? '展开 ▾' : '收起 ▴' }}
          </a-button>
        </div>
        <a-table
          v-show="!outputHistoryCollapsed"
          class="feed-modal-history-table"
          :columns="outputModalHistoryColumns"
          :data-source="outputModalHistoryRows"
          :pagination="false"
          size="small"
          bordered
          row-key="key"
          :scroll="{ x: 1100, y: 240 }"
          :locale="{ emptyText: '本阶段还没有登记记录' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'seq'">{{ record.seq }}</template>
            <template v-else-if="column.key === 'content'">
              <span>{{ record.contentText }}</span>
              <a-button
                v-if="record.contentPending && order.status === 'running'"
                type="link"
                size="small"
                @click="openOutputContentPatch(record)"
              >
                补录有效含量
              </a-button>
            </template>
            <template v-else-if="column.key === 'qcTaskStatus'">
              <a-tag v-if="record.qcTaskStatusLabel !== '—'" :color="record.qcTaskStatusColor">{{
                record.qcTaskStatusLabel
              }}</a-tag>
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
          </template>
        </a-table>
      </div>

      <div class="output-qc-list-block">
        <div class="feed-lines-title feed-history-title">
          <span
            >关联产出化验单{{
              outputRelatedQcRows.length ? `（${outputRelatedQcRows.length}）` : ''
            }}</span
          >
        </div>
        <a-table
          :columns="outputRelatedQcColumns"
          :data-source="outputRelatedQcRows"
          :pagination="false"
          size="small"
          bordered
          row-key="key"
          :locale="{ emptyText: '本阶段暂无关联产出化验单；勾选「发起产出化验」并确认后生成' }"
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
      :open="deviationLogsOpen"
      title="异常偏差历史"
      :width="520"
      :footer="null"
      destroy-on-close
      @cancel="deviationLogsOpen = false"
    >
      <a-timeline v-if="(order.deviationLogs || []).length">
        <a-timeline-item
          v-for="(log, idx) in [...(order.deviationLogs || [])].reverse()"
          :key="idx"
        >
          <div class="deviation-log-meta">
            <span>{{ log.at || '—' }}</span>
            <span v-if="log.operator"> · {{ log.operator }}</span>
          </div>
          <div class="deviation-log-text">{{ log.text || '—' }}</div>
        </a-timeline-item>
      </a-timeline>
      <a-empty v-else description="暂无历史记录" />
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
          硬门禁（已挂产出化验）：未出结果或不合格时，不能确认回用 / 再提 / 入仓库 /
          入储罐，仅可废弃或继续待判定。未挂产出化验（记录）可先确认去向。
        </p>
      </div>
    </a-modal>
    <a-modal
      :open="feedContentPatchOpen"
      title="补录投料有效含量"
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
              <a-form-item label="有效含量" required>
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
                  placeholder="请输入有效含量"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <p class="section-hint">
          可手填；也可等过程检带有效含量字段完成后再自动回填。两种方式不互斥。
        </p>
      </div>
    </a-modal>
    <a-modal
      :open="outputContentPatchOpen"
      title="补录产出有效含量"
      :width="400"
      :mask-closable="false"
      destroy-on-close
      ok-text="保存"
      :confirm-loading="outputContentPatchSaving"
      @cancel="closeOutputContentPatch"
      @ok="saveOutputContentPatch"
    >
      <div class="modal-basic-card">
        <div class="section-title">基本信息</div>
        <a-form layout="inline" class="horizontal-form">
          <a-row :gutter="[12, 8]" style="width: 100%">
            <a-col :span="24">
              <a-form-item label="批次">
                <span>{{ outputContentPatch.batchNo || '—' }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="有效含量" required>
                <a-input-number
                  v-model:value="outputContentPatch.contentPct"
                  size="small"
                  :min="0"
                  :max="100"
                  :step="0.01"
                  :formatter="inputNumberFormatter"
                  :parser="inputNumberParser"
                  style="width: 100%"
                  addon-after="%"
                  placeholder="请输入有效含量"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
        <p class="section-hint">
          可手填；也可等产出化验带有效含量字段完成后再自动回填。两种方式不互斥。
        </p>
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
import ListFilterBar from '@/components/ListFilterBar.vue'
import { useFormCreatePage } from '@/composables/useFormCreatePage'
import { useTabs } from '@/composables/useTabs'
import { formatOperatorLabel } from '@/utils/operationLog'
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
import {
  allocateSuggestedFeedQtys,
  contentAsFraction,
  round3,
  suggestActualFeedQty,
} from '@/utils/processBatchMath'
import { isSameBatchBranchSkipEnabled } from '@/store/functionParamStore'
import { canToggleStepEnabled } from '@/utils/batchStageEnable'
import { canSpawnBranchFromOutput, listDownstreamFormulaIds } from '@/utils/outputDownstreamSpawn'
import {
  ORDER_STATUS_LABEL,
  cancelBatchOrder,
  allRouteStepsConfirmed,
  completeOrder,
  confirmOutputDisposition,
  deletePendingOrder,
  completionErrors,
  confirmStep,
  setBatchStepEnabled,
  stepFeedConfirmErrors,
  stepParamConfirmErrors,
  stepSequenceConfirmErrors,
  createBranchOrderFromOutput,
  createReextract,
  getBatchOrder,
  getStepQcLink,
  getStepQcRecords,
  isOutputAssayHardGate,
  backfillFeedContentFromAssay,
  backfillOutputContentFromAssay,
  extractContentFractionFromQcTask,
  postFeeds,
  postOutput,
  releaseOrder,
  resolveStepEquipmentCandidates,
} from '@/store/batchInstructionStore'
import { getProcessById, resolveDefaultExecutors } from '@/store/processConfigStore'
import { deviceLabelById, equipmentState, getDeviceById } from '@/store/equipmentStore'
import { EQUIPMENT_OCCUPY_STATUS, EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
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
import { formatWorkCenterLabel } from '@/store/workCenterStore'
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
import { isQcConclusionField, isQcInspectRemarkField } from '@/utils/qcConclusionField'
import { formatFieldValueWithUnit } from '@/utils/qcFieldStandard'
import {
  getMaterialBatch,
  isProcessItemAllowWorkshopStaging,
  listFeedableBatches,
  listFeedSourceLocations,
  listMaterialBatches,
  listTanks,
  planFeedFifoAllocations,
} from '@/store/materialBatchStore'
import {
  PROCESS_FEED_DEDUCT_MODES,
  getFeedDeductModeForSource,
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
import SelectFeedLocationModal from '@/views/production/components/SelectFeedLocationModal.vue'
import { filterTemplateFieldsBeyondFixed } from '@/utils/stepConfirmFixedFields'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const { openTab } = useTabs()
const { goBack } = useFormCreatePage('/production/work-orders')
const order = computed(() => getBatchOrder(route.params.id))
const workCenterText = computed(() => {
  const current = order.value
  if (!current?.workCenterId) return '—'
  return formatWorkCenterLabel(current.workCenterId) || '—'
})

const unitColumns = [
  { title: '顺序', dataIndex: 'seq', width: 70, align: 'center' },
  { title: '设备', dataIndex: 'equipmentText', width: 200 },
  { title: '占釜状态', key: 'occupy', width: 140 },
  { title: '设备状态', key: 'deviceStatus', width: 100 },
]
const routeStepColumns = [
  { title: '列', dataIndex: 'stepNo', width: 56 },
  { title: '行', dataIndex: 'rowNo', width: 56 },
  { title: '工序', dataIndex: 'name', width: 120, ellipsis: true },
  { title: '设备', dataIndex: 'equipmentText', width: 160, ellipsis: true },
  { title: '回流', dataIndex: 'returnText', width: 80 },
  { title: '阶段进度', key: 'progress', width: 130 },
  { title: '占釜状态', key: 'occupy', width: 130 },
  { title: '设备状态', key: 'deviceStatus', width: 96 },
  { title: '化验', key: 'assay', width: 200 },
  { title: '工序门禁', key: 'gate', width: 96 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' },
]
const sameBatchBranchSkipEnabled = computed(() => isSameBatchBranchSkipEnabled())

const stepColumns = computed(() => {
  const cols = [
    { title: '序', dataIndex: 'stepNo', width: 56, align: 'center', fixed: 'left' },
    { title: '状态', key: 'done', width: 88, fixed: 'left' },
  ]
  if (sameBatchBranchSkipEnabled.value) {
    cols.push({ title: '本次启用', key: 'enabled', width: 100 })
  }
  cols.push(
    { title: '阶段', key: 'name', width: 168, ellipsis: true },
    { title: '设备', dataIndex: 'equipmentText', width: 150, ellipsis: true },
    { title: '岗位', dataIndex: 'positionText', width: 100, ellipsis: true },
    { title: '配方要求', dataIndex: 'limitText', width: 180, ellipsis: true },
    { title: '转序条件', dataIndex: 'transitionText', width: 140, ellipsis: true },
    { title: '化验', key: 'qc', width: 200 },
    { title: '实绩摘要', key: 'summary', width: 160 },
    { title: '产出', key: 'output', width: 160 },
    { title: '操作', key: 'action', width: 168, fixed: 'right' },
  )
  return cols
})
const assayColumns = [
  { title: '序号', key: 'seq', width: 56, align: 'center' },
  { title: '工序', dataIndex: 'point', width: 120, ellipsis: true },
  { title: '工序设备', dataIndex: 'equipmentText', width: 140, ellipsis: true },
  { title: '取样位置', dataIndex: 'sampleLocation', width: 120, ellipsis: true },
  { title: '检验方案', dataIndex: 'item', width: 130, ellipsis: true },
  { title: '类型', dataIndex: 'typeLabel', width: 96, ellipsis: true },
  { title: '门禁', key: 'gate', width: 88 },
  { title: '检单', key: 'qcNo', width: 140 },
  { title: '检单状态', key: 'status', width: 96 },
  { title: '发起时间', dataIndex: 'createdAt', width: 160 },
  { title: '实测', key: 'actual', width: 180, ellipsis: true },
  { title: '化验结果', key: 'judge', width: 100 },
  { title: '质检时间', dataIndex: 'inspectedAt', width: 160 },
  { title: '质检人', dataIndex: 'inspector', width: 100 },
]
const logColumns = [
  { title: '操作时间', dataIndex: 'operatedAt', width: 170 },
  { title: '操作', dataIndex: 'action', width: 140 },
  { title: '操作人', dataIndex: 'operator', width: 120 },
  { title: '说明', dataIndex: 'remark' },
]
const balanceColumns = [
  { title: '序号', key: 'seq', width: 56, align: 'center' },
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
  { title: '序号', key: 'seq', width: 56, align: 'center' },
  { title: '时间', dataIndex: 'at', width: 150 },
  { title: '执行人', dataIndex: 'operator', width: 90 },
  { title: '投料来源', key: 'feedSource', width: 100 },
  { title: '扣减方式', key: 'deductMode', width: 110 },
  { title: '原料批次', dataIndex: 'batchNo', width: 140 },
  { title: '化验单号', key: 'qcNo', width: 150 },
  { title: '来源库位', dataIndex: 'locationText', width: 130, ellipsis: true },
  { title: '本次实投', dataIndex: 'qtyText', align: 'right', width: 110 },
  { title: '有效含量', key: 'content', width: 130 },
]
const feedModalHistoryColumns = [
  { title: '序号', key: 'seq', width: 56, align: 'center' },
  { title: '时间', dataIndex: 'at', width: 140 },
  { title: '原料', dataIndex: 'item', width: 110, ellipsis: true },
  { title: '投料来源', key: 'feedSource', width: 100 },
  { title: '扣减方式', key: 'deductMode', width: 110 },
  { title: '原料批次', dataIndex: 'batchNo', width: 130 },
  { title: '化验单号', key: 'qcNo', width: 140 },
  { title: '来源库位', dataIndex: 'locationText', width: 120, ellipsis: true },
  { title: '本次实投', dataIndex: 'qtyText', align: 'right', width: 100 },
  { title: '有效含量', key: 'content', width: 120 },
  { title: '执行人', dataIndex: 'operator', width: 90 },
]
const feedDraftColumns = computed(() => {
  void functionParamState.params.processFeedDeductMode
  void functionParamState.params.processFeedDeductModeRecycle
  const cols = [
    // 表头勾选全选「本次」；取消勾选即跳过本行，不必清实投量
    { title: '本次', key: 'included', width: 72, align: 'center', fixed: 'left' },
    { title: '序号', key: 'index', width: 56, align: 'center', fixed: 'left' },
    { title: '原料', dataIndex: 'item', width: 120, ellipsis: true, fixed: 'left' },
    { title: '编号', dataIndex: 'itemCode', width: 110, ellipsis: true },
    { title: '规格', dataIndex: 'specText', width: 100, ellipsis: true },
  ]
  // 行级投料来源；再提单整单锁定，不展示切换
  if (!isReextractOrder.value) {
    cols.push({ title: '投料来源', key: 'feedSource', width: 120 })
  }
  cols.push(
    { title: '理论量', dataIndex: 'planQtyText', width: 110, align: 'right' },
    { title: '已投', dataIndex: 'postedText', width: 100, align: 'right' },
    { title: '原料批次', key: 'batchId', width: 280 },
    { title: '来源储罐/库位', key: 'feedLocation', width: 220 },
    { title: '实投量', key: 'qty', width: 140 },
    { title: '有效含量 (%)', key: 'content', width: 160 },
    // 指导量：按「目标有效量 ÷ 批次含量」算出的建议实投，只读对照，不替代手填实投
    { title: '指导量', key: 'guideQty', width: 150, align: 'right' },
    { title: '化验单号', key: 'qcNo', width: 140, ellipsis: true },
    { title: '检验结论', key: 'qcResult', width: 110 },
  )
  return cols
})
const stepFeedSummaryColumns = [
  { title: '原料', dataIndex: 'item', width: 140 },
  { title: '理论', dataIndex: 'planQty', width: 90, align: 'right' },
  { title: '已投', dataIndex: 'posted', width: 90, align: 'right' },
  { title: '有效含量', dataIndex: 'contentText', width: 90, align: 'right' },
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
  { title: '序号', key: 'seq', width: 56, align: 'center' },
  { title: '角色', dataIndex: 'roleLabel', width: 90 },
  { title: '物料', dataIndex: 'item', width: 160, ellipsis: true },
  { title: '阶段', dataIndex: 'stepText', width: 110 },
  { title: '批次号', dataIndex: 'batchNo', width: 150 },
  { title: '处理方式', dataIndex: 'dispositionLabel', width: 90 },
  { title: '去向位置', dataIndex: 'locationName', width: 110 },
  { title: '数量', dataIndex: 'qtyText', align: 'right', width: 100 },
  { title: '有效含量', key: 'content', width: 140, align: 'right' },
  { title: '剩余', dataIndex: 'remainText', align: 'right', width: 100 },
  { title: '处理状态', key: 'handleStatus', width: 100 },
  { title: '检单状态', key: 'qcTaskStatus', width: 100 },
  { title: '检验方案', dataIndex: 'assaySchemeText', width: 140, ellipsis: true },
  { title: '类型', dataIndex: 'assayTypeLabel', width: 100, ellipsis: true },
  { title: '门禁', key: 'assayGate', width: 88 },
  { title: '检验结论', key: 'inspectConclusion', width: 100 },
  { title: '化验单号', key: 'qcLinks', width: 160 },
  { title: '入库单号', key: 'inbound', width: 140 },
  { title: '操作', key: 'action', width: 140, fixed: 'right' },
]
const expectColumns = [
  { title: '本次', key: 'included', width: 72, align: 'center' },
  { title: '角色', dataIndex: 'roleLabel', width: 88 },
  { title: '物料名称', dataIndex: 'itemName', width: 140, ellipsis: true },
  { title: '编码', dataIndex: 'itemCode', width: 120, ellipsis: true },
  { title: '规格型号', dataIndex: 'specText', width: 120, ellipsis: true },
  { title: '预期', dataIndex: 'qtyText', align: 'right', width: 110 },
  { title: '已产', dataIndex: 'postedText', align: 'right', width: 110 },
  { title: '本次实产', key: 'actual', width: 140 },
  { title: '有效含量 (%)', key: 'content', width: 140 },
  { title: '处理方式', key: 'disposition', width: 120 },
  { title: '去向位置', key: 'location', width: 160 },
  // 表头自定义勾选「全选发起」见 #headerCell；minWidth 防止「产出化验」被挤没
  { title: '产出化验', key: 'inboundQc', width: 168, minWidth: 168 },
]
/** 弹窗内「本阶段已登记明细」列 */
const outputModalHistoryColumns = [
  { title: '序号', key: 'seq', width: 56, align: 'center' },
  { title: '时间', dataIndex: 'at', width: 140 },
  { title: '角色', dataIndex: 'roleLabel', width: 80 },
  { title: '物料名称', dataIndex: 'itemName', width: 140, ellipsis: true },
  { title: '编码', dataIndex: 'itemCode', width: 120, ellipsis: true },
  { title: '规格型号', dataIndex: 'specText', width: 120, ellipsis: true },
  { title: '批次号', dataIndex: 'batchNo', width: 150, ellipsis: true },
  { title: '处理方式', dataIndex: 'dispositionLabel', width: 90 },
  { title: '数量', dataIndex: 'qtyText', width: 100, align: 'right' },
  { title: '有效含量', key: 'content', width: 150 },
  { title: '检单状态', key: 'qcTaskStatus', width: 100 },
  { title: '化验单号', key: 'qcLinks', width: 140 },
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
  { title: '取样位置', key: 'sampleLocation', width: 140 },
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

/** 步骤齐了但仍执行中：展示未能自动关单的实时原因。 */
const completionBlockerList = computed(() => {
  const row = order.value
  if (!row || row.status !== 'running') return []
  if (!allRouteStepsConfirmed(row)) return []
  const live = completionErrors(row)
  if (live.length) return live
  return Array.isArray(row.completionBlockers) ? row.completionBlockers.filter(Boolean) : []
})
const completionBlockerVisible = computed(() => completionBlockerList.value.length > 0)
const completionBlockerDescription = computed(() =>
  completionBlockerList.value.map((text, index) => `${index + 1}. ${text}`).join('\n'),
)

const routeText = computed(() => {
  const route = order.value?.equipmentRoute
  if (!route?.routeId && !route?.routeName) return '—'
  return `${route.routeCode || ''} ${route.routeName || ''}`.trim() || '—'
})

function deviceOccupyMeta(equipmentId) {
  const device = equipmentId ? getDeviceById(equipmentId) : null
  if (!device) {
    return {
      occupyStatus: '',
      occupyColor: 'default',
      occupiedBatchNo: '',
      deviceStatus: '',
      deviceStatusColor: 'default',
    }
  }
  const occupy = device.occupyStatus || ''
  let occupyColor = 'default'
  if (occupy === EQUIPMENT_OCCUPY_STATUS.CLEAN) occupyColor = 'success'
  else if (occupy === EQUIPMENT_OCCUPY_STATUS.OCCUPIED) occupyColor = 'processing'
  else if (occupy === EQUIPMENT_OCCUPY_STATUS.WAIT_DISCHARGE) occupyColor = 'warning'
  let deviceStatusColor = 'default'
  if (device.status === EQUIPMENT_STATUS.IN_USE) deviceStatusColor = 'success'
  else if (device.status === EQUIPMENT_STATUS.REPAIRING) deviceStatusColor = 'error'
  else if (device.status === EQUIPMENT_STATUS.IDLE) deviceStatusColor = 'warning'
  return {
    occupyStatus: occupy || '—',
    occupyColor,
    occupiedBatchNo: device.occupiedBatchNo || '',
    deviceStatus: device.status || '—',
    deviceStatusColor,
  }
}

function matchRouteStageStep(routeStep, usedStepNos) {
  const snapshots = order.value?.routeSnapshot || []
  const name = String(routeStep?.name || '').trim()
  const equipmentId = String(routeStep?.equipmentId || '').trim()
  let hit = snapshots.find(
    (step) =>
      !usedStepNos.has(Number(step.stepNo)) &&
      String(step.name || '').trim() === name &&
      String(step.equipmentId || '').trim() === equipmentId,
  )
  if (!hit) {
    hit = snapshots.find(
      (step) => !usedStepNos.has(Number(step.stepNo)) && String(step.name || '').trim() === name,
    )
  }
  if (hit) usedStepNos.add(Number(hit.stepNo))
  return hit || null
}

function stageProgressMeta(stageStep) {
  if (!stageStep) return { progressLabel: '—', progressColor: 'default' }
  const stepNo = Number(stageStep.stepNo)
  const confirmed = (order.value?.confirmedSteps || []).includes(stepNo)
  if (confirmed) return { progressLabel: '已确认', progressColor: 'success' }
  if (order.value?.status !== 'running') {
    return { progressLabel: '未开始', progressColor: 'default' }
  }
  const pending = (order.value?.routeSnapshot || []).find(
    (step) => !(order.value?.confirmedSteps || []).includes(step.stepNo),
  )
  if (pending && Number(pending.stepNo) === stepNo) {
    return { progressLabel: '执行中', progressColor: 'processing' }
  }
  if (pending && Number(pending.stepNo) < stepNo) {
    return { progressLabel: '未开始', progressColor: 'default' }
  }
  return { progressLabel: '未开始', progressColor: 'default' }
}

function routeAssayGateMeta(stageStep) {
  if (!stageStep) {
    return { assayItems: [], gateLabel: '—', gateColor: 'default' }
  }
  const proc = stageStep.processId ? getProcessById(stageStep.processId) : null
  const gateMode = normalizeProcessGate(stageStep.gateMode || proc?.gateMode)
  const hardStep = gateMode === PROCESS_GATE_HARD
  const schemes = resolveAssaySchemesForStep(stageStep, proc).filter(isProcessAssayScheme)
  const assayItems = schemes.map((scheme) => {
    const hardGate = isAssaySchemeHardGate(scheme)
    return {
      typeLabel: assayTypeLabel(scheme.assayType, scheme.bizScope) || scheme.name || '化验',
      hardGate,
      gateLabel: hardGate ? '硬门禁' : '记录',
    }
  })
  return {
    assayItems,
    gateLabel: hardStep ? '硬门禁' : schemes.length ? '记录' : '—',
    gateColor: hardStep ? 'warning' : 'default',
  }
}

const unitRows = computed(() =>
  (order.value?.equipmentRoute?.units || []).map((unit, index) => {
    const occupy = deviceOccupyMeta(unit.equipmentId)
    return {
      key: `${unit.equipmentId || 'unit'}-${index}`,
      seq: index + 1,
      equipmentText: unit.equipmentName || '—',
      ...occupy,
    }
  }),
)
const routeStepRows = computed(() => {
  const usedStepNos = new Set()
  return (order.value?.equipmentRoute?.steps || []).map((step, index) => {
    const stageStep = matchRouteStageStep(step, usedStepNos)
    const occupy = deviceOccupyMeta(step.equipmentId)
    const progress = stageProgressMeta(stageStep)
    const assayGate = routeAssayGateMeta(stageStep)
    return {
      key: `${step.stepNo}-${step.rowNo}-${index}`,
      stepNo: step.stepNo,
      rowNo: step.rowNo,
      name: step.name || '—',
      equipmentText: step.equipmentName || '—',
      returnText: step.returnText || '—',
      stageStep,
      stageStepNo: stageStep?.stepNo || '',
      ...occupy,
      ...progress,
      ...assayGate,
    }
  })
})
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

/** 工艺阶段单元格：化验 / 实绩 / 产出 多项时默认收起只露 1 条 */
const stepCellExpandMap = reactive({})

function stepCellExpandKey(stepNo, kind) {
  return `${stepNo}:${kind}`
}

function isStepCellExpanded(stepNo, kind) {
  return Boolean(stepCellExpandMap[stepCellExpandKey(stepNo, kind)])
}

function toggleStepCellExpand(stepNo, kind) {
  const key = stepCellExpandKey(stepNo, kind)
  stepCellExpandMap[key] = !stepCellExpandMap[key]
}

function visibleStepCellItems(list, stepNo, kind) {
  const rows = Array.isArray(list) ? list : []
  if (!rows.length) return []
  if (rows.length === 1 || isStepCellExpanded(stepNo, kind)) return rows
  return rows.slice(0, 1)
}

/** 步骤实绩摘要：投料合计 + 工艺参数合并为一条；仅确认无数值时显示「已确认」；否则 — */
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
  if (params.length) {
    const text = params.map((row) => `${row.key || '参数'} ${row.value ?? '—'}`).join('；')
    lines.push({ label: '工艺参数', value: text })
  }
  return lines
}

function stepSummaryText(stepNo) {
  const lines = stepSummaryLines(stepNo)
  if (lines.length) return lines.map((line) => `${line.label} ${line.value}`).join('；')
  if (order.value?.confirmedSteps?.includes(stepNo)) return '已确认'
  return '—'
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

function feedSourceLabelOf(source, row) {
  if (source === 'recycle' || row?.isRecycle) return '回流料'
  if (source === 'reextract' || row?.isReextract) return '再提'
  if (source === 'fresh') return '线边新料'
  return '—'
}

function feedDeductModeMeta(row) {
  const mode = String(row?.deductMode || '').trim()
  if (mode === 'location_fifo') {
    return { label: '库位近效先出', color: 'cyan' }
  }
  if (mode === 'batch_pick') {
    return { label: '自主选批', color: 'blue' }
  }
  // 历史未落字段：含量待补录多半是库位 FEFO；其余按自主选批，避免空着
  if (row?.contentPending) {
    return { label: '库位近效先出', color: 'cyan' }
  }
  return { label: '自主选批', color: 'blue' }
}

function mapFeedPostingRow(row, feedIndex, { itemLabelText, unit, seq } = {}) {
  const loc = tankName(row.locationId)
  const deduct = feedDeductModeMeta(row)
  const batch = row.materialBatchId ? getMaterialBatch(row.materialBatchId) : null
  const qc = resolveBatchInspectInfo(batch)
  return {
    key: row.id || `${row.itemId || 'item'}-${row.materialBatchId || row.batchNo}-${feedIndex}`,
    feedId: row.id || '',
    seq: seq != null ? seq : feedIndex + 1,
    at: row.at || '—',
    operator: formatOperatorLabel(row.operator),
    item: itemLabelText || itemLabel(row.itemId) || '—',
    feedSource:
      row.feedSource || (row.isRecycle ? 'recycle' : row.isReextract ? 'reextract' : 'fresh'),
    feedSourceLabel: feedSourceLabelOf(row.feedSource, row),
    deductMode: row.deductMode || '',
    deductModeLabel: deduct.label,
    deductModeColor: deduct.color,
    batchNo: row.batchNo || '—',
    qcNo: qc.qcNo || '—',
    qcTaskId: qc.qcTaskId || '',
    locationText: loc !== '—' ? loc : '—',
    qtyText: formatQtyWithUnit(row.qty, unit || itemUnit(row.itemId) || ''),
    contentPending: Boolean(row.contentPending),
    contentText: row.contentPending ? '待补录' : contentWithUnit(row.contentUsed),
  }
}

function buildFeedMaterialRow(line, { stepNo, isExtra = false, postedRows = [] } = {}) {
  const card = itemMasterCard(line.itemId)
  const unit = itemUnit(line.itemId) || order.value?.unit || ''
  const name = card.name || itemLabel(line.itemId) || '—'
  const planQty = Number(line.qty) || 0
  const postedQty = postedRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  return {
    key: `${stepNo || 'x'}-${line.itemId}-${isExtra ? 'extra' : 'plan'}`,
    itemId: line.itemId,
    item: name,
    itemCode: card.code || '—',
    specText: card.specModel || '—',
    isExtra,
    planQty,
    planQtyText: planQty > 0 ? formatQtyWithUnit(planQty, unit) : '—',
    toleranceText:
      line.tolerance == null || line.tolerance === ''
        ? '—'
        : `±${Number((Number(line.tolerance) * 100).toFixed(2))}%`,
    keyText: line.isKeyMaterial ? '是' : '否',
    auxText: line.isAuxiliary ? '是' : '否',
    postedQty,
    postedText: postedRows.length ? formatQtyWithUnit(postedQty, unit) : '—',
    gapText: postedRows.length && planQty > 0 ? formatQtyWithUnit(postedQty - planQty, unit) : '—',
    postings: postedRows.map((row, feedIndex) =>
      mapFeedPostingRow(row, feedIndex, {
        itemLabelText: name,
        unit,
        seq: feedIndex + 1,
      }),
    ),
  }
}

/** 投料明细按工艺阶段归类；过账按本阶段 stepNo 归集，补加物料单独标出 */
const feedStageGroups = computed(() => {
  const current = order.value
  if (!current) return []
  const posted = current.feeds || []
  const theoretical = current.theoreticalFeeds || []
  const routeSteps = current.routeSnapshot || []
  const stepNameMap = new Map(routeSteps.map((step) => [Number(step.stepNo), step.name || '']))

  const stageNos = []
  const seen = new Set()
  theoretical.forEach((line) => {
    const no = Number(line.stepNo) || 0
    if (seen.has(no)) return
    seen.add(no)
    stageNos.push(no)
  })
  posted.forEach((row) => {
    const no = Number(row.stepNo) || 0
    if (seen.has(no)) return
    seen.add(no)
    stageNos.push(no)
  })
  stageNos.sort((a, b) => a - b)

  const defaultUnit = current.unit || ''
  return stageNos.map((stepNo, stageIndex) => {
    const planLines = theoretical.filter((line) => Number(line.stepNo) === stepNo)
    const stagePosts = posted.filter((row) => Number(row.stepNo) === stepNo)
    const plannedIds = new Set(planLines.map((line) => line.itemId))
    const materials = planLines.map((line) =>
      buildFeedMaterialRow(line, {
        stepNo,
        postedRows: stagePosts.filter((row) => row.itemId === line.itemId),
      }),
    )
    // 本阶段过账了、但不在本阶段理论投料里的（补加）
    const extraIds = [
      ...new Set(stagePosts.map((row) => row.itemId).filter((id) => id && !plannedIds.has(id))),
    ]
    extraIds.forEach((itemId) => {
      materials.push(
        buildFeedMaterialRow(
          { itemId, qty: 0 },
          {
            stepNo,
            isExtra: true,
            postedRows: stagePosts.filter((row) => row.itemId === itemId),
          },
        ),
      )
    })

    const planQty = materials.reduce((sum, row) => sum + Number(row.planQty || 0), 0)
    const postedQty = stagePosts.reduce((sum, row) => sum + Number(row.qty || 0), 0)
    const unit = itemUnit(materials[0]?.itemId) || itemUnit(stagePosts[0]?.itemId) || defaultUnit
    const stepName = stepNameMap.get(stepNo) || planLines[0]?.stepName || ''
    const title = stepNo > 0 ? `${stepNo} ${stepName}`.trim() : stepName || '未指定阶段'
    return {
      key: `feed-stage-${stepNo || 'none'}`,
      stepNo,
      title,
      defaultCollapsed: stageIndex > 0 && !stagePosts.length,
      materialCount: materials.length,
      planQtyText: planQty > 0 ? formatQtyWithUnit(planQty, unit) : '—',
      postedQtyText: stagePosts.length ? formatQtyWithUnit(postedQty, unit) : '—',
      postingCount: stagePosts.length,
      materials,
    }
  })
})

const feedPostingExpandMap = reactive({})

function isFeedPostingExpanded(rowKey) {
  // 默认展开过账表
  if (feedPostingExpandMap[rowKey] === undefined) return true
  return Boolean(feedPostingExpandMap[rowKey])
}

function toggleFeedPostingExpand(rowKey) {
  feedPostingExpandMap[rowKey] = !isFeedPostingExpanded(rowKey)
}

const feedTabFilter = reactive({
  stepNo: undefined,
  itemName: '',
  itemCode: '',
})
const feedTabFilterApplied = reactive({
  stepNo: undefined,
  itemName: '',
  itemCode: '',
})

const feedTabStageOptions = computed(() =>
  (feedStageGroups.value || []).map((stage) => ({
    value: stage.stepNo,
    label: stage.title,
  })),
)

function applyFeedTabFilter() {
  feedTabFilterApplied.stepNo = feedTabFilter.stepNo
  feedTabFilterApplied.itemName = String(feedTabFilter.itemName || '').trim()
  feedTabFilterApplied.itemCode = String(feedTabFilter.itemCode || '').trim()
}

function resetFeedTabFilter() {
  feedTabFilter.stepNo = undefined
  feedTabFilter.itemName = ''
  feedTabFilter.itemCode = ''
  applyFeedTabFilter()
}

const filteredFeedStageGroups = computed(() => {
  const nameKw = String(feedTabFilterApplied.itemName || '')
    .trim()
    .toLowerCase()
  const codeKw = String(feedTabFilterApplied.itemCode || '')
    .trim()
    .toLowerCase()
  const stepFilter =
    feedTabFilterApplied.stepNo === undefined || feedTabFilterApplied.stepNo === null
      ? null
      : Number(feedTabFilterApplied.stepNo)

  return (feedStageGroups.value || [])
    .filter((stage) => (stepFilter == null ? true : Number(stage.stepNo) === stepFilter))
    .map((stage) => {
      const materials = (stage.materials || []).filter((row) => {
        if (
          nameKw &&
          !String(row.item || '')
            .toLowerCase()
            .includes(nameKw)
        )
          return false
        if (
          codeKw &&
          !String(row.itemCode || '')
            .toLowerCase()
            .includes(codeKw)
        )
          return false
        return true
      })
      if (!materials.length) return null
      const unit = itemUnit(materials[0]?.itemId) || order.value?.unit || ''
      const planQty = materials.reduce((sum, row) => sum + Number(row.planQty || 0), 0)
      const postedQty = materials.reduce((sum, row) => sum + Number(row.postedQty || 0), 0)
      const postingCount = materials.reduce((sum, row) => sum + (row.postings?.length || 0), 0)
      return {
        ...stage,
        materials,
        materialCount: materials.length,
        postingCount,
        planQtyText: planQty > 0 ? formatQtyWithUnit(planQty, unit) : '—',
        postedQtyText: postingCount > 0 || postedQty > 0 ? formatQtyWithUnit(postedQty, unit) : '—',
        defaultCollapsed: false,
      }
    })
    .filter(Boolean)
})

/** 投料弹窗：当前阶段已记账的每一次过账（新→旧） */
const feedModalHistoryRows = computed(() => {
  const stepNo = Number(feedForm.stepNo)
  if (!Number.isFinite(stepNo)) return []
  return (order.value?.feeds || [])
    .filter((row) => Number(row.stepNo) === stepNo)
    .map((row, index) => mapFeedPostingRow(row, index))
    .reverse()
    .map((row, index) => ({ ...row, seq: index + 1 }))
})

/** 过程检实测摘要：取检单行上已填检验项（不含结论/备注），列表展示；悬停看全文 */
function summarizeQcTaskActual(task) {
  if (!task) return { actual: '—', actualFull: '' }
  const fields = Array.isArray(task.templateFields) ? task.templateFields : []
  const lines = Array.isArray(task.lineItems) ? task.lineItems : []
  const parts = []
  lines.forEach((line) => {
    const valueMap = {}
    ;(line.fieldValues || []).forEach((v) => {
      const code = v.fieldCode || v.code
      if (code) valueMap[code] = v.value ?? v.fieldValue
    })
    const lineFields =
      Array.isArray(line.templateFields) && line.templateFields.length
        ? line.templateFields
        : fields
    lineFields.forEach((field) => {
      if (!field?.code) return
      if (isQcConclusionField(field) || isQcInspectRemarkField(field)) return
      if (field.code === 'QC_INSPECT_METHOD' || field.code === 'QC_INSPECT_QTY') return
      const raw = valueMap[field.code]
      if (raw == null || raw === '' || (Array.isArray(raw) && !raw.length)) return
      const text = formatFieldValueWithUnit(field, raw)
      if (!text || text === '—') return
      parts.push(`${field.name || field.code} ${text}`)
    })
  })
  if (!parts.length) return { actual: '—', actualFull: '' }
  const full = parts.join('；')
  const short = parts.length <= 2 ? full : `${parts.slice(0, 2).join('；')} 等${parts.length}项`
  return { actual: short, actualFull: full }
}

function assayStatusMeta(task, row) {
  const qcStatus = task?.qcStatus || row?.qcStatus || ''
  const qcResult = task?.qcResult || row?.qcResult || ''
  if (qcStatus === QC_TASK_STATUS.COMPLETED || qcResult) {
    return {
      statusLabel: qcStatus === QC_TASK_STATUS.COMPLETED ? '已完成' : qcStatus || '已完成',
      statusColor:
        qcResult === QC_TASK_RESULT.PASS || qcResult === '合格' || qcResult === '质检通过'
          ? 'success'
          : qcResult
            ? 'default'
            : 'processing',
    }
  }
  if (qcStatus === '检验中' || qcStatus === QC_TASK_STATUS.INSPECTING) {
    return { statusLabel: '检验中', statusColor: 'processing' }
  }
  return { statusLabel: qcStatus || '待质检', statusColor: 'processing' }
}

const assayRows = computed(() => {
  const steps = order.value?.routeSnapshot || []
  let seq = 0
  return steps.flatMap((step) =>
    getStepQcRecords(order.value, step.stepNo).map((row, index) => {
      seq += 1
      const task = row.taskId ? getQcTaskById(row.taskId) : null
      const actualMeta = summarizeQcTaskActual(task)
      const statusMeta = assayStatusMeta(task, row)
      const hardGate = Boolean(row.hardGate ?? task?.hardGate)
      const typeLabel =
        assayTypeLabel(row.assayType || task?.assayType, row.bizScope || task?.bizScope) ||
        qcBizScopeLabel(row.bizScope || task?.bizScope) ||
        '—'
      const sampleLocation = String(task?.sampleLocation || row.sampleLocation || '').trim()
      return {
        key: `${step.stepNo}-${row.taskId || index}`,
        seq,
        point: `${step.stepNo} ${step.name || ''}`.trim(),
        // 工序设备：来自工艺阶段快照，发起时即可带出；不是现场取样口
        equipmentText: step.equipmentName || step.equipmentText || '—',
        sampleLocation: sampleLocation || '—',
        item: row.schemeName || task?.assaySchemeName || '—',
        typeLabel,
        hardGate,
        taskId: row.taskId || task?.id || '',
        qcNo: row.qcNo || task?.qcNo || '—',
        statusLabel: statusMeta.statusLabel,
        statusColor: statusMeta.statusColor,
        createdAt: task?.createdAt || row.createdAt || row.updatedAt || '—',
        actual: actualMeta.actual,
        actualFull: actualMeta.actualFull,
        // 化验结果 = 检单整单结论（qcResult）；与「实测」检验项值不同
        judge: task?.qcResult || row.qcResult || '—',
        inspectedAt: task?.inspectedAt || row.inspectedAt || '—',
        inspector: formatOperatorLabel(task?.inspector || row.inspector || ''),
      }
    }),
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
  return rows.map((row, index) => ({ ...row, seq: index + 1 }))
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
        feed.contentUsed != null && feed.contentUsed !== '' ? `，有效含量 ${feed.contentUsed}` : ''
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

function outputQcRecordsFor(row) {
  return (order.value?.outputQcRecords || []).filter((qc) => {
    if (qc.itemId !== row.itemId) return false
    if (row.role && qc.role && qc.role !== row.role) return false
    if (row.stepNo && qc.stepNo && Number(qc.stepNo) !== Number(row.stepNo)) return false
    return Boolean(qc.taskId || qc.qcNo)
  })
}

function outputQcLinksFor(row) {
  const seen = new Set()
  return outputQcRecordsFor(row)
    .map((qc) => {
      const task = qc.taskId ? getQcTaskById(qc.taskId) : null
      return {
        taskId: qc.taskId || task?.id || '',
        qcNo: task?.qcNo || qc.qcNo || '—',
        bizScope: qc.bizScope || task?.bizScope || '',
      }
    })
    .filter((link) => {
      const key = link.taskId || link.qcNo
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/** 产出行的检验方案 / 类型：优先最新关联检单，其次产出检勾选 */
function resolveOutputAssayMeta(row) {
  const records = outputQcRecordsFor(row)
  const latest = records.length ? records[records.length - 1] : null
  const task = latest?.taskId ? getQcTaskById(latest.taskId) : null
  const bizScope = task?.bizScope || latest?.bizScope || ''
  const scopes = Array.isArray(row.assayScopes) ? row.assayScopes : []
  const hasAssay = Boolean(
    scopes.length ||
    row.assayHardGate ||
    latest ||
    (order.value && isOutputAssayHardGate(order.value, row)),
  )
  const schemeText =
    task?.templateName ||
    task?.assaySchemeName ||
    latest?.templateName ||
    latest?.schemeName ||
    (hasAssay ? '产出化验' : '')
  const typeLabel = hasAssay
    ? assayTypeLabel(task?.assayType || latest?.assayType || 'finished', bizScope || '成品检') ||
      qcBizScopeLabel(bizScope || '成品检') ||
      '产出化验'
    : ''
  return {
    assayHardGate: hasAssay,
    assaySchemeText: schemeText || '—',
    assayTypeLabel: typeLabel || '—',
  }
}

function resolveOutputHandleStatus(disposition, batchStatus) {
  if (disposition === 'pending_decide' || batchStatus === 'await_decide') {
    return { key: 'await_decide', label: '待处理', color: 'default' }
  }
  if (disposition === 'reuse' || batchStatus === 'await_reuse') {
    return { key: 'await_reuse', label: '待回用', color: 'processing' }
  }
  if (disposition === 'reextract' || batchStatus === 'await_reextract') {
    return { key: 'await_reextract', label: '待再提', color: 'warning' }
  }
  if (disposition === 'scrap' || batchStatus === 'rejected') {
    return { key: 'scrap', label: '已废弃', color: 'default' }
  }
  if (
    disposition === 'warehouse' ||
    disposition === 'tank' ||
    batchStatus === 'await_inbound' ||
    batchStatus === 'pending' ||
    batchStatus === 'released'
  ) {
    if (batchStatus === 'released') {
      return { key: 'inbound_done', label: '已入库', color: 'success' }
    }
    return { key: 'await_inbound', label: '待入库', color: 'processing' }
  }
  return { key: 'other', label: '—', color: 'default' }
}

function resolveOutputQcTaskStatus(row) {
  const records = outputQcRecordsFor(row)
  if (!records.length) {
    const scopes = Array.isArray(row.assayScopes) ? row.assayScopes : []
    if (!scopes.length && !row.assayHardGate) {
      return { label: '—', color: 'default' }
    }
    return { label: '未发起', color: 'default' }
  }
  const latest = records[records.length - 1]
  const task = latest.taskId ? getQcTaskById(latest.taskId) : null
  const status = task?.qcStatus || latest.qcStatus || ''
  if (status === QC_TASK_STATUS.COMPLETED || status === '已完成') {
    return { label: '已完成', color: 'success' }
  }
  if (status === QC_TASK_STATUS.CANCELLED || status === '已终止') {
    return { label: '已终止', color: 'default' }
  }
  if (status === QC_TASK_STATUS.INSPECTING || status === '检验中') {
    return { label: '检验中', color: 'processing' }
  }
  return { label: status || '待质检', color: 'processing' }
}

const outRows = computed(() =>
  (order.value?.outputs || []).map((row, index) => {
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
    const assayMeta = resolveOutputAssayMeta(row)
    const handle = resolveOutputHandleStatus(disposition, batch?.status)
    const qcTask = resolveOutputQcTaskStatus(row)
    const fromLink = qcLinks
      .map((link) => {
        const task = link.taskId ? getQcTaskById(link.taskId) : null
        return displayInspectConclusion(task?.qcResult)
      })
      .find((text) => text && text !== '—')
    const inspectConclusion = displayInspectConclusion(fromLink || qc.qcResult)
    const assayPass = inspectConclusion === '合格' || inspectConclusion === '让步'
    // 硬门禁且无合格/让步结论 → 确认去向置灰；记录门禁可点
    const decideDisabled = Boolean(assayMeta.assayHardGate) && !assayPass
    const decideDisabledReason = decideDisabled
      ? '已挂产出化验硬门禁，须检验合格（或让步）后才能确认去向'
      : ''
    const inboundLinks = inboundLinksOf(
      row.inboundOrderId && row.inboundOrderNo
        ? [row]
        : row.inboundOrderNo
          ? [{ inboundOrderId: row.inboundOrderId, inboundOrderNo: row.inboundOrderNo }]
          : [],
    )
    // 产出含量：行上 contentUsed 优先，否则取批次；空则待补录
    const contentFrac =
      row.contentUsed != null && row.contentUsed !== '' && Number(row.contentUsed) > 0
        ? Number(row.contentUsed)
        : batch?.content != null && batch.content !== '' && Number(batch.content) > 0
          ? Number(batch.content)
          : null
    const contentPending =
      Boolean(row.contentPending) || (Boolean(row.batchId) && !(contentFrac > 0))
    const card = itemMasterCard(row.itemId)
    const canSpawnBranch = canSpawnBranchFromOutput(row)
    return {
      ...row,
      seq: index + 1,
      roleLabel: roleLabel[row.role] || row.role,
      dispositionLabel: OUTPUT_DISPOSITION_LABEL[disposition] || '—',
      itemName: card.name || name || '—',
      itemCode: card.code || '—',
      canSpawnBranch,
      specText: card.specModel || '—',
      item: unit ? `${name} ${unit}` : name,
      batchNo: row.batchNo || '—',
      locationName: tankName(locationId),
      qtyText: formatQtyWithUnit(row.qty, unit),
      remainText: formatQtyWithUnit(remainQty, unit),
      remainQty,
      contentPending,
      contentText: contentPending ? '待补录' : contentWithUnit(contentFrac),
      stepText: row.stepNo ? `${row.stepNo}${step?.name ? ` ${step.name}` : ''}`.trim() : '—',
      assaySchemeText: assayMeta.assaySchemeText,
      assayTypeLabel: assayMeta.assayTypeLabel,
      assayHardGate: assayMeta.assayHardGate,
      handleStatus: handle.key,
      handleStatusLabel: handle.label,
      handleStatusColor: handle.color,
      qcTaskStatusLabel: qcTask.label,
      qcTaskStatusColor: qcTask.color,
      inspectConclusion,
      decideDisabled,
      decideDisabledReason,
      qcLinks,
      inboundLinks,
    }
  }),
)

const detailTab = ref('info')
const stepOpen = ref(false)
const currentStep = ref(null)
const stepConfirmModalTitle = computed(() => {
  const stepName = currentStep.value?.name || currentStep.value?.processName || '本步'
  const batchNo = String(order.value?.batchNo || '').trim()
  return batchNo ? `确认本步 · ${stepName} · ${batchNo}` : `确认本步 · ${stepName}`
})
const stepActuals = ref([])
const stepExecEquipmentId = ref('')
const formValues = reactive({})
const currentParams = computed(() => stepParamRows(currentStep.value || {}))
const currentFormTemplate = computed(() => resolveStepFormTemplate(currentStep.value || {}))
const currentFormFields = computed(() =>
  filterTemplateFieldsBeyondFixed(currentFormTemplate.value?.fields || []),
)
const stepEquipmentCandidates = computed(() => {
  void equipmentState.devices
  if (!stepOpen.value || !currentStep.value) return []
  return resolveStepEquipmentCandidates(currentStep.value)
})
const stepEquipmentOptions = computed(() =>
  stepEquipmentCandidates.value.map((id) => {
    const device = getDeviceById(id)
    const base = deviceLabelById(id) || id
    const occupy = device?.occupyStatus ? ` · ${device.occupyStatus}` : ''
    const status =
      device?.status &&
      device.status !== EQUIPMENT_STATUS.IN_USE &&
      device.status !== EQUIPMENT_STATUS.IDLE
        ? ` · ${device.status}`
        : ''
    return { value: id, label: `${base}${occupy}${status}` }
  }),
)
const formSystemCtx = computed(() => {
  const selectedId = String(stepExecEquipmentId.value || '').trim()
  return {
    operatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    equipmentId: selectedId || currentStep.value?.equipmentId || '',
    equipmentLabel:
      (selectedId ? deviceLabelById(selectedId) : '') || currentStep.value?.equipmentName || '',
    batchNo: order.value?.batchNo || '',
  }
})
const stepOperatedAtPicker = computed({
  get: () => formValues.OP_OPERATED_AT || undefined,
  set: (value) => {
    formValues.OP_OPERATED_AT = value || ''
  },
})
const openFeed = ref(false)
const feedHistoryCollapsed = ref(false)
const outputHistoryCollapsed = ref(false)
const feedForm = reactive({ stepNo: undefined, extra: false })
const feedSourceOptions = [
  { value: 'fresh', label: '线边新料' },
  { value: 'recycle', label: '回流料' },
]
const isReextractOrder = computed(() => Boolean(order.value?.reextractOfBatchId))
const feedModalTitle = computed(() => (isReextractOrder.value ? '再提投料' : '投料过账'))
const feedSourceHint = computed(() => {
  if (isReextractOrder.value) {
    return '本单为再提指令，只可选对应的待再提批次。行内选批次或点「搜索更多」。'
  }
  return '默认全部勾选「本次」；取消勾选后该行置灰不可填，确认时跳过。投料来源按行选择；新料 / 回流各自配置扣减方式。有效含量可手填或空着后补。'
})

function normalizeRowFeedSource(source) {
  if (isReextractOrder.value) return 'reextract'
  return source === 'recycle' ? 'recycle' : 'fresh'
}

function rowDeductMode(record) {
  void functionParamState.params.processFeedDeductMode
  void functionParamState.params.processFeedDeductModeRecycle
  if (isReextractOrder.value) return PROCESS_FEED_DEDUCT_MODES.BATCH_PICK
  const source = normalizeRowFeedSource(record?.feedSource)
  return getFeedDeductModeForSource(source === 'recycle' ? 'recycle' : 'fresh')
}

function rowFifoOnly(record) {
  return rowDeductMode(record) === PROCESS_FEED_DEDUCT_MODES.LOCATION_FIFO
}

function rowEither(record) {
  return rowDeductMode(record) === PROCESS_FEED_DEDUCT_MODES.EITHER
}

function showFeedBatchSelect(record) {
  return !rowFifoOnly(record)
}

function needsFeedSourceLocation(record) {
  if (rowFifoOnly(record)) return true
  if (rowEither(record) && !record?.batchId) return true
  return false
}

function feedBatchPlaceholder(record) {
  if (normalizeRowFeedSource(record?.feedSource) === 'recycle') return '可多选回流批次'
  if (rowEither(record)) return '可多选；不选=再选储罐/库位'
  return '可多选批次'
}

function feedLocationFollowText(record) {
  if (record?.batchId) {
    const name = tankName(record.locationId)
    return name !== '—' ? `随批次 · ${name}` : '随所选批次'
  }
  return '—'
}

function feedLocationOptionsForItem(itemId, feedSource) {
  return listFeedSourceLocations(itemId, order.value, {
    source: normalizeRowFeedSource(feedSource) === 'recycle' ? 'recycle' : 'fresh',
  }).map((opt) => ({
    ...opt,
    // 下拉放宽后仍保留完整文案；选中态窄列时可用 title 悬停看全
    title: opt.label,
  }))
}

function openFeedLocationPicker(record) {
  if (record?.included === false) return
  feedLocationPickerRow.value = record
  feedLocationPickerOpen.value = true
}

/** 「选择更多」弹窗确认后来源库位。 */
function onFeedLocationPicked(row) {
  const target = feedLocationPickerRow.value
  if (!target) return
  target.locationId = row?.value || undefined
}

function feedContentPlaceholder(record) {
  if (needsFeedSourceLocation(record)) return '可手填，或空着后补'
  if (record?.convertByContent) return '必填'
  return '可选'
}

function onFeedRowSourceChange(record, source) {
  const next = normalizeRowFeedSource(source)
  record.feedSource = next === 'reextract' ? 'reextract' : next
  record.batchId = undefined
  record.locationId = undefined
  record.contentPct = null
  record.qcNo = '—'
  record.qcResult = '—'
  record.qcTaskId = ''
  if (rowFifoOnly(record) || rowEither(record)) return
  const preferred = listFeedableBatches(record.itemId, order.value, {
    source: next === 'recycle' ? 'recycle' : 'fresh',
  })[0]
  if (preferred) onFeedBatchChange(record, preferred.id)
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
    message.warning('请填写有效含量')
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
    message.success('有效含量已补录')
    feedContentPatchOpen.value = false
  } finally {
    feedContentPatchSaving.value = false
  }
}

const outputContentPatchOpen = ref(false)
const outputContentPatchSaving = ref(false)
const outputContentPatch = reactive({
  outputId: '',
  batchId: '',
  batchNo: '',
  contentPct: null,
})

function openOutputContentPatch(record) {
  outputContentPatch.outputId = record.id || ''
  outputContentPatch.batchId = record.batchId || ''
  outputContentPatch.batchNo = record.batchNo || ''
  outputContentPatch.contentPct = null
  outputContentPatchOpen.value = true
}

function closeOutputContentPatch() {
  outputContentPatchOpen.value = false
}

function saveOutputContentPatch() {
  const frac = contentPctToFraction(outputContentPatch.contentPct)
  if (!(Number(frac) > 0)) {
    message.warning('请填写有效含量')
    return
  }
  outputContentPatchSaving.value = true
  try {
    const res = backfillOutputContentFromAssay(order.value.id, {
      outputId: outputContentPatch.outputId,
      batchId: outputContentPatch.batchId,
      content: frac,
    })
    if (!res.ok || !res.updated) {
      message.warning(res.message || '补录失败')
      return
    }
    message.success('产出有效含量已补录')
    outputContentPatchOpen.value = false
    assayListTick.value += 1
  } finally {
    outputContentPatchSaving.value = false
  }
}

const feedLineDrafts = ref([])
const feedBatchPickerOpen = ref(false)
const feedLocationPickerOpen = ref(false)
const feedLocationPickerRow = ref(null)
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

function outputDispositionOptionsFor(role, itemId) {
  // 主产：入仓/入罐/进暂存；其它角色含待判定等。未开「允许车间暂存」则隐藏进暂存池
  let options =
    role === 'main'
      ? OUTPUT_DISPOSITION_OPTIONS.filter(
          (item) => isStockOutputDisposition(item.value) || item.value === 'staging',
        )
      : OUTPUT_DISPOSITION_OPTIONS
  if (!isProcessItemAllowWorkshopStaging(itemId)) {
    options = options.filter((item) => item.value !== 'staging')
  }
  return options
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
  if (disposition === 'staging') return '选择暂存仓/罐'
  if (disposition === 'reuse') return '回流罐或仓'
  if (disposition === 'reextract') return '待再提位置'
  if (disposition === 'pending_decide') return '暂存位置'
  if (disposition === 'scrap') return '废弃位置'
  return '选择位置'
}

const finalDispositionOptions = computed(() => {
  const itemId = decideForm.itemId
  return OUTPUT_DISPOSITION_OPTIONS.filter((item) => {
    if (item.value === 'pending_decide') return false
    if (item.value === 'staging' && !isProcessItemAllowWorkshopStaging(itemId)) return false
    return true
  })
})

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

const outputIncludeHeaderChecked = computed(() => {
  const rows = outputDrafts.value || []
  if (!rows.length) return false
  return rows.every((row) => row.included !== false)
})

const outputIncludeHeaderIndeterminate = computed(() => {
  const rows = outputDrafts.value || []
  if (!rows.length) return false
  const n = rows.filter((row) => row.included !== false).length
  return n > 0 && n < rows.length
})

function onOutputIncludeCheckAll(checked) {
  ;(outputDrafts.value || []).forEach((row) => {
    row.included = Boolean(checked)
  })
}

const feedIncludeHeaderChecked = computed(() => {
  const rows = feedLineDrafts.value || []
  if (!rows.length) return false
  return rows.every((row) => row.included !== false)
})

const feedIncludeHeaderIndeterminate = computed(() => {
  const rows = feedLineDrafts.value || []
  if (!rows.length) return false
  const n = rows.filter((row) => row.included !== false).length
  return n > 0 && n < rows.length
})

function onFeedIncludeCheckAll(checked) {
  ;(feedLineDrafts.value || []).forEach((row) => {
    row.included = Boolean(checked)
  })
}

/** 可被表头全选切换的行（配方必检行锁定，不参与全选） */
const outputAssayToggleableRows = computed(() =>
  (outputDrafts.value || []).filter((row) => !row.assayLocked && row.included !== false),
)

const outputAssayHeaderChecked = computed(() => {
  const rows = outputAssayToggleableRows.value
  if (!rows.length) return false
  return rows.every((row) => (row.assayScopes || []).includes('成品检'))
})

const outputAssayHeaderIndeterminate = computed(() => {
  const rows = outputAssayToggleableRows.value
  if (!rows.length) return false
  const checked = rows.filter((row) => (row.assayScopes || []).includes('成品检')).length
  return checked > 0 && checked < rows.length
})

/** 表头勾选：全选/取消发起产出化验（不影响配方必检行） */
function onOutputAssayCheckAll(checked) {
  outputAssayToggleableRows.value.forEach((row) => {
    onOutputAssayCheck(row, Boolean(checked))
  })
}

/** 同物料同角色同阶段是否已有有效产出化验单（用于显示「强制新建」） */
function hasExistingOutputAssay(record) {
  return listOutputAssayRecordsFor(record).length > 0
}

/** 本物料本阶段产出化验记录（成品检、未终止） */
function listOutputAssayRecordsFor(record) {
  const stepNo = Number(record?.stepNo || outputForm.stepNo)
  return (order.value?.outputQcRecords || []).filter((qc) => {
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

/** 最新一张已完成的产出检（滞后登记：可带出含量、默认不发起） */
function findLatestCompletedOutputAssay(record) {
  const rows = listOutputAssayRecordsFor(record)
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const qc = rows[i]
    const task = qc.taskId ? getQcTaskById(qc.taskId) : null
    const status = task?.qcStatus || qc.qcStatus || ''
    if (status === QC_TASK_STATUS.COMPLETED || status === '已完成') {
      return { qc, task }
    }
  }
  return null
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
    const draftKey = {
      itemId: line.itemId,
      role: line.role,
      stepNo: lineStep,
    }
    const completed = findLatestCompletedOutputAssay(draftKey)
    const hasCompletedAssay = Boolean(completed)
    const assayContent = completed?.task ? extractContentFractionFromQcTask(completed.task) : null
    // 滞后：已有完成检单且配方未强制 → 默认不勾发起；含量尽量带出
    const assayScopes = assayLocked ? forcedScopes : []
    const contentPct = assayContent != null ? contentToPct(assayContent) : null
    const card = itemMasterCard(line.itemId)
    return {
      key: `${line.role}-${line.itemId}-${index}`,
      role: line.role,
      stepNo: lineStep,
      roleLabel: roleLabel[line.role] || line.role,
      itemId: line.itemId,
      // 名称 / 编码 / 规格拆列展示，避免挤在一格被截断
      itemName: card.name || name || '—',
      itemCode: card.code || '—',
      specText: card.specModel || '—',
      item: unit ? `${name} ${unit}` : name,
      unit,
      qty: line.qty,
      qtyText: formatQtyWithUnit(line.qty, unit),
      posted,
      postedText: posted > 0 ? formatQtyWithUnit(posted, unit) : '—',
      // 默认全部勾选本次；取消勾选后整行置灰不可填
      included: true,
      actual: remain > 0 ? remain : null,
      contentPct,
      contentFromAssay: contentPct != null,
      hasCompletedAssay,
      disposition: defaultOutputDisposition(line.role, line.itemId),
      locationId: (() => {
        const way = defaultOutputDisposition(line.role, line.itemId)
        return createsOutputBatchDisposition(way)
          ? defaultOutputLocation(line.itemId, line.role, way)
          : ''
      })(),
      assayLocked,
      assayScopes,
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
  // 补充框默认空：留空不改整单；有新情况再填，追加到偏差流水
  deviation.value = ''
  outputHistoryCollapsed.value = false
  syncOutputModalWidth()
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
  void functionParamState.params.processFeedDeductMode
  void functionParamState.params.processFeedDeductModeRecycle
  feedLineDrafts.value = lines.map((line, index) => {
    const posted = postedQtyForItem(line.itemId)
    const remain = Math.max(0, Number(line.qty || 0) - posted)
    const feedSource = isReextractOrder.value ? 'reextract' : 'fresh'
    const deductSource = feedSource === 'recycle' ? 'recycle' : 'fresh'
    const mode = isReextractOrder.value
      ? PROCESS_FEED_DEDUCT_MODES.BATCH_PICK
      : getFeedDeductModeForSource(deductSource)
    const fifoOnly = mode === PROCESS_FEED_DEDUCT_MODES.LOCATION_FIFO
    const either = mode === PROCESS_FEED_DEDUCT_MODES.EITHER
    const batches = listFeedableBatches(line.itemId, order.value, { source: deductSource })
    const preferred = batches[0]
    const card = itemMasterCard(line.itemId)
    const unit = itemUnit(line.itemId) || order.value?.unit || 'kg'
    // 强制库位 FEFO / 两者皆可默认不选手选批次；选手选模式才预填首批
    const preselectBatch = !fifoOnly && !either
    const selected = preselectBatch ? preferred : null
    const qc = selected
      ? resolveMaterialBatchQc(selected)
      : { qcNo: '—', qcResult: '—', qcTaskId: '' }
    const convertByContent = Boolean(line.convertByContent)
    const assumedContent = resolveAssumedContentForLine(line)
    // 预选批次且按含量折算时，实投量用含量反算建议值
    let qty = remain > 0 ? remain : null
    if (qty != null && selected) {
      qty = suggestActualFeedQty({
        planRemainQty: remain,
        convertByContent,
        assumedContent,
        batchContent: selected.content,
        availableQty: selected.qty,
      })
    }
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
      // 默认全部勾选本次；取消勾选后整行置灰不可填
      included: true,
      convertByContent,
      assumedContent,
      feedSource,
      batchId: selected?.id || undefined,
      locationId: selected?.locationId || undefined,
      qty,
      contentPct: selected ? contentToPct(selected.content) : null,
      qcNo: qc.qcNo,
      qcResult: qc.qcResult,
      qcTaskId: qc.qcTaskId,
    }
  })
}

/** 本弹窗是否含「按含量折算」行（用于提示文案） */
const feedHasConvertByContent = computed(() =>
  (feedLineDrafts.value || []).some((row) => row.convertByContent),
)

/** 剩余理论毛重 = 计划 − 已过账 */
function planRemainGross(row) {
  return round3(Math.max(0, Number(row?.planQty || 0) - Number(row?.posted || 0)))
}

/**
 * 解析配方假定含量（0~1）：优先理论行快照 assumedContent，否则回查当前配方行。
 */
function resolveAssumedContentForLine(line) {
  if (!line?.convertByContent) return null
  const fromSnap = contentAsFraction(line.assumedContent)
  if (fromSnap > 0) return fromSnap
  const formula = getFormula(order.value?.formulaId)
  const source = (formula?.lines || []).find((item) => item.itemId === line.itemId)
  return contentAsFraction(source?.content)
}

function resolveAssumedContent(row) {
  return resolveAssumedContentForLine(row)
}

/**
 * 指导量（只读）：按含量折算时 = 剩余理论 × 配方假定含量 ÷ 批次有效含量；
 * 非折算或条件不足时显示 —。
 */
function calcFeedGuideQty(record) {
  if (!record?.convertByContent) return null
  const remain = planRemainGross(record)
  if (!(remain > 0)) return null
  const assumed = resolveAssumedContent(record)
  const batchC = contentPctToFraction(record?.contentPct)
  if (!(assumed > 0) || !(batchC > 0)) return null
  return suggestActualFeedQty({
    planRemainQty: remain,
    convertByContent: true,
    assumedContent: assumed,
    batchContent: batchC,
    // 指导量按公式展示，不按库存截断，便于对照「该投多少」
    availableQty: undefined,
  })
}

function feedGuideQtyText(record) {
  const qty = calcFeedGuideQty(record)
  if (qty == null) return '—'
  return formatQtyWithUnit(qty, record?.unit || '')
}

/** 改有效含量后，折算物料同步重算建议实投（可再手改） */
function onFeedContentPctChange(record) {
  if (!record?.convertByContent) return
  const remain = planRemainGross(record)
  if (!(remain > 0)) return
  const assumed = resolveAssumedContent(record)
  const batchC = contentPctToFraction(record.contentPct)
  if (!(assumed > 0) || !(batchC > 0)) return
  const batch = record.batchId ? getMaterialBatch(record.batchId) : null
  record.qty = suggestActualFeedQty({
    planRemainQty: remain,
    convertByContent: true,
    assumedContent: assumed,
    batchContent: batchC,
    availableQty: batch?.qty,
  })
}

function resolveMaterialBatchQc(batch) {
  return resolveBatchInspectInfo(batch)
}

function batchOptionsForItem(itemId, feedSource) {
  return listFeedableBatches(itemId, order.value, {
    source: normalizeRowFeedSource(feedSource) === 'recycle' ? 'recycle' : 'fresh',
  }).map((batch) => {
    const qc = resolveMaterialBatchQc(batch)
    const qcTag = qc.qcResult && qc.qcResult !== '—' ? ` 检验${qc.qcResult}` : ''
    return {
      value: batch.id,
      label: `${batch.batchNo}${qcTag} 剩余 ${batch.qty}${batch.unit || ''} 有效含量 ${contentWithUnit(batch.content)} 效期 ${batch.expiryDate || '—'}`,
    }
  })
}

function feedBatchSelectValue(record) {
  return record?.batchId ? [record.batchId] : []
}

function onFeedBatchChange(record, batchId) {
  const batch = batchId ? getMaterialBatch(batchId) : null
  record.batchId = batchId || undefined
  const remain = planRemainGross(record)
  if (batch) {
    record.contentPct = contentToPct(batch.content)
    record.locationId = batch.locationId || undefined
    // 选批后按含量反算建议实投；理论量列仍用 planQty 对照
    record.qty = suggestActualFeedQty({
      planRemainQty: remain,
      convertByContent: Boolean(record.convertByContent),
      assumedContent: resolveAssumedContent(record),
      batchContent: batch.content,
      availableQty: batch.qty,
    })
  } else {
    // 清空批次 → 改走选罐/库位：含量置空，实投回到剩余理论量
    record.contentPct = null
    record.locationId = undefined
    record.qty = remain > 0 ? remain : null
  }
  const qc = resolveMaterialBatchQc(batch)
  record.qcNo = qc.qcNo
  record.qcResult = qc.qcResult
  record.qcTaskId = qc.qcTaskId
}

/** 行内多选：一台落本行；多台按可投量拆成多行（与「搜索更多」一致）。 */
function onFeedBatchSelectChange(record, ids) {
  const list = (Array.isArray(ids) ? ids : ids ? [ids] : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
  if (!list.length) {
    onFeedBatchChange(record, undefined)
    return
  }
  if (list.length === 1) {
    onFeedBatchChange(record, list[0])
    return
  }
  const batches = list.map((id) => getMaterialBatch(id)).filter((batch) => batch?.id)
  if (!batches.length) {
    onFeedBatchChange(record, undefined)
    return
  }
  feedBatchPickerRow.value = record
  onFeedBatchesPicked(batches)
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
  if (record?.included === false) return
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
    included: row.included !== false,
    convertByContent: row.convertByContent,
    assumedContent: row.assumedContent ?? null,
    feedSource: normalizeRowFeedSource(row.feedSource),
  }
}

function makeFeedDraftRow(base, batch, qty) {
  const qc = resolveMaterialBatchQc(batch)
  return {
    ...cloneFeedDraftBase(base),
    key: `${base.itemId}-${batch?.id || 'none'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    batchId: batch?.id || undefined,
    locationId: batch?.locationId || undefined,
    qty: qty == null ? null : qty,
    contentPct: contentToPct(batch?.content),
    qcNo: qc.qcNo,
    qcResult: qc.qcResult,
    qcTaskId: qc.qcTaskId,
  }
}

/**
 * 搜索更多多选确认后：一个批次一行。
 * 按含量折算 → 按「目标有效量」分摊再反算各批实投；否则按剩余理论毛重分摊（候选批已按近效先出排序）。
 */
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
  const allocated = allocateSuggestedFeedQtys({
    planRemainQty: planRemainGross(row),
    convertByContent: Boolean(row.convertByContent),
    assumedContent: resolveAssumedContent(row),
    batches: list,
  })
  const nextRows = allocated.map(({ batch, qty }) => makeFeedDraftRow(row, batch, qty))
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

function paramPlaceholder(field) {
  const parts = []
  if (field?.target != null && field.target !== '') parts.push(`目标 ${field.target}`)
  if (field?.min != null && field.min !== '' && field?.max != null && field.max !== '') {
    parts.push(`${field.min}~${field.max}`)
  } else if (field?.min != null && field.min !== '') {
    parts.push(`≥${field.min}`)
  } else if (field?.max != null && field.max !== '') {
    parts.push(`≤${field.max}`)
  }
  return parts.join(' · ') || '请输入'
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
  feedHistoryCollapsed.value = false
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

/** 列表入口置灰原因（不含弹窗内才填的参数；参数仍在弹窗里校验）。 */
function stepConfirmListBlockers(step) {
  void functionParamState.params.enableSequentialBatchStep
  const errors = []
  if (!step || order.value?.status !== 'running') return errors
  if (step.enabledOnOrder === false) {
    errors.push('本阶段已对本单关闭')
    return errors
  }
  errors.push(...stepSequenceConfirmErrors(order.value, step))
  errors.push(...stepFeedConfirmErrors(order.value, step))
  const gate = normalizeProcessGate(step.gateMode)
  if (gate === PROCESS_GATE_HARD) {
    const rows = buildAssayChecklistForStep(step, { processOnly: true })
    const hardRows = rows.filter((row) => row.hardGate)
    const targets = hardRows.length ? hardRows : rows
    if (targets.length && targets.some((row) => !row.passed)) {
      errors.push('硬门禁化验未完成或未通过')
    }
  }
  if (!resolveStepEquipmentCandidates(step).length) {
    errors.push('本步没有候选设备')
  }
  return errors
}

/** 支线阶段开关「本次启用」 */
function onToggleStepEnabled(record, enabled) {
  if (!order.value?.id) return
  try {
    setBatchStepEnabled(order.value.id, record.stepNo, enabled)
    message.success(enabled ? '已启用本阶段' : '已对本单关闭该支线阶段')
  } catch (e) {
    message.error(e?.message || '切换失败')
  }
}

function stepConfirmListBlocked(step) {
  return stepConfirmListBlockers(step).length > 0
}

function stepConfirmListBlockTip(step) {
  const errors = stepConfirmListBlockers(step)
  return errors.length ? errors.join('；') : ''
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
    const sampleLocation = String(task?.sampleLocation || latest?.sampleLocation || '').trim()
    return {
      schemeId: scheme.id,
      typeLabel: assayTypeLabel(scheme.assayType, scheme.bizScope) || scheme.name || '化验',
      bizLabel: qcBizScopeLabel(scheme.bizScope),
      hardGate,
      gateLabel: hardGate ? '硬门禁' : '记录',
      sampleLocation,
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

/** 弹窗：本阶段已登记产出（支持就地补含量，不必再走「本次登记」） */
const outputModalHistoryRows = computed(() => {
  void assayListTick.value
  if (!openOutput.value) return []
  const stepNo = Number(outputForm.stepNo)
  return (outRows.value || [])
    .filter((row) => {
      if (!(stepNo > 0)) return true
      return Number(row.stepNo) === stepNo
    })
    .map((row, index) => ({
      ...row,
      key: row.id || `${row.batchId || row.itemId}-${index}`,
      seq: index + 1,
      at: row.at || '—',
    }))
})

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
/** 产出登记弹窗宽度：随视口加宽，上限约 1600 */
const outputModalWidth = ref(1400)
/** 异常偏差历史流水弹窗 */
const deviationLogsOpen = ref(false)
const assayQcDrawerOpen = ref(false)
const assayQcPreviewTask = ref(null)
/** 各化验类型独立的取样位置（schemeId → 文本） */
const assaySampleLocationByScheme = reactive({})

function resetAssaySampleLocations() {
  Object.keys(assaySampleLocationByScheme).forEach((key) => {
    delete assaySampleLocationByScheme[key]
  })
}

function syncAssayModalWidth() {
  if (typeof window === 'undefined') return
  assayModalWidth.value = Math.min(1200, Math.max(960, Math.floor(window.innerWidth * 0.9)))
}

/** 产出登记多表并行，默认比化验弹窗更宽 */
function syncOutputModalWidth() {
  if (typeof window === 'undefined') return
  outputModalWidth.value = Math.min(1600, Math.max(1320, Math.floor(window.innerWidth * 0.92)))
}

onMounted(() => {
  syncAssayModalWidth()
  syncOutputModalWidth()
  window.addEventListener('resize', syncAssayModalWidth)
  window.addEventListener('resize', syncOutputModalWidth)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', syncAssayModalWidth)
  window.removeEventListener('resize', syncOutputModalWidth)
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

const assayEquipmentText = computed(() => {
  const step = assayStep.value
  if (!step) return '—'
  return step.equipmentName || step.equipmentText || '—'
})

const stepConfirmEquipmentText = computed(() => {
  const selectedId = String(stepExecEquipmentId.value || '').trim()
  if (selectedId) return deviceLabelById(selectedId) || selectedId
  const step = currentStep.value
  if (!step) return '—'
  return step.equipmentName || step.equipmentText || '—'
})

const stepConfirmNoEquipmentCandidates = computed(
  () => stepOpen.value && !stepEquipmentCandidates.value.length,
)

const stepConfirmEquipmentBlocked = computed(() => {
  if (!stepOpen.value || order.value?.status !== 'running') return false
  if (!stepEquipmentCandidates.value.length) return true
  return !String(stepExecEquipmentId.value || '').trim()
})

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

const stepConfirmSequenceBlocked = computed(() => {
  void functionParamState.params.enableSequentialBatchStep
  if (!stepOpen.value || order.value?.status !== 'running' || !currentStep.value) return false
  return stepSequenceConfirmErrors(order.value, currentStep.value).length > 0
})

const stepConfirmSequenceMessage = computed(() => {
  const errors = currentStep.value ? stepSequenceConfirmErrors(order.value, currentStep.value) : []
  return errors[0] || '请先确认上一步后再确认本步。'
})

const stepConfirmFeedBlocked = computed(() => {
  if (!stepOpen.value || order.value?.status !== 'running' || !currentStep.value) return false
  return stepFeedConfirmErrors(order.value, currentStep.value).length > 0
})

const stepConfirmParamBlocked = computed(() => {
  if (!stepOpen.value || order.value?.status !== 'running' || !currentStep.value) return false
  return stepParamConfirmErrors(currentStep.value, stepActuals.value).length > 0
})

const stepConfirmSubmitBlocked = computed(
  () =>
    stepConfirmHardGateBlocked.value ||
    stepConfirmEquipmentBlocked.value ||
    stepConfirmSequenceBlocked.value ||
    stepConfirmFeedBlocked.value ||
    stepConfirmParamBlocked.value,
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
  syncAssayModalWidth()
  assayStep.value = step
  resetAssaySampleLocations()
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
      sampleLocation: assaySampleLocationByScheme[row.schemeId],
    })
    if (!result.ok) {
      message.error(result.message || '发起化验失败')
      return
    }
    assayListTick.value += 1
    if (result.created) {
      message.success(`已发起化验 ${result.task.qcNo}`)
      delete assaySampleLocationByScheme[row.schemeId]
    } else {
      message.info(`已有待检单 ${result.task.qcNo}，状态列可查看`)
    }
  } catch (error) {
    message.error(error.message || '发起化验失败')
  } finally {
    assayStartingId.value = ''
  }
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

function pickDefaultStepEquipment(step) {
  const candidates = resolveStepEquipmentCandidates(step)
  const current = String(step?.equipmentId || '').trim()
  if (current && candidates.includes(current)) return current
  if (candidates.length === 1) return candidates[0]
  return ''
}

function openStep(step) {
  currentStep.value = step
  const stepNo = Number(step.stepNo)
  const prevParams = (order.value?.paramActuals || []).filter(
    (row) => Number(row.stepNo) === stepNo,
  )
  const prevParamByKey = new Map(prevParams.map((row) => [row.key, row.value]))
  const prevForms = (order.value?.formActuals || []).filter((row) => Number(row.stepNo) === stepNo)
  const prevFormByCode = new Map(
    prevForms.map((row) => [String(row.fieldCode || '').toUpperCase(), row.value]),
  )

  stepActuals.value = stepParamRows(step).map((param) => {
    const key = param.unit ? `${param.name}（${param.unit}）` : param.name
    if (prevParamByKey.has(key)) return prevParamByKey.get(key)
    return param.target == null ? null : param.target
  })

  stepExecEquipmentId.value = pickDefaultStepEquipment(step)

  Object.keys(formValues).forEach((key) => delete formValues[key])
  const selectedId = String(stepExecEquipmentId.value || '').trim()
  const ctx = {
    equipmentId: selectedId || step.equipmentId || '',
    equipmentLabel: (selectedId ? deviceLabelById(selectedId) : '') || step.equipmentName || '',
    batchNo: order.value?.batchNo || '',
    operatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  }
  // 重新确认：带回上次确认内容，便于改错；首次确认仍默认当前人/当前时间
  formValues.OP_OPERATOR =
    prevFormByCode.get('OP_OPERATOR') ??
    resolveProcessFormSystemValue(PROCESS_FORM_SYSTEM_KEYS.OPERATOR, ctx)
  formValues.OP_OPERATED_AT = prevFormByCode.get('OP_OPERATED_AT') ?? ctx.operatedAt
  formValues.OP_OUTPUT_QTY = prevFormByCode.has('OP_OUTPUT_QTY')
    ? prevFormByCode.get('OP_OUTPUT_QTY')
    : null
  formValues.OP_REMARK = prevFormByCode.get('OP_REMARK') ?? ''
  const tpl = resolveStepFormTemplate(step)
  filterTemplateFieldsBeyondFixed(tpl?.fields || []).forEach((field) => {
    const code = String(field.code || '').toUpperCase()
    if (prevFormByCode.has(code) || prevFormByCode.has(field.code)) {
      formValues[field.code] = prevFormByCode.has(code)
        ? prevFormByCode.get(code)
        : prevFormByCode.get(field.code)
      return
    }
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
  resetAssaySampleLocations()
  stepOpen.value = true
}

function saveStep() {
  try {
    confirmStep(
      order.value.id,
      currentStep.value.stepNo,
      stepActuals.value,
      { ...formValues },
      { equipmentId: stepExecEquipmentId.value },
    )
    stepOpen.value = false
    if (order.value?.status === 'done') {
      message.success('本步已确认，批次指令已自动完成')
    } else if (allRouteStepsConfirmed(order.value) && completionErrors(order.value).length) {
      message.warning('本步已确认；完成条件未齐，未能自动关单，原因见详情页提示')
    } else {
      message.success('本步已确认，已写入批记录')
    }
  } catch (error) {
    message.error(error.message)
  }
}

function saveFeed() {
  try {
    const lines = []
    let usedFifo = false
    let usedPick = false
    let usedRecycle = false
    let pendingContent = false
    let anyFifoOrEither = false
    for (const row of feedLineDrafts.value || []) {
      // 未勾选「本次」直接跳过，不必清实投量
      if (row.included === false) continue
      if (!(Number(row.qty) > 0)) continue
      const feedSource = normalizeRowFeedSource(row.feedSource)
      const deductSource = feedSource === 'recycle' ? 'recycle' : 'fresh'
      if (feedSource === 'recycle') usedRecycle = true
      const fifoOnly = rowFifoOnly(row)
      const either = rowEither(row)
      if (fifoOnly || either) anyFifoOrEither = true
      const useFifo = fifoOnly || (either && !row.batchId)
      if (useFifo) {
        if (!row.locationId) {
          throw new Error(`${row.item || '原料'} 请选择来源库位（储罐/仓库）`)
        }
        planFeedFifoAllocations(row.itemId, row.qty, order.value, {
          source: deductSource,
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
        throw new Error(`${row.item || '原料'} 按有效含量折算，请填写有效含量`)
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
      message.warning(anyFifoOrEither ? '请至少填写一行实投量' : '请至少选择一批并填写实投量')
      return
    }
    postFeeds(order.value.id, lines)
    openFeed.value = false
    let tip = '投料已记账，原料批次重量和罐液位已扣减'
    if (isReextractOrder.value) tip = '再提投料已记账'
    else if (usedRecycle && !usedFifo && usedPick) tip = '回流投料已记账'
    else if (usedFifo && usedPick) tip = '投料已记账，部分选手选批次、部分按库位近效先出扣减'
    else if (usedFifo) tip = '投料已记账，已按所选储罐/库位扣减'
    if (pendingContent) tip += '；有效含量待补录（可手补或化验回填）'
    message.success(tip)
  } catch (error) {
    message.error(error.message)
  }
}

function saveOutput() {
  // 仅提交勾选「本次」且实产 > 0 的行
  const postedRows = (outputDrafts.value || []).filter(
    (row) => row.included !== false && Number(row.actual) > 0,
  )
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
          contentUsed: contentPctToFraction(row.contentPct),
        }
      }),
    })
  } catch (error) {
    message.error(error.message)
    return
  }
  const pendingOutputContent = postedRows.some(
    (row) =>
      createsOutputBatchDisposition(row.disposition) &&
      !(Number(contentPctToFraction(row.contentPct)) > 0),
  )
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
  const contentTip = pendingOutputContent ? '；有效含量待补录（可手补或产出化验回填）' : ''
  if (failed.length) {
    message.warning(`${lead}。化验单未全部生成：${failed.join('；')}${contentTip}`)
    return
  }
  if (created.length) {
    message.success(`${lead}，已生成化验单 ${created.join('、')}${contentTip}`)
    return
  }
  if (skipped.length) {
    message.success(
      `${lead}。已关联既有化验单 ${skipped.join('、')}（多次过账共用，未新建）${contentTip}`,
    )
    return
  }
  message.success(
    stockOnly
      ? `${lead}，得率差已计算。已生成生产入库单，仓管确认入库后才可发货${contentTip}`
      : `${lead}，得率差已计算${contentTip}`,
  )
}

function openDecideDisposition(record) {
  if (record?.decideDisabled) {
    message.warning(record.decideDisabledReason || '硬门禁未合格，不能确认去向')
    return
  }
  decideForm.outputId = record.id || ''
  decideForm.batchId = record.batchId || ''
  decideForm.itemLabel = record.item || itemLabel(record.itemId) || '—'
  decideForm.batchNo = record.batchNo && record.batchNo !== '—' ? record.batchNo : ''
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
      batchId: decideForm.batchId || decideForm.batchNo,
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

const spawnBranchOpen = ref(false)
const spawnBranchRecord = ref(null)
const spawnBranchFormulaId = ref(undefined)
const spawnBranchSaving = ref(false)
const spawnBranchFormulaOptions = computed(() => {
  const ids = listDownstreamFormulaIds(spawnBranchRecord.value || {})
  return ids.map((id) => {
    const f = getFormula(id)
    return {
      value: id,
      label: f ? `${f.formulaNo || ''} ${f.name || ''}`.trim() : id,
    }
  })
})

/** 方案 A：由本行产出一键生成支线子指令；多下游时先选配方 */
function spawnBranchOrder(record) {
  const ids = listDownstreamFormulaIds(record)
  if (ids.length > 1) {
    spawnBranchRecord.value = record
    spawnBranchFormulaId.value = ids[0]
    spawnBranchOpen.value = true
    return
  }
  doSpawnBranchOrder(record, ids[0] || record.downstreamFormulaId)
}

function closeSpawnBranchModal() {
  spawnBranchOpen.value = false
  spawnBranchRecord.value = null
  spawnBranchFormulaId.value = undefined
}

async function confirmSpawnBranchModal() {
  if (!spawnBranchRecord.value || !spawnBranchFormulaId.value) {
    message.warning('请选择下游配方')
    return
  }
  spawnBranchSaving.value = true
  try {
    doSpawnBranchOrder(spawnBranchRecord.value, spawnBranchFormulaId.value)
    closeSpawnBranchModal()
  } finally {
    spawnBranchSaving.value = false
  }
}

function doSpawnBranchOrder(record, formulaId) {
  try {
    const created = createBranchOrderFromOutput({
      parentOrderId: order.value.id,
      outputId: record.id,
      qty: record.qty,
      formulaId,
    })
    message.success(`已生成支线指令 ${created.batchNo}（待下发）`)
    openTab(`/production/work-orders/${created.id}`, `批次指令 ${created.batchNo}`)
  } catch (error) {
    message.error(error.message || '开支线失败')
  }
}

function goBatchOrder(orderId) {
  if (!orderId) return
  openTab(`/production/work-orders/${orderId}`, '批次指令')
}

function finish() {
  try {
    completeOrder(order.value.id)
    message.success('批次指令已完成')
  } catch (error) {
    message.error(error.message || '完成失败')
  }
}
</script>

<style scoped lang="less">
@import '@/styles/process-batch-page.less';

.completion-blocker-alert {
  margin-bottom: 8px;

  :deep(.ant-alert-description) {
    white-space: pre-line;
  }
}

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

.feed-tab-filter {
  margin-bottom: 0;
}

.feed-stage-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-left: 12px;
  color: #4e5969;
  font-size: 12px;
  line-height: 20px;
}

.feed-stage-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feed-material-card {
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.feed-material-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
}

.feed-material-main {
  min-width: 0;
  flex: 1;
}

.feed-material-name {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}

.feed-material-name .name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  line-height: 22px;
}

.feed-material-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.feed-material-metrics {
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  padding: 6px 10px;
  background: #e7f3f1;
  border-radius: 8px;
}

.feed-material-metrics .metric {
  display: flex;
  flex-direction: column;
  min-width: 64px;
}

.feed-material-metrics i {
  font-style: normal;
  font-size: 12px;
  line-height: 18px;
  color: #4e5969;
}

.feed-material-metrics b {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: #1f2329;
}

.feed-posting-block {
  border-top: 1px solid #f0f0f0;
  padding: 0 12px 10px;
}

.feed-posting-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;
}

.feed-posting-label {
  font-size: 13px;
  color: #4e5969;
  line-height: 20px;
}

.feed-empty {
  padding: 0 14px 12px;
  color: #86909c;
  font-size: 13px;
  line-height: 22px;
}

.feed-posting-table {
  margin-top: 0;
}

.feed-lines-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  line-height: 22px;
}

.feed-guide-qty {
  color: #307068;
  font-variant-numeric: tabular-nums;
}

.feed-history-block {
  margin-top: 16px;
}

.feed-history-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 0;
}

.feed-modal-history-table {
  margin-bottom: 4px;
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

.step-stage-table {
  :deep(.ant-table-thead > tr > th),
  :deep(.ant-table-tbody > tr > td) {
    vertical-align: middle;
    padding: 8px 10px;
  }

  :deep(.ant-table-tbody > tr > td) {
    line-height: 20px;
  }

  :deep(.ant-tag) {
    margin-inline-end: 0;
  }
}

.step-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.stack-card {
  min-width: 0;
  padding: 4px 8px;
  background: #f7f8fa;
  border-radius: 6px;
}

.stack-card-top,
.stack-card-bottom {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.stack-card-top {
  justify-content: space-between;
  margin-bottom: 2px;
}

.stack-card-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  color: #1f2329;
  line-height: 18px;
}

.stack-card-value,
.stack-card-link,
.stack-card-muted {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 18px;
}

.stack-card-value {
  color: #4e5969;
}

.stack-card-link {
  color: #307068;
  cursor: pointer;
}

.stack-card-link:hover {
  text-decoration: underline;
}

.stack-card-muted {
  color: #86909c;
}

.stack-toggle {
  align-self: flex-start;
  height: 22px;
  padding-inline: 0;
  line-height: 20px;
}

.step-action-cell {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 2px;
  row-gap: 0;
  margin: 0 -4px;

  :deep(.ant-btn-link) {
    padding-inline: 4px;
    height: 24px;
    line-height: 22px;
  }
}

.step-confirm-btn-wrap {
  display: inline-flex;
}

.output-assay-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.output-assay-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.output-assay-label {
  font-size: 13px;
  color: #1f2329;
  white-space: nowrap;
}

.output-assay-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.output-assay-header-text {
  font-weight: 600;
  white-space: nowrap;
}

.deviation-log-meta {
  font-size: 12px;
  color: #86909c;
}

.deviation-log-text {
  margin-top: 2px;
  font-size: 14px;
  color: #1f2329;
  word-break: break-word;
}

.info-label {
  color: #4e5969;
  font-size: 14px;
}

.info-value {
  color: #1f2329;
  font-size: 14px;
}

:deep(.draft-row-skipped) td {
  background: #f5f5f5 !important;
  color: #86909c;
}

:deep(.draft-row-skipped) .ant-input-number,
:deep(.draft-row-skipped) .ant-select-selector,
:deep(.draft-row-skipped) .ant-checkbox-wrapper {
  opacity: 0.65;
}

/* 「本次」勾选保持可点、不发灰 */
:deep(.draft-row-skipped) .draft-include-cell .ant-checkbox-wrapper {
  opacity: 1;
}

.search-more-row.is-disabled {
  color: #c0c4cc;
  cursor: not-allowed;
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

.readonly-text {
  color: #1f2329;
  line-height: 32px;
}

.section-meta {
  margin: 0 0 8px;
  font-size: 13px;
  color: #4e5969;
  line-height: 22px;
}

.route-stage-ref {
  margin-left: 6px;
  font-size: 12px;
}

.route-occupy-batch {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
}

.route-assay-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 20px;
}

.step-row-skipped {
  opacity: 0.55;
}

.step-name-skipped {
  color: #86909c;
  text-decoration: line-through;
}

.parallel-tag {
  margin-left: 6px;
  font-size: 12px;
}
.route-gate-tag {
  margin-inline-end: 0;
}
</style>

<style lang="less">
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

.batch-feed-modal-wrap {
  .ant-modal {
    max-width: min(1600px, 96vw);
    top: 16px;
    padding-bottom: 0;
  }

  .ant-modal-content {
    display: flex;
    flex-direction: column;
    max-height: 94vh;
  }

  .ant-modal-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
}

.batch-step-confirm-modal-wrap {
  .ant-modal {
    max-width: min(1200px, 94vw);
    top: 24px;
    padding-bottom: 0;
  }

  .ant-modal-content {
    display: flex;
    flex-direction: column;
    max-height: 92vh;
  }

  .ant-modal-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
}
</style>
