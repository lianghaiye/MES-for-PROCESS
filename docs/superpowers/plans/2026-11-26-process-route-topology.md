# 工艺路线拓扑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把工艺路线升级为可配置主/支拓扑（节点挂工序+设备），沉锂 MOCK 按现场图表达压滤为非主线汇合点；旧 grid 保留。

**Architecture:** 新增 `nodes[]` + `layout:'topology'|'grid'`，模型与校验独立于 `processRouteTopology.js`；编辑/详情复用产线式表格+拓扑预览；设备收集与配方挂路线适配 topology；批次仍用配方阶段快照。

**Tech Stack:** Vue3、Ant Design Vue、现有 processRouteStore / processConfigStore

## Global Constraints

- 本期不考虑产线关联
- 中文注释；业务名 `英文(中文)`
- 主控关闭清空联动字段
- 不直推 test/master；用户未要求不 commit

---

### Task 1: 拓扑模型与校验工具

**Files:**

- Create: `src/utils/processRouteTopology.js`
- Modify: `src/store/processRouteStore.js`（normalize / validate / seed version）
- Modify: `src/utils/processRouteGrid.js` 或 store 内 `collectRouteEquipmentIds` 调用点适配

- [x] 实现 `createRouteNode` / `normalizeRouteNodes` / `validateRouteTopology` / `collectTopologyEquipmentIds` / `formatTopologySummary` / `resolveRouteLayout`
- [x] store `normalizeRouteRow` 写入 `layout`+`nodes`；保存拓扑时走拓扑校验
- [x] `CURRENT_SEED_VERSION` 升到能触发沉锂种子重灌的版本

### Task 2: MOCK 沉锂路线拓扑化

**Files:**

- Modify: `src/mock/processRouteSeed.js`（`route-012` / GYLX0012）

- [x] 主线不含压滤；支线洗涤汇到压滤节点
- [x] `layout: 'topology'`，保留空 grid 或最小兼容字段

### Task 3: 拓扑预览 + 编辑/详情 UI

**Files:**

- Create: `src/views/product-process/components/ProcessRouteTopologyPreview.vue`
- Modify: `src/views/product-process/components/ProcessRouteEditorModal.vue`
- Modify: `src/views/product-process/ProcessRouteDetailView.vue`

- [x] 预览主线+支线+汇合
- [x] 编辑：节点表（路径/工序/设备/分出/汇入）+ 预览；新建默认 topology 或可选
- [x] 详情展示拓扑摘要与预览；grid 路线仍走旧视图

### Task 4: 配方设备收集 + 文档

**Files:**

- Modify: 配方侧 `collectRouteEquipmentIds` 使用处 / grid util 导出统一入口
- Modify: `docs/yunxiao/流程型MES-连续线一期需求.md`
- Modify: design spec 状态为已确认
- Create/Update: 业务知识库（若无资料根路径则放 `docs/yunxiao/` 中文名）

- [x] 拓扑路线设备并集正确
- [x] 需求与设计状态更新
