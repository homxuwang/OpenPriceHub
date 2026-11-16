# OpenPriceHub P1 Mock First：交付与测试报告

版本：v1.0.0

状态：Mock First 功能及测试完成，等待验收。数据库路线继续采用 D1。

## 1. 范围与入口

- 中文：`/zh/discovery-lab`
- 英文：`/en/discovery-lab`
- 原导航的 AI Tools 菜单新增「P1 模拟验证 / P1 Mock Lab」。原首页、工具库、手动计算器、TTS 和音乐手动比较入口保留。
- 页面醒目标记模拟数据；所有 SIM 产品、模型、渠道、价格及关系均为虚构测试夹具，没有真实厂商报价或购买链接。
- 页面设置 noindex/nofollow；不加入 Sitemap。
- 不执行 D1 迁移、不新增 Migration、不改生产数据或 Worker 接口，不部署。

这是独立的 P1 验证入口。现有手动计算器继续保留原逻辑，并未被宣称已经迁入新引擎。P1 内所有分类、搜索、条件筛选、场景、平替及比较共用同一引擎。

## 2. 现有代码检查与实现边界

检查了 App.tsx 路由、Layout 导航、国际化 Context、AudioCompare、D1 migrations/0003_product_catalog.sql、Worker 目录、迁移脚本、TypeScript/Vitest 配置及现有浏览器脚本。现有界面使用原数据路径，扩展目录代码尚未成为当前默认界面。

采用增量入口，避免将旧数据对象直接假定为规范化后的 P1 实体。新类型与 D1 设计保持语义兼容，使用稳定字符串 ID、关联字段、十进制字符串、UTC 时间。它们是 Repository 传输契约，不是已落地的数据库 DDL；未来 D1 API 应在服务层完成 snake_case 字段及关系映射。

| 文件 | 职责 |
|---|---|
| src/shared/discovery/types.ts | Category/Product/Model/Provider/Channel/Offer/Plan/Component/Entitlement/Attribute/Tag/Source/Alternative/Experience、查询及报价类型 |
| src/shared/discovery/fixtures.ts | 五类虚构实体与正常、缺失、过期、异常、积分池冲突、多渠道夹具 |
| src/shared/discovery/decimal.ts | BigInt 精确有理数运算、十进制解析与最终输出舍入 |
| src/shared/discovery/repository.ts | CatalogRepository 接口、MockRepository、ApiRepository、响应结构与关联校验 |
| src/shared/discovery/engine.ts | 模糊搜索、组合筛选、硬性条件/偏好匹配、统一报价、定向平替、同条件节省计算 |
| src/frontend/discovery/context.tsx | 注入 Repository、加载/错误/取消状态；页面无需导入夹具 |
| src/frontend/pages/DiscoveryLab.tsx | 保留现有样式体系的中英文响应式验证页面 |
| tests/discovery.test.ts | 新增 43 项领域及 Repository 契约测试 |
| scripts/discovery-check.mjs | 五类、两种 Repository、桌面/移动端浏览器测试 |

App.tsx、Layout.tsx、en.ts、zh.ts 只增补路由、入口和文案。未修改原计算器及旧页面的业务实现。

## 3. Repository 切换

默认 Mock：

```bash
npm run dev -- --host 0.0.0.0 --port 3001 --strictPort
```

API 模式（配置 Vite 启动/构建环境后重启或重建）：

```bash
VITE_P1_REPOSITORY=api npm run dev -- --host 127.0.0.1 --port 3002 --strictPort
```

ApiRepository 默认 GET `/api/p1/catalog`，要求返回 types.ts 中 `Catalog` 的完整 JSON，`schemaVersion: 1`、明确 `simulated`、实体数组及合法关联。服务层负责把实际数据库记录映射到该契约。当前没有实现生产 API 端点；直接选择 API 模式而未提供端点会展示错误，不静默回退 Mock。

页面仅消费 Context 和领域引擎。测试/其他宿主也可向 DiscoveryProvider 注入任何实现 `load(signal?: AbortSignal): Promise<Catalog>` 的 Repository。API 状态码、无效 JSON 结构、重复 ID、孤立关系、把 simulation 标为 live 都会拒绝；金额格式异常按套餐由引擎阻断，不使其他正常套餐不可查看。

## 4. 数据与计算规则

- 五类默认场景：图片数量（1024 分辨率）、视频秒数（standard 质量）、TTS 字符数、歌曲数量、LLM 输入/输出 token。
- 属性：商用支持作为硬条件、API 作为偏好；标签支持组合筛选；搜索覆盖产品、模型、渠道、服务商、属性及标签。
- 所有场景采用相同 Request → discover/quote 流程。新增 Discovery Experience 是新增数据配置，不复制引擎。
- 支持 Free、Monthly、Annual、Pay As You Go、Credit-based、Usage-based Package、One-time Purchase。
- 输入金额与数量最多 30 位数字、12 位小数，不接受负数、指数、NaN、Infinity；离散数量必须是整数。
- 内部使用 BigInt 分子/分母精确运算，最终展示最多 12 位小数、half-up。节省比例使用未舍入金额，不从显示值反算。
- 输出分别包含实际购买金额、分摊消耗成本、剩余额度及有效单位成本；消耗成本不是账单。
- 月付额度按月；年付展示全年预付加本月超额费以及月均值，不把一个月用量伪装全年预测。年付与其他付款承诺不直接算节省。
- 包按需要包数向上取整；积分必须有相同 poolId 和明确消耗率。有效单位成本按实际请求的物理单位计算，不把厂商积分当通用货币。
- 一次性套餐按声明的有限额度处理，不假定无限使用、自动重复购买或终身权益。
- 缺失金额、额度、来源、过期规则、无超额条款、不同计量维度、不同分辨率/质量条件均明确阻断。未知不等于免费。
- LLM 输入和输出逐项计费；不把不同 token 项的单价合并成一个有效单位价格。
- 选择基准和多个方案可比较购买金额及节省；不同币种、请求、必要条件或付款承诺不能直接计算节省。不提供无依据的质量或热度评分，不混排不可比价格。
- 定向平替显示声明的用途和差异，A→B 不隐含 B→A；当前示例明确标注商用许可差异。偏好仅显示匹配数，不冒充质量评分。

第一版限制：假设从零余额购买；不计算税费、汇率、优惠券、跨月结转、退款、复杂阶梯及多额度订阅组合。不支持的混合收费直接阻断，不遗漏费用后给出低价结论。上述限制在界面或受阻原因中体现。将来可以扩展规则，但不能仅配置新场景就假定任何新计费语义都自动支持。

## 5. 实际测试结果

| 验证 | 结果 | 范围 |
|---|---|---|
| npm run typecheck | 通过 | 全项目 TypeScript |
| npm test -- --reporter=dot | 124/124 通过，7 个文件 | 新增 43 项 P1 测试，原有 81 项回归 |
| npm run build | 通过 | Vite 生产构建；未部署 |
| scripts/discovery-check.mjs | 28 组检查通过，页面错误 0 | Mock/API × 1440/390px × 五类流程、异常数据、7 类计费展示、多选、属性匹配、空结果 |
| scripts/audio-check.mjs | 18 组检查通过，页面错误 0 | 原首页、工具库、TTS、音乐、手动计算器及价格交互 |

浏览器 28 组统计：20 组分类主流程 + 4 组筛选/异常数据流程 + 1 组新增场景 + 2 组 API 失败 + 1 组中文模拟标记。每组包含多个断言，并非 28 个页面。API 模式使用真实 ApiRepository fetch 和浏览器受控 HTTP 响应，并在独立 Vite 进程设置 VITE_P1_REPOSITORY=api；没有连接真实生产 API 或数据库。

关键测试断言：

- 图片、视频、TTS、音乐、LLM：搜索→需求匹配→计价→选择基准→平替节省→第二服务商搜索全部完成。
- 模拟基准与平替同条件节省 50%；渠道独立且可提供同一模型。
- 月付 10、额度 20、用量 10：购买 10、消耗分摊 5、剩余 10。
- 年付 120、月额度 20：购买 120、月均 10；不与月付直接算节省。
- 包价 10、包额 20、用量 21：购买 20；一次性或免费额度不足且无超额费时阻断。
- 积分包 5/30 credits、每图 4 credits、10 图：购买 10、消耗分摊约 6.666666666667、余额 20 credits；跨池阻断。
- 缺失价、过期价、负数、无效单位大小、重复价格组件均不生成免费报价。
- 新增 campaign 场景（30 图）通过 API 响应注入，同一页面和引擎返回 USD 6，无新增分类代码或计算器。
- API HTTP 503 和无效结构展示错误，没有 Mock 回退。

测试中发现并修复：将浏览器原生 fetch 保存为实例方法会导致 Illegal invocation，现通过调用 globalThis.fetch 的包装函数解决；浏览器 API 模式已复验通过。

原有 catalogMigration.test.ts 在 Python `sqlite3.connect(':memory:')` 执行历史 SQL 兼容测试。它只使用内存 SQLite，不执行项目 D1 迁移，也不能作为 D1 目标库验收结果。

## 6. 复现方法

先启动默认 3001 开发服务，再运行：

```bash
npm run typecheck
npm test -- --reporter=dot
npm run build
node scripts/discovery-check.mjs
node scripts/audio-check.mjs
```

浏览器脚本需要外部环境提供 Playwright/Chromium。本次复用环境中已有安装，通过 `PLAYWRIGHT_MODULE=/home/dev-user/projects/earth-radio/node_modules/playwright/index.mjs` 指定，没有修改本项目依赖或锁文件。其他环境可提供自己的 Playwright 路径。TEST_URL 可指定主服务地址；P1_API_TEST_PORT 默认 3002，测试启动的 API 模式 Vite 进程结束后自动关闭。

## 7. 验收边界

已完成 Mock First 前端与核心业务验证。本阶段不代表真实报价核验、生产 API 完成、D1 字段落地、生产权限整改或远端数据库验收通过。现有首页和计算器保持可用，新增验证页面与旧业务数据隔离。

本阶段到此停止，等待验收。

## 后续更新：搜索多选与场景名称

- 搜索框支持已有产品、模型和服务商的模糊下拉建议；以实体类型和稳定 ID 多选，同名不同类型不会混淆，多项采用并集。支持移除、清空、键盘方向键/Enter/Escape。
- 切换场景清除旧选择和关键词，并关闭建议菜单；候选仅取自当前 Repository 中当前场景可用的实体。
- 默认需求场景改为「文生图、文生视频、文本转语音、文生音乐、文本生成 / API」，支持中文 nameZh 和英文 name。新配置的场景仍可由 Repository 提供，不硬编码分类计算逻辑。
- SIM 表示 simulated；统一模拟数据提示保留，不再放在场景名称中。产品及价格仍为测试夹具。
- 最新验证：126 项自动化测试通过；29 组 Mock/API 桌面及移动端浏览器检查通过，页面脚本错误 0；类型检查通过。新增断言覆盖模糊建议、模型多选、单项移除、清空、服务商筛选、场景切换和中文场景文案。

## 导航与命名更新

AI 工具菜单按全部、AI 生图、AI 生视频、AI 语音生成、AI 音乐生成、LLM/API 分组；桌面下拉和移动菜单保持一致。成本比较菜单包含模型成本计算器及「智能选型与比价」（原产品与成本验证），英文为 Tool Finder & Comparison。原有路由继续有效，页面模拟数据提示保留。

验证：中英文桌面/移动导航共 8 组检查通过，页面脚本错误 0；覆盖菜单分组、跳转、切换及 Escape 关闭。类型检查和生产构建通过。
