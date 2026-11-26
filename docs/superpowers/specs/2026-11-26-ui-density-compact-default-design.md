# 全站界面密度（默认紧凑）设计

日期：2026-11-26  
状态：待实现  
范围：`MES-for-PROCESS` 桌面端 Web（i-doms-web 同源前端）

## 1. 背景与目标

浏览器 100% 缩放时，整站视觉偏「大」、一屏信息偏少；用户在 **80% 浏览器缩放** 下观感更好。  
目标：在 **100% 缩放** 下，通过正式的「界面密度」三档，让默认档（小）接近当前 80% 的信息密度与比例，而不是用整页 `zoom: 0.8`。

## 2. 方案选择

| 方案                                                | 结论                               |
| --------------------------------------------------- | ---------------------------------- |
| A. 根节点 `zoom: 0.8`                               | 否决：弹层错位、打印/无障碍差      |
| B. 扩展现有「系统字号」为大中小界面密度，默认「小」 | **采用**                           |
| C. 仅改 `html` rem                                  | 否决：Ant Design 大量 px，覆盖不全 |

## 3. 密度档位与 Token

沿用外观设置中的 `large | medium | small`，语义从「仅列表表格」扩展为「整站界面密度」。  
**默认：`small`（≈ 当前浏览器 80% 观感）。**

| Token                  | 大 large（≈ 现状） | 中 medium               | 小 small（默认）     |
| ---------------------- | ------------------ | ----------------------- | -------------------- |
| 正文 `fontSize`        | 14                 | 13                      | 12                   |
| 控件高 `controlHeight` | 32                 | 30                      | 28                   |
| 表格行高               | 48                 | 44                      | 40                   |
| 顶栏高                 | 56                 | 52                      | 48                   |
| 内容区 padding         | 12                 | 10                      | 8                    |
| 卡片 / 搜索区内边距    | 现档               | 各收约 1 档（4px 梯度） | 再收 1 档            |
| 主从左侧单据卡         | 现 padding         | 略收                    | 明显收（一屏多几张） |

实现约定：

- `html` 上写 `data-ui-density`（新）；过渡期 **双写** 旧 `data-table-density`，避免漏改选择器。
- Ant Design `ConfigProvider` 的 `fontSize` / `controlHeight` / `controlHeightSM` 随档位变化，禁止再写死 32。
- 表单控件高度样式（`form-control-height.less`）改为读取 CSS 变量（如 `--control-height`）。

## 4. 改动面

### 4.1 核心

| 文件                                                      | 改动                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/utils/tableDensity.js`                               | 扩展为界面密度 token（字号 / 控件高 / 顶栏 / 间距）；可保留表格专用字段              |
| `src/store/uiAppearanceStore.js`                          | 默认与 `normalizeDensity` fallback 改为 `small`；写出 `data-ui-density` + 双写旧属性 |
| `src/App.vue`                                             | Ant Design token 跟档位；去掉写死 `controlHeight: 32`                                |
| `src/styles/form-control-height.less`                     | 改读 CSS 变量                                                                        |
| `src/styles/table-density.less` 或新增 `ui-density.less`  | 顶栏、侧栏、页签、搜索区、卡片 padding、主从单据卡随档位                             |
| `src/layout/AppearanceSettingsDropdown.vue`               | 文案：「系统字号」→「界面密度」；提示改为控制整站                                    |
| `.cursor/rules/design-tokens.mdc`（及必要时 form-fields） | 补充密度三档，避免后续再写死 32                                                      |

### 4.2 布局壳（优先变量化）

- `AppHeader.vue`、`GlobalTabs.vue`、`MainLayout.vue`
- 列表相关全局 less（搜索区 / 工具栏 padding）

### 4.3 明确不做

- 不逐页改业务样式（靠全局 token / 选择器覆盖）
- 不使用整页 `zoom` / `transform: scale`

## 5. 旧偏好兼容

1. localStorage 仍使用字段名 `tableDensity`，取值 `large | medium | small`，**不迁键、不丢数据**。
2. 已持久化过大 / 中 / 小的用户：继续使用其存储值。
3. **从未存过**外观偏好的用户：默认 **小**。
4. 代码中 `normalizeDensity(value, fallback)` 的默认 fallback 统一为 `small`。
5. DOM：新属性 `data-ui-density`；旧 `data-table-density` 暂时双写。

## 6. 验收标准

在浏览器 **100%** 缩放、默认档「小」下：

1. 待出库主从页一屏信息密度接近用户提供的 **80% 截图**（左侧单据卡更多、基本信息区更紧）。
2. 顶栏 / 侧栏 / 页签 / 搜索区 / 表单控件 / 表格行高同步收紧，而非仅表格变小。
3. 外观设置切换「大 / 中 / 小」即时生效；刷新后偏好仍在。
4. 本地已存「大」的老用户：不受新默认「小」影响。
5. 清空 localStorage 的新用户：默认即为「小」。
6. Modal / Drawer / Select 下拉不错位、不异常裁切。
7. 配方编辑页不回归 `InternalTable`「Maximum recursive updates」红屏（与本次密度无关的既有修复保持有效）。

## 7. 风险与对策

| 风险                                | 对策                                            |
| ----------------------------------- | ----------------------------------------------- |
| 业务页写死 `32px` / `14px` 盖过全局 | 先变量化控件高度 + Ant token；遗漏页按反馈补    |
| 「小」对部分用户偏紧                | 保留三档，可选手动改回中 / 大                   |
| 双写 `data-*` 一时混乱              | 统一从 store 写出；样式优先读 `data-ui-density` |
| 打印页被密度拖小                    | 打印预览保持独立样式，不跟随 `ui-density`       |

## 8. 非目标

- 不改变业务逻辑与接口。
- 不引入第二套「字号」控件与「密度」控件并存（沿用现有单组大中小）。
- 不做按屏幕分辨率自动切换密度（仅默认值 + 手动三档）。

## 9. 修订记录

| 日期       | 变更                                             |
| ---------- | ------------------------------------------------ |
| 2026-11-26 | 初稿：方案 B，默认小，兼容旧 `tableDensity` 存储 |
