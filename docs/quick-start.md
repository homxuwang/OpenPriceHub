# OpenPriceHub 快速开始

## 本地开发

```bash
npm ci
# 已有 .dev.vars 不要覆盖；新环境参考 .dev.vars.example 填写独立的本地管理员密钥
npm run db:migrate
npm run worker:dev
# 另一个终端：
npm run dev
```

前端 `http://localhost:3001/zh`，API 运行在 8787。管理员入口 `/zh/admin`；开发者提交 `/zh/submit/website`。

本地开发的旧种子数据仅供历史兼容及演示，不代表最新官方报价。当前功能与测试范围见对应阶段报告。

## 配置 Cloudflare 部署

```bash
npm run cf:init
# 编辑 config/cloudflare.local.json 和 config/cloudflare.secrets.local.json
npm run cf:check
npm run cf:plan
# 由你确认目标后在本机执行：
npm run cf:deploy -- --apply
```

普通参数和密钥分别保存在被 Git 忽略的本地 JSON 中。默认不把旧演示数据迁入生产，部署前自动备份 D1。未带 --apply 仅显示计划，不执行远程操作。

实际访问地址以你填写的 siteUrl 为准，不从账号 ID 猜测 workers.dev 子域名。Cloudflare 部署采用 Workers 静态资源与 D1。

详见[私有配置、迁移与部署](./cloudflare-private-deployment-v1.0.0.md)、[配置文档](./configuration.md)、[部署指南](./deployment.md)。
