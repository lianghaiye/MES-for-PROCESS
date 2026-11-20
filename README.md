# 流程型 MES（Web）

连续线 / 流程型制造执行系统前端演示：Vue 3 + Webpack（Vue CLI）+ Ant Design Vue。  
面向配方、产线、投料计划与批次指令等场景；**不含**离散产品 BOM、生产/总装工单、工程变更等模块。

- **在线预览**：[https://lianghaiye.github.io/MES-for-PROCESS/](https://lianghaiye.github.io/MES-for-PROCESS/)
- **代码仓库**：[https://github.com/lianghaiye/MES-for-PROCESS](https://github.com/lianghaiye/MES-for-PROCESS)
- **配套小程序**：[MES-FOR-PROCESS-MOBILE](https://github.com/lianghaiye/MES-FOR-PROCESS-MOBILE)（批次执行 / 交班能耗；H5 预览见该仓库 README）

## 技术栈

| 项   | 选型                                  |
| ---- | ------------------------------------- |
| 框架 | Vue 3（JavaScript）                   |
| 构建 | Webpack（`@vue/cli-service`）         |
| UI   | Ant Design Vue 4                      |
| 路由 | Vue Router 4                          |
| HTTP | Axios（含 Token 注入与 401 刷新占位） |
| 数据 | 本地 Mock（`src/mock`）               |

## 功能概览

- 顶栏一级模块 + 左侧二级菜单；**全局多页签**（首页不可关闭）
- Mock 登录（任意非空账号密码）
- **产品工艺**：配方、产线、工序/工艺相关主数据
- **计划**：投料计划、班组能耗等
- **生产**：批次指令、投料过账、产出入库、返工批次等
- 销售 / 采购 / 库存 / 质检等共用能力保留，已去掉离散工单相关入口与字段

## 环境要求

- Node.js **18+** 或 **20 LTS**（推荐 20）
- npm 9+（已随 Node 安装）

## 快速开始

```bash
cd MES-for-PROCESS
npm install
npm run serve
```

浏览器访问：<http://localhost:8080>

默认账号：`admin` / 任意密码

> 本机只保留一个 `npm run serve`（默认 **8080**）。不要另起 8081/8082，以免占内存。

## 常用命令

```bash
npm run serve    # 开发
npm run build    # 生产构建（输出 dist/）
npm run lint     # ESLint 检查并自动修复
npm run format   # Prettier 格式化
```

## 目录结构

```
src/
├── api/           # 接口定义（对接后端时扩展）
├── composables/   # 组合式逻辑（如全局页签）
├── config/        # 菜单与路由标题配置
├── layout/        # 顶栏、侧栏、页签、主布局
├── mock/          # 本地 Mock 数据
├── router/        # 路由与登录守卫
├── styles/        # 全局样式
├── utils/         # axios 封装、鉴权工具
└── views/         # 页面（product-process / planning / production / …）
```

## 对接后端

1. 在 `.env.production` 中设置 `VUE_APP_API_BASE_URL`
2. 在 `vue.config.js` 的 `devServer.proxy` 中配置代理（按需）
3. 将 `src/mock` 替换为 `src/api` 真实请求

统一响应约定（`src/utils/request.js`）：

```json
{ "code": 0, "data": {}, "message": "ok" }
```

## GitHub Pages 在线预览

推送 `main` 后由 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 自动构建并发布。

**首次**在仓库启用 Pages：

1. 打开 [Settings → Pages](https://github.com/lianghaiye/MES-for-PROCESS/settings/pages)
2. **Build and deployment → Source** 选择 **GitHub Actions**（不要点 Jekyll / Static HTML 的 Configure）
3. 等待 Actions 中 **Deploy to GitHub Pages** 成功后访问上方预览链接

## 包管理器说明

本项目默认使用 **npm**。
