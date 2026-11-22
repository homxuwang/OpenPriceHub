# Cloudflare 私有配置、迁移与部署

版本：v1.0.0

日期：2026-11-13 UTC

状态：脚本及本地测试交付；本次未调用 Cloudflare 远程 API、未迁移生产库、未部署。

## 1. 填写位置

执行 `npm run cf:init` 后，填写以下两个文件；已存在的文件不会覆盖。当前工作区已生成。

| 文件 | 填写内容 | 是否进入 Git |
| --- | --- | --- |
| `config/cloudflare.local.json` | 账号、Worker、域名、D1、可选 KV、迁移数据选项 | 否 |
| `config/cloudflare.secrets.local.json` | Cloudflare API Token、生产 ADMIN_KEY | 否 |
| `.dev.vars` | 本地 Worker 管理员密钥及本地 SITE_URL | 否 |
| `.env.local`（可选） | 公开的 VITE_SITE_URL 等前端配置 | 否 |
| `config/cloudflare.example.json`、`config/cloudflare.secrets.example.json` | 可共享的空模板 | 是 |
| `.dev.vars.example`、`.env.example` | 不包含真实密钥的开发模板 | 是 |

新建 secrets 文件时生成 32 字节随机 ADMIN_KEY，只写文件、不打印。API Token 留空，由你在编辑器中填写。生产与本地开发密钥分别维护，不会覆盖现有 `.dev.vars`。

本地 JSON 是纯数据文件，脚本不执行其中内容、不通过 shell source/eval 读取。POSIX 下两份配置必须是 600 权限，临时目录和备份目录为 700，备份及生成文件为 600。Windows 使用同一 Node 脚本，文件保密依赖用户目录的 NTFS 权限；应仅允许本人访问。

## 2. 普通配置字典

| 字段 | 含义 |
| --- | --- |
| schemaVersion | 固定为 1 |
| target | production 或 staging，选择当前目标；不是 Wrangler 命名环境 |
| accountId | 32 位十六进制 Cloudflare Account ID |
| workerName | 当前环境的 Worker 名称；staging 与 production 应使用不同名称 |
| siteUrl | 实际访问的 HTTPS 根地址，不包含路径、查询参数或账号密码 |
| database.name | 已有 D1 数据库名称 |
| database.id | 已有 D1 数据库 UUID |
| kvNamespaceId | 可选 KV ID；不用则为 null，不会创建虚假绑定 |
| workersDev | 是否使用 workers.dev 访问 |
| customDomain | 可选的托管自定义域名；填写时必须等于 siteUrl 的主机名 |
| cronSchedules | 可选 UTC Cron，一更 `["0 1 * * *"]`，两更 `["0 1,13 * * *"]`；旧配置缺省不启用 |
| automaticFx | 可选布尔值，控制定时同步参考汇率；旧配置缺省 false |
| includeSeedData | 默认 false；不把旧演示 INSERT 当作生产数据自动载入 |

域名、D1、可选 KV 应先在你的 Cloudflare 账号创建，复制 ID 到本地配置。脚本不会猜测数据库 ID，也不会自动创建/删除远程资源。workers.dev 地址需要你从实际账号中复制；不再用 Account ID 拼出不正确的访问地址。

## 3. 密钥配置字典

| 字段 | 用途及边界 |
| --- | --- |
| CLOUDFLARE_API_TOKEN | 仅作为本机 Wrangler 子进程的鉴权环境变量；不上传到 Worker、不传入前端构建、不出现在命令参数中 |
| ADMIN_KEY | 32—256 位字母、数字、下划线或短横线；通过 stdin 上传为 Worker Secret，不写 wrangler 配置或前端 |

优先使用限定到实际账号及所需 Workers、D1 操作的 API Token；可选 KV/自定义域名涉及的权限根据实际使用配置。不使用全局 API Key，也不要求你把凭据放进聊天、GitHub Actions、命令行参数或仓库配置。

当前仓库锁定的 Wrangler 3 支持 `secret bulk` 从 stdin 接收 JSON，因此本脚本使用该能力；没有依赖新版才支持的 `deploy --secrets-file`。上传内容只有 ADMIN_KEY。服务端密钥由 Cloudflare Secrets 保存。

## 4. 常用命令

首次准备：

```bash
npm ci
npm run cf:init
# 用本地编辑器填写 config/cloudflare.local.json 和 config/cloudflare.secrets.local.json
npm run cf:check
npm run cf:plan
```

`cf:check` 只做本地校验；`cf:plan` 只显示目标、所选 Migration 和步骤。未填写的字段会报字段名称，不打印其内容。计划不联网、不构建、不生成备份或 Wrangler 临时配置。

正式操作由你在本机明确执行：

```bash
# 只备份远程 D1
npm run cf:backup -- --apply

# 只应用未执行的数据库结构迁移；迁移前自动备份
npm run cf:migrate -- --apply

# 完整部署：检查、构建、备份、迁移、上传密钥、部署、HTTP 验证
npm run cf:deploy -- --apply
```

未带 `--apply` 的 backup/migrate/deploy 只生成计划。`npm run deploy`、`npm run worker:deploy`、`npm run db:migrate:remote` 指向同一套安全入口；原来的 shell/bat 包装也调用这个 Node 实现。

旧本地命令 `npm run db:migrate` 保留原行为，仅操作本地 D1。旧远程演示数据命令 `db:seed:remote` 已移除。

可用另一组配置文件区分 staging/production：

```bash
node scripts/cloudflare.mjs plan --config config/cloudflare.staging.local.json --secrets config/cloudflare.staging.secrets.local.json
node scripts/cloudflare.mjs deploy --config config/cloudflare.staging.local.json --secrets config/cloudflare.staging.secrets.local.json --apply
```

自定义配置同样需要忽略、未跟踪和私有权限。可以放在仓库外的个人配置目录，仍需 600 权限。脚本不接受 --token 等凭据参数。

## 5. 完整部署顺序

1. 校验配置结构、ID、URL、密钥、文件权限及 Git 忽略/跟踪状态，检查可提交内容中是否含本次配置的密钥。
2. 使用最小化子进程环境运行类型检查和测试，不继承 API Token、ADMIN_KEY、其他 VITE_*、NODE_OPTIONS 或 DEBUG。
3. 清理旧 dist，用独立空 env 目录进行前端构建，仅注入公开的 VITE_SITE_URL。部署构建不产出前端 source map。
4. 扫描前端产物；使用项目已安装的 Wrangler 做本地 dry-run 打包，扫描 Worker 产物。两次扫描均检查本次配置密钥的明文及常见编码形式。
5. 把远程 D1 导出至忽略的 backups/，确认文件存在、非空且权限正确；失败就停止。
6. 保存迁移前表行数。旧业务五表只存在一部分时停止，避免猜测修复。
7. 复用已有 bootstrap 登记完整旧表的迁移记录；按文件名应用未执行的 Migration。
8. 检查外键、quick_check、迁移前后旧业务表行数；保留核对报告。
9. 通过 stdin 上传 ADMIN_KEY 为 Worker Secret。Cloudflare API Token 只作为 Wrangler 子进程凭据。
10. 部署 Worker 和静态资源，并检查配置站点的 `/zh`、`/api/websites`、`/api/models`；API 需返回成功 JSON。
11. 删除本次运行的临时 Wrangler 配置、打包文件及 Wrangler 日志，保留私有备份及行数报告。

生成的 Wrangler 配置放在忽略的 `.cloudflare-local/`，只含绑定、公开 SITE_URL 和代码/资源路径，没有 ADMIN_KEY 或 API Token。同目录放空 `.dev.vars`，避免部署读取开发密钥。正常异常均清理临时目录；强制结束进程可能留下文件，但目录仍被 Git 忽略且限制权限。

D1、Secret 更新及 Worker 部署不是一个事务。数据库迁移成功后，后续步骤仍可能失败；脚本会停止并保留备份，不会自动执行可能覆盖新业务数据的破坏性回滚。首次 secret bulk 可能先创建 Worker，密钥变更也可能影响现有 Worker，部署顺序不能视为跨资源原子切换。

## 6. Migration、历史与数据边界

默认选中：0001_init、0003_product_catalog、0005_channel_prices_and_developer_submissions、0006_accounts_and_operations、0007_candidate_and_audit_guards。默认不选中 0002_seed、0004_verified_catalog_seed；已有迁移记录保留，已执行的文件不会重跑。

`includeSeedData=true` 是显式选项，仅建议用于隔离演示环境。旧 bootstrap 为已有旧表登记 0002，避免在旧业务库补跑演示 INSERT；因此打开此选项也不保证给已有库补齐演示数据。不要修改已执行的 SQL 以强制重跑，应新增 Migration。

本方案迁移的是 schema，不会自动把你本机数据库内容上传到生产，也不会把备份导出等同于恢复成功。若要搬运本机真实数据，应针对明确来源和空目标库做独立的导出、导入、恢复演练与数据核对；禁止把全库 SQL 导入当前在线库来覆盖价格历史。

备份位于 `backups/*.sql`，行数核对位于 `backups/*-counts.json`，都不会提交。SQL 可能包含用户邮箱等真实业务数据，因此按密钥文件同样保护；不要上传到工单或共享网盘。恢复时应先恢复到新建的隔离 D1，确认数据及接口后再切换绑定，不能直接在生产原库执行 DROP/覆盖导入。

迁移行数核对会受同时发生的业务写入影响；正式切换宜选维护窗口。行数及外键检查不等同于逐字段证明所有业务数据无误，本次项目的兼容性测试还单独逐行验证了既有表。

## 7. Git 与日志保护

- config/*.local.json、.dev.vars*、.env*（示例除外）、.cloudflare-local/、backups/ 被忽略。
- 脚本拒绝当前配置被跟踪，也拒绝可提交内容中的其他本地配置或私有环境文件。Git 忽略不能保护已经进入历史的凭据，历史泄露需轮换密钥并单独清理历史。
- 已移除 wrangler.toml 中的 ADMIN_KEY；旧 setup 不再打印密钥、登录云端或改写仓库配置。
- 不继承用户的 Wrangler DEBUG 日志开关；命令输出在打印前用本次配置的密钥脱敏。Wrangler 文件日志放在私有临时目录并清理。
- GitHub workflow 只做测试和构建，push 不再自动迁移/部署，不配置 Cloudflare 账户凭据或生产密钥。
- 这些措施覆盖本流程的已配置密钥和常见误提交途径，不是对本机被入侵、恶意依赖或所有未知凭据的绝对防泄露承诺。

## 8. 验证与限制

本次验证结果：29 项部署专项测试通过（24 项配置与防泄露检查、5 项隔离流程测试）；全量 266 项自动化测试通过（13 个文件），TypeScript 类型检查通过。使用随机临时假参数在当前 Wrangler 3.114.17 实际运行了 Vite 隔离构建和 `deploy --dry-run`，配置被接受、产物未发现测试密钥、没有前端 source map。整个验证没有使用真实 Cloudflare 凭据。

专项测试覆盖配置校验、最小化环境、构建隔离、密钥脱敏、产物检测、忽略及强制跟踪检测、文件权限、默认排除种子数据、默认离线计划，以及完整流程与各失败步骤中止。完整流程使用隔离临时仓库和假 Wrangler/HTTP，未连接真实 Cloudflare。

Windows bat 使用同一 Node 入口，当前在 Linux 上检查包装逻辑，未声称完成 Windows 真机验收。真实账号权限、域名、资源绑定、远程导出/恢复和部署仍需你填好本地配置后执行验证。

官方技术依据：

- [Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Workers Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [D1 SQL / PRAGMA](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
