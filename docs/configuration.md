# OpenPriceHub 配置

生产迁移及部署配置：

- `config/cloudflare.local.json`：账号 ID、Worker、D1、可选 KV、HTTPS 站点与域名。
- `config/cloudflare.secrets.local.json`：Cloudflare API Token 和生产 ADMIN_KEY。
- 两个文件通过 `npm run cf:init` 创建，不覆盖已有值，不输出密钥；POSIX 权限为 600，均被 Git 忽略。

本地开发：

- `.dev.vars`：本地 ADMIN_KEY、SITE_URL；可参考 `.dev.vars.example`，不能使用生产密钥代替。
- `.env.local`：可选的公开 VITE_SITE_URL；绝不能放 VITE_ADMIN_KEY 或任何 VITE_ 开头的秘密。
- Vite 前端监听 `http://localhost:3001`，API 代理到 `127.0.0.1:8787`。

部署脚本不把本地 .env/.dev.vars 带入生产；前端仅获得公开站点地址。生产 ADMIN_KEY 通过 stdin 上传到 Worker Secrets，API Token 只用于本机 Wrangler 子进程。

完整参数字典与命令见[私有配置、迁移与部署 v1.0.0](./cloudflare-private-deployment-v1.0.0.md)。
