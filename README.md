> Cloudflare 迁移/部署：`npm run cf:init` 创建私有配置文件，本地填写后运行 `cf:check`、`cf:plan`。实际执行使用 `npm run cf:deploy -- --apply`，密钥不写入仓库或构建。详见[部署说明 v1.0.0](docs/cloudflare-private-deployment-v1.0.0.md)。

> 新增：官方/第三方/独立开发者渠道报价、网站提交与管理员价格审核。入口 `/zh/submit/website`、`/zh/admin`、`/zh/websites`。本地 D1 已增量初始化，远程未迁移。详见[数据库与功能交付 v1.0.0](docs/channel-prices-developer-submissions-v1.0.0.md)。

> P1 Mock First：新增独立验证入口 `/zh/discovery-lab` 和 `/en/discovery-lab`，全部数据明确标记为模拟数据。保留原 UI，未执行 D1 迁移。详见[交付与测试报告](docs/p1-mock-first-v1.0.0.md)。

> 当前状态：保留原有架构与 UI，模型成本计算器 P0—P4 增量开发及本地测试完成，等待统一验收。详见[计算器统一验收报告 v1.0.0](docs/calculator-complete-acceptance-v1.0.0.md)。本次未修改生产 D1、执行迁移或部署。

> 下方功能清单包含此前保留的扩展模块；当前实际接入与测试范围以对应阶段报告和 `src/frontend/App.tsx` 的路由为准。

# OpenPriceHub

**AI Tools Price Comparison & Affordable Alternatives Platform**

**Find Better AI Tools. Spend Less.**

帮助 AI 创作者、独立开发者和内容生产者发现工具价格、寻找低价替代方案、比较套餐并计算实际创作成本。

## 功能

- 图片、视频、语音与 TTS、音乐四类目录；模糊搜索和套餐级多计费方式筛选。
- 产品详情、官方来源与核验日期、定向平替关系、多产品比较及四类成本计算器。
- 保留快速/详细手动比较、本地保存和 JSON 导入导出。
- D1 数据目录、价格历史、用户提交审核、校验发布、同步日志和有披露的推广链接。
- 中英文路由、桌面表格与移动卡片、预渲染、Metadata、Canonical、结构化数据和 Sitemap。

不同计价单位不混排；未知价格、功能、热度与质量不会补造。初始目录包含 9 个已核验条目及 1 个待核验条目，来源详见[运营说明](docs/catalog-operations.md)。

## 本地运行

继续使用 React 18、Vite、Tailwind、Cloudflare Worker 和 D1。

```bash
npm ci
npm run build
npm run db:migrate

# 终端一：本地 API 和 D1
npm run worker:dev -- --ip 127.0.0.1 --port 8787 --local

# 终端二：前端，监听 0.0.0.0:3001
npm run dev
```

访问 `http://localhost:3001/`，中文入口 `/zh`。后台 `/admin` 使用 `.dev.vars` 中设置的 `ADMIN_KEY`，不能使用仓库内的示例密钥。前端代理本机 8787。

本地迁移兼容旧版本手动建表方式并保留已有业务行。生产部署通过私有 JSON 配置执行：先 `npm run cf:check` 和 `npm run cf:plan`，确认目标后运行 `npm run cf:deploy -- --apply`。此流程自动备份 D1，默认排除演示种子数据。

## 验证

```bash
npm run typecheck
npm test
npm run build
```

API 与浏览器验收命令见[运营说明](docs/catalog-operations.md)。

## 文档和代码

- [审计、整改清单、Sitemap、用户流程与数据库关系图](docs/product-remediation.md)
- [来源核验、运行、迁移、管理后台、API 与测试](docs/catalog-operations.md)
- `src/frontend/catalog`：产品决策页面与共享组件。
- `src/shared/catalog`：目录类型、核验数据、筛选/成本逻辑、SEO 和持久化。
- `src/frontend/pages`：保留的手动工作区、提交页及历史页面。
- `src/worker`：新旧 API、数据库发布和服务端页面。
- `migrations`：追加迁移及旧数据库迁移登记引导。
