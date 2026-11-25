# 车间暂存与合并入库 Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** 产出可「进暂存池」，待处置列表合并入库；含量相同才可合；暂存不可普通出库/投料，允许回流的物料可回流。

**Architecture:** disposition=`staging` + batch status=`await_staging`；不生成入库单；`mergeStagingBatchesToInbound` 生成生产入库单；物料 `allowWorkshopStaging` / `allowRecycle`。

**Tech Stack:** Vue3 + Ant Design Vue + local stores

## Global Constraints

- 硬门禁下 staging 与入仓入罐相同，须化验通过
- 合并含量策略参数默认 `same`，其它选项 disabled
- 中文注释

## Tasks

- [ ] Task 1: disposition + status + helpers
- [ ] Task 2: PROCESS_ITEMS flags + 简单维护入口
- [ ] Task 3: postOutput / confirmDisposition 支持 staging
- [ ] Task 4: PendingOutputDisposition 多选合并入库
- [ ] Task 5: 投料门禁 + 功能参数预留
