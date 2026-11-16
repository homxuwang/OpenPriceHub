> 当前状态：按用户要求撤回最新增量接入，恢复原首页、UI、工具库和手动计算器。扩展代码与数据保留，未接入当前默认界面。

# OpenPriceHub 目录、核验与运行说明

## 运行本次版本

- 前端：`npm run dev -- --host 0.0.0.0 --strictPort`，端口 3001。
- 后端：`npm run worker:dev -- --ip 127.0.0.1 --port 8787 --local`。
- 前端 `/api`、`/sitemap.xml`、`/robots.txt` 代理到本机 Worker。Worker 使用本地 D1；无需把 8787 暴露公网。
- 初次准备：`npm ci`、`npm run build`、`npm run db:migrate`。
- 本次本地管理员密钥保存在被 Git 忽略的 `.dev.vars`（权限 0600），未输出到日志。后台路径 `/admin`。不要把密钥提交到仓库或前端环境变量。
- `SITE_URL` 用于 Worker/静态导出规范域名，`VITE_SITE_URL` 用于前端显式规范域名。正式构建时两者应设置为同一正式 HTTPS 地址。本次本地环境使用现有公网 HTTP 地址。
- 已保留 `/calculator` 与 `/manual-compare` 的快速/详细手动工作区、本地存储键和导入导出。

## 数据来源与范围

初始目录 10 个产品/服务报价：9 个已核验，Kling AI 网页订阅待核验。Kling v2.1 on Replicate 是单独的 API 报价，不能冒充 Kling AI 网页套餐。候选厂商不要求一次性全部上架；尚未核验的 OpenAI TTS、Azure、PlayHT、Murf、Udio、Mubert、Soundraw 等没有补造价格。

来源及逐项核验说明保存在 `src/shared/catalog/seed.json`，日期为 2026-10-30：

| 目录 | 官方来源 |
|---|---|
| Midjourney | https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans |
| FLUX.1 schnell / Replicate | https://replicate.com/black-forest-labs/flux-schnell |
| Runway 订阅 | https://runway.com/pricing |
| Runway 积分 | https://help.runwayml.com/hc/en-us/articles/15124877443219-How-do-credits-work |
| Runway API | https://dev.runwayml.com/pricing |
| Kling v2.1 / Replicate | https://replicate.com/kwaivgi/kling-v2.1 |
| ElevenLabs | https://elevenlabs.io/pricing |
| Google Cloud TTS | https://cloud.google.com/text-to-speech/pricing |
| Cartesia | https://www.cartesia.ai/pricing |
| Suno | https://suno.com/pricing |
| Suno v6 消耗规则 | https://help.suno.com/en/articles/13924481 |
| Stable Audio | https://stableaudio.com/pricing |

Replicate 与 Stable Audio 动态价格在浏览器中核验。促销价未用作常规起始价。Stable Audio 官方给出的近似生成次数没有转换成“精确”单位成本；用户可输入自己的实际积分消耗。Midjourney GPU 时间没有换算成固定图片数。Suno 歌曲成对生成，下载配额与生成配额分别说明。

## 价格与推荐规则

- 产品类别独立于套餐计费方式。Pricing Model 在套餐级为数组，支持 Free、Monthly、Annual、Pay As You Go、Credit-based、Usage-based Package、Freemium、One-time Purchase。
- 价格区间/排序先选择计价口径和货币。本版公开目录价格筛选以 USD 为口径；不使用静态汇率伪装为实时货币排名。
- 同一套餐必须同时满足计费方式、商用条件、价格口径和价格范围。表格展示该匹配套餐，避免筛选年付却显示免费方案。
- 单位成本仅展示公开费率；厂商积分不能跨厂商直接排序。字符单位可精确按千/百万归一化，但字符与分钟不互换。
- 必需功能按所选套餐的 `features` 核验，不把产品级能力自动套用到免费套餐。
- 成本计算扣除公开免费额度；超额价未知时停止计算，有明确 `overagePerCredit` 时计算核验后的超额费用。年付展示月均值和实际全年预付款。
- 音乐 song 与 generation 是不同业务单位，没有明确换算时不计算相互节省。要求具体歌曲时长而厂商未公开限制时不比较。
- 平替是显式有向关系，可查询 outgoing/incoming。共享功能不等于相同质量；“Best Value”只在使用者选择的必要功能和明确用量成本下给出，并展示依据。
- 未采集可靠热门程度或质量测评，首页展示“已核验工具”和“值得查看的对比”，不制造热度/质量分。
- `affiliate_links` 独立存储；没有佣金字段传入成本、筛选和排序函数。本次无赞助或返佣链接。

## 管理和 API

发布后当前页面刷新目录；其他标签页重新聚焦时刷新。

后台支持读取当前版本、导出/编辑 JSON、结构与来源引用校验、发布、审阅用户提交、查看日志和价格历史。没有自动爬虫；同步通过人工核验后的目录导入完成。结构校验不能代替人工事实核验。

| 接口 | 行为 |
|---|---|
| GET `/api/catalog` | 最新数据库发布快照；数据库不可用时回退到随版本发布的已核验快照并明确 storage 字段 |
| GET `/api/catalog/products/:slug` | 产品与套餐 |
| GET `/api/catalog/products/:slug/alternatives?direction=incoming` | 有向关系反向查找；默认 outgoing，不生成逆向推荐 |
| GET `/api/catalog/products/:slug/history` | 已记录价格历史 |
| POST `/api/catalog/submissions` | 保存价格证据，状态 pending |
| GET `/api/catalog/admin` | 需 `X-Admin-Key`；目录、日志、提交与历史 |
| POST `/api/catalog/admin/validate` | 校验导入，不发布 |
| POST `/api/catalog/admin/publish` | 校验通过后 D1 事务更新规范化表、快照、日志与价格历史 |
| POST `/api/catalog/admin/review` | 提交标记 reviewed/rejected；不会自动发布用户价格 |

旧 platforms/models/prices/submit/admin API 仍保留，修正了 D1 `.all()` 返回对象与结果数组混用的问题。默认示例管理员密钥被拒绝。

## 迁移与发布

- `npm run db:migrate` 先通过 `migrations/bootstrap/adopt_legacy.sql` 登记旧脚本已初始化的表，避免重复示例 INSERT，再顺序执行未应用迁移；新数据库执行完整迁移。
- `0003_product_catalog.sql` 仅新增表和索引。
- `0004_verified_catalog_seed.sql` 写入核验快照。原 `platforms/plans/models/rules/submissions` 的行保持不变。
- 目录新版本以 `catalog_revisions` 最新记录为公开来源；规范化行保留用于历史/审计，不会因旧行存在重新出现在公开目录。
- `price_history` 只记录价格、币种、计费周期或计算规则发生变化的版本；重复发布不伪造价格变更。
- 修改初始数据后可在尚未上线前运行 `npm run catalog:seed`；已上线后不得改写已应用迁移，应通过后台发布或追加迁移。
- 本次仅应用本地迁移，未部署 Cloudflare，也未修改远程 D1。生产仍需真实 D1/KV ID、通过 secret 配置的管理员密钥及正式域名。

## SEO 与测试

`npm run build` 会生成具有实际产品、套餐、差异和来源内容的预渲染页面、独立 metadata、Canonical、BreadcrumbList 和 sitemap。Worker 对浏览器与爬虫返回相同内容，并保留构建产物哈希路径。筛选页 noindex；无内容/未核验平替页不进入 sitemap；`ai-tts` 规范化到 `ai-voice`。

```bash
npm run typecheck
npm test
npm run build
# 后端已在 8787 启动时（仅用于本地数据库）：
node scripts/api-check.mjs
# 使用已有 Playwright 安装，或先自行安装其浏览器运行环境：
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/browser-check.mjs
```

API 检查会在本地重复发布相同目录，并生成一条明确标注 QA、随后驳回的测试提交。不得将该检查脚本指向生产服务。

推广链接可通过可选 `affiliateLinks` 数组维护：id、productId、url、disclosure、active。必须提供披露，页面链接标记 sponsored/nofollow，佣金不参与排名。
