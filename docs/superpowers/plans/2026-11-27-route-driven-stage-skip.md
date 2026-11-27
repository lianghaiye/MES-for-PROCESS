# 路线驱动 · 去配方并行 · 批令支线可关

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 配方去掉并行/汇合；批令时序无 any/all；支线阶段可对本单关闭。

**Architecture:** 下发快照时按配方挂接路线给阶段打 `pathKind`；`enabledOnOrder` 默认 true，仅 branch 可改；确认/完工只认启用阶段。

## Tasks

1. `batchStageEnable.js`：pathKind 标注、启用判断、时序错误（无 any/all）
2. `snapshotSteps` 注入 pathKind + enabledOnOrder；完工/确认改用新逻辑
3. 配方编辑去掉并行列；normalize 不再写并行字段
4. 批令详情：支线「本次启用」开关；去掉并行 tag
5. 文档/种子清理
