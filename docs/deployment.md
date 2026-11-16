# OpenPriceHub 部署指南

当前使用配置驱动的 Cloudflare Workers + D1 部署，不再运行旧版打印密钥、改写 wrangler.toml 的初始化流程。

1. 运行 `npm ci`、`npm run cf:init`。
2. 本地填写 `config/cloudflare.local.json`（普通参数）及 `config/cloudflare.secrets.local.json`（密钥）。文件已忽略，不要提交。
3. 运行 `npm run cf:check`、`npm run cf:plan`，确认目标。
4. 本机执行 `npm run cf:deploy -- --apply`。脚本先测试和构建，再备份、迁移、上传 Secrets、部署并验证。

只迁移：`npm run cf:migrate -- --apply`；只备份：`npm run cf:backup -- --apply`。不加 --apply 只显示计划。

完整字段、执行顺序、备份及恢复边界见[私有配置、迁移与部署 v1.0.0](./cloudflare-private-deployment-v1.0.0.md)。本次没有进行远程部署验收。
