# P1 数据迁移方案与验收矩阵 · v1.0.0

> 路线更新（2026-11-06）：后续采用 Cloudflare D1。本文为历史 PostgreSQL 草案，不再作为实施依据；请以 [D1 适配方案 v1.1.0](../p1-d1-adaptation-v1.1.0.md) 为准。

日期：2026-11-06 UTC。**本文件完成步骤 4 的方案设计，不是迁移执行报告。**

## 1. 当前执行状态

| 验收项 | 当前结果 |
|---|---|
| ERD、字段字典、唯一约束、索引 | 已提交设计稿 |
| 迁移前数据核对 | 已以 mode=ro 读取本地 D1 基线；不是生产库盘点 |
| SQL Migration | **待用户确认后生成** |
| 数据库迁移 | **未执行** |
| 迁移后核对 | **未执行，不填写假结果** |
| 典型查询测试 | 查询与断言已设计；目标 PostgreSQL 未建立，未执行 |
| 跨类别属性测试 | 用例和拒绝条件已设计；未执行 |
| 生产读写切换、部署、删除旧表 | 不在本轮自动执行范围 |

现有 `migrations/0001..0004` 为 SQLite/D1，不能把本方案直接追加为 D1 的 0005。确认后 PostgreSQL Migration 另放独立目录并使用显式目标连接，不复用可能指向远程 D1 的脚本。

## 2. 迁移前基线（只读实测）

| 源表 | 行数 | 目标核对方式 |
|---|---:|---|
| d1_migrations | 4 | 只归档，不写入 PostgreSQL migration journal |
| platforms | 3 | 全行原档 + Provider/Channel 映射或待审 |
| plans | 4 | 全行原档 + 稳定套餐/候选版本或待审 |
| models | 6 | 保留 ID 映射；不能仅按名称合并 |
| rules | 6 | 保留原 unit_definitions；明确适用套餐后才发布 |
| submissions | 0 | 不删除，切换前重取快照 |
| categories | 4 | 映射四类；新 llm_api 为字典项，不代表新增真实报价 |
| providers | 10 | 组合名进入人工身份拆分，不直接当单一组织 |
| data_sources | 12 | 每条 URL/日期/说明保留；来源未重新核验 |
| products | 10 | 产品 ID/slug 对照与全部原记录 |
| product_models | 11 | 全部 legacy_model_id 为空，模型身份待映射 |
| offers | 10 | 产品和渠道明确后映射；不伪造渠道运营方 |
| pricing_plans | 19 | 每条 source_id 非空；全部保留，是否可发布由证据决定 |
| pricing_components | 16 | 原币种、单位、分母、限制、公式字段逐条核对 |
| alternatives | 6 | 保留方向，不自动补逆向关系 |
| product_feature_attributes | 18 | 通过属性词典映射；保留来源 |
| price_history | 19 | 全部原档；引用与内容哈希逐条核对 |
| catalog_revisions | 6 | 全部原 JSON 原文保留，不能只迁最新快照 |
| data_sync_logs | 6 | 保留批次信息；不将旧日志变成新的审核证明 |
| affiliate_links | 0 | 与排名分离；空表不等于可删除 |
| catalog_submissions | 4 | 保留状态、备注及隐私字段；不将测试提交当厂商数据 |

本地外键检查：0 条违规。产品状态：9 verified / 1 pending。套餐记录的核验日期均为 2026-10-30。此状态是源库记录，不是本轮重新核验结论。

**注意：当前服务仍运行，以上不是冻结快照。真正迁移前必须重新捕获一致快照、数量和哈希。** 本轮不读取或导出用户提交内容、不接触凭据。

## 3. 重要映射决策

### 3.1 身份映射

- 目标 UUID 使用版本化映射清单；建议对源库标识+源表+源主键生成确定性 UUID，使重试幂等。
- 人工确认合并时清单可以多源 ID 指向一目标 ID；清单记录审核者、依据、版本及理由，绝不能仅以展示名称自动合并。
- 原 `Replicate / Black Forest Labs`、`Replicate / Kuaishou` 是角色混合文本。候选拆分为模型开发方与渠道运营方，但必须有来源确认后采用。
- `Midjourney`、`Standard voices` 等旧“模型名”可能是产品/系列/服务类别，先保留 unresolved，不凭名称创造精确模型版本。
- 原 models 的 text 只映射到 llm_api 分类；audio 不能无条件变 voice；跨模态模型允许多类别。
- 旧 stable text ID 与 URL slug 通过映射保持兼容；现有 localStorage 数据不在本次迁移中修改。

### 3.2 套餐与规则

| 源字段/行为 | 目标处理 |
|---|---|
| pricing_plans.amount + billing_cycle | 映射固定付费组件；若旧 amount=0 只是按量入口价，不能创建免费套餐结论 |
| pricing_models JSON 数组 | 映射 plan_pricing_models；freemium 保留营销属性，不直接推定额度 |
| components.rate/unit/unitSize | usage_pricing_rules 的原始报价与分母；只做有证据的同维度转换 |
| included / allowancePeriod | plan_entitlements；day/month/once 分开，未知重置不猜测 |
| creditAllowance / creditsPerUnit | 池内积分权益 + credit_consumption_rules；池身份未知待审 |
| overagePerCredit | 已知池的超额货币规则，不能直接当每图或每字符价 |
| model/resolution/quality/durations/maxDuration | 精确版本引用、类型化属性与条件；版本身份未知暂不发布该规则 |
| limits/freeAllowance 文本 | 原文保留，结构化事实由人工核对后填写，不通过自由文本猜额度 |
| 旧 rules + 平台下所有 plans 的组合 | 不继承错误的笛卡尔积；需要适用套餐证据；无证据保留旧接口行为但不发布为新标准价 |
| 旧 catalog_revisions 全量快照 | 只读原档与兼容重放材料；目标规范化表是唯一运行时权威 |

### 3.3 历史迁移

1. 原 price_history 的 19 行及 6 个目录版本全部进入只读 `legacy_archive`，逐行保留原主键、原始 JSON 文本和 SHA-256。
2. 从历史和当前条款提取候选 plan_versions，按全部条款内容去重，不按金额独自去重。
3. 可明确解释的历史转换为目标版本；不可解释的历史保留归档与映射状态，不伪造 effective_at。原 recorded_at 只能代表记录时间，不能当厂商生效日。
4. 由于旧历史未必有真实生效时间，**不要求目标 price_history 事件数等于 19**；要求原档 19/19 可重现，候选映射和待审之和覆盖全部。
5. 新公开发布事件只有在审核通过且有效时间明确后追加；迁移不能制造“已重新核验”的事件。
6. 旧历史、当前版本与源快照之间冲突必须列入 discrepancy 清单，不以最新写入无条件覆盖过去事实。

## 4. 分批迁移与确认门槛

### A. 确认设计和测试目标（当前等待）

确认 PostgreSQL 主版本、独立测试库/托管方式、本版结构、源数据边界。不得在对话中粘贴生产密码；实施时使用受控 secret/本地忽略配置。

### B. 确认后生成 Migration 和工具

生成以下独立、可审核 Migration 包（**本轮未生成文件**）：

1. 字典、组织、产品、模型、版本、渠道与 Offer。
2. 套餐版本、价格、权益、条件、来源、历史。
3. 属性、标签、需求入口、匹配与排序。
4. 定向关系、审计、FK/唯一键/必要触发器/权限。
5. 导入暂存与只读 legacy_archive；不附未经证实的厂商价格种子。

只添加目标库结构；旧 D1 迁移不重写、旧生产不 DROP。每份 Migration 记录校验和、依赖顺序和目标 schema。

### C. 隔离测试库执行

- 获取一致性源快照；生成表数量、逐行规范化哈希及文件 SHA-256 清单。
- 在独立测试库建表并导入归档，按字典→身份→关系→版本→规则→历史候选顺序映射。
- 所有 FK/唯一约束保持开启；不能为“迁移通过”关闭约束或把非法字段设默认 0。
- 单批事务失败就回滚该批；run_key、稳定 ID 与 publication_key 防止重试重复。
- 待审记录保存原档及 reason，不丢弃。统计区分 raw_rows、mapped、quarantined、deduplicated。

### D. 数据核对和兼容验证

- 每张源表原档行数/主键集合/哈希完全一致；保留已移除或过期的历史版本。
- target 映射数量按关系拆分统计，不能要求所有新表机械等于旧表行数。
- 核对每条实际价格的原币种、原单位、分母、金额、来源、周期及条件；未知仍为未知。
- 新适配器输出旧 API 合同，比较字段差异；修正原错误计算的差异明确列为 expected_delta 并给原因，不能偷偷改旧结果。
- 不修改当前 UI 和浏览器存储。仅对隔离测试数据运行写入、发布与保护触发器测试。

### E. 上线前独立确认

只有全部验收通过才提出切换：先 shadow read 比较结果，不对用户流量输出新数据；指定维护窗口冻结旧写入、补齐增量、重新对账，最后修改连接适配。部署和生产迁移需单独明确批准。

不采用无协调的双写。价格、权益、规则、来源必须随版本原子切换，不能新价配旧权益。

## 5. 回滚与兼容

- 测试导入失败：保留失败日志，回滚目标批次，不接触 D1。
- 切换前失败：移除测试路由/连接配置即可，现有服务无需回滚数据。
- 切换后尚无新写入：确认后恢复旧读取开关。
- 切换后已有新写入：先冻结写入并导出变更，做显式逆向映射/人工对账；**不能直接切回旧库而丢弃新记录**。
- 原表/归档删除、旧 API 下线不属于 P1 默认范围。保留期限另行批准。
- PostgreSQL 的 UUID、numeric、时间类型与 D1 prepare/batch 不兼容：增加数据访问适配器，返回金额字符串；不将数据库切换伪装为只改一条 URL。
- 旧模型/产品 slug、category=text/audio、年月周期、localStorage v1 和 JSON 导入格式保持兼容读取。

## 6. 典型查询设计（只读草案，未执行）

以下 SELECT 面向本版目标 schema，仅作验收设计，不是 Migration。参数由驱动绑定。

### Q1. 一个模型版本在哪些渠道提供

```sql
SELECT mv.id AS model_version_id, p.name AS product_name,
       ch.name AS channel_name, provider.name AS operator_name,
       o.id AS offer_id, om.external_model_key
FROM oph.model_versions mv
JOIN oph.offer_models om ON om.model_version_id = mv.id
JOIN oph.offers o ON o.id = om.offer_id
JOIN oph.products p ON p.id = o.product_id
JOIN oph.channels ch ON ch.id = o.channel_id
LEFT JOIN oph.providers provider ON provider.id = ch.operator_provider_id
WHERE mv.id = $1 AND om.availability = 'available'
  AND o.lifecycle = 'active' AND ch.lifecycle = 'active';
```

断言：同一模型版本可返回多个渠道，渠道运营方不被误当模型开发方；未证明 available 的关系不进入结果。

### Q2. 获取指定时间的套餐版本

```sql
WITH latest AS (
  SELECT h.*, row_number() OVER (
    PARTITION BY h.plan_id
    ORDER BY h.effective_at DESC, h.event_sequence DESC
  ) AS rn
  FROM oph.price_history h
  WHERE h.effective_at <= $1 AND h.recorded_at <= $2
)
SELECT p.id AS plan_id, v.id AS version_id, v.currency_code,
       v.billing_cadence, v.terms_valid_until
FROM latest h
JOIN oph.pricing_plans p ON p.id = h.plan_id
JOIN oph.plan_versions v ON v.id = h.plan_version_id
WHERE h.rn = 1 AND h.action IN ('publish', 'replace')
  AND v.publication_state = 'published'
  AND (v.terms_valid_until IS NULL OR v.terms_valid_until > $1);
```

$1 是业务时间，$2 是系统已知时间；撤回/过期先选最新事件再过滤，不回退旧价。此查询只解析版本，不直接给“最低价”；还须验证来源时效、全部使用量与条件。

### Q3. 获取同一版本的所有计费方式与来源

```sql
SELECT pm.pricing_model_code, s.source_key, s.url,
       s.verification_state, s.verified_at, s.valid_until, ps.role
FROM oph.plan_pricing_models pm
JOIN oph.plan_version_sources ps ON ps.plan_version_id = pm.plan_version_id
JOIN oph.data_sources s ON s.id = ps.source_id
WHERE pm.plan_version_id = $1
ORDER BY pm.pricing_model_code, s.source_key, ps.role;
```

断言：Annual + Credit-based 能同时返回；来源多行是明确的计费模式/证据组合，不将 JOIN 行数当套餐数量。

### Q4. 按类别和布尔属性筛选产品

```sql
SELECT DISTINCT p.id, p.name
FROM oph.products p
JOIN oph.product_categories pc ON pc.product_id = p.id
JOIN oph.categories c ON c.id = pc.category_id
JOIN oph.product_attributes pa ON pa.product_id = p.id
JOIN oph.attributes a ON a.id = pa.attribute_id
JOIN oph.attribute_values av
  ON av.id = pa.attribute_value_id AND av.attribute_id = pa.attribute_id
WHERE c.code = $1 AND a.code = $2
  AND av.value_boolean = TRUE
  AND pa.verification_state = 'verified'
  AND p.lifecycle = 'active';
```

断言：缺失属性不当 false，也不当 true；模型版本属性应使用 model_attributes 单独查询，不把模型能力无条件提升为整个产品能力。

### Q5. 双向查询定向平替关系

```sql
SELECT id, original_product_id, alternative_product_id, reason
FROM oph.alternatives
WHERE verification_state = 'verified'
  AND original_product_id = $1;

SELECT id, original_product_id, alternative_product_id, reason
FROM oph.alternatives
WHERE verification_state = 'verified'
  AND alternative_product_id = $1;
```

断言：第一条是出向、第二条是入向；存在 A→B 不代表返回 B→A 推荐。

## 7. 价格与历史测试矩阵（待执行）

| 编号 | 测试 | 必须满足 |
|---|---|---|
| P01 | 相同模型两个渠道、多套套餐 | 模型身份共享，收费和权益独立 |
| P02 | 每 1K 与每 1M 同角色 token/字符价格 | 同维度精确换算，保留原分母；input/output 不混合 |
| P03 | 月费与每秒价格 | 不按原数字直接排名，先用相同用量报价 |
| P04 | 年付 + 月重置额度 | 同时输出预付款和月均费用，不把全年额度当随时可用 |
| P05 | 日免费额度、日期范围不明 | 返回不足以计算，不乘 30 假定月额度 |
| P06 | credit_pool A 与 B | 不允许合并余额或直接比较每积分单价 |
| P07 | 分辨率、质量、时长规则 | 精确选中正确 variant；无匹配/多匹配分别返回原因 |
| P08 | 阶梯区间相邻边界 | [lower,upper) 不重复；graduated 与 volume 结果各按定义 |
| P09 | 整包购买、最低充值 | purchase_cost 按购买粒度取整，consumed_cost 不冒充实际支付 |
| P10 | 剩余积分过期/滚存上限 | 按权益分别返回，不跨重置周期透支 |
| P11 | 缺价、0 价、负价、无穷、超精度 | NULL 不等于免费；负/非法阻止写入；真实 0 保留 |
| P12 | 发布版本更新、删除或补加规则 | 数据库拒绝；草稿修改可审计 |
| P13 | 新版本撤回/过期 | 历史查询可复现，当前查询不回退旧报价 |
| P14 | 修正历史与不同系统时间 | 新事件追加；旧 system-as-of 查询仍返回当时所知结果 |
| P15 | 重跑迁移/发布 | 同一 run_key/publication_key 不重复生成数据 |
| P16 | 少量用量/零输出 | 有效单位成本分母为零时 unknown，不输出 Infinity |
| P17 | 同时填写同组每秒/每分钟等价规则 | 不重复收费；歧义阻止发布或报价 |
| P18 | 来源缺失/过期/仅 imported_claim | 不能作为确定性的公开可比价格 |

测试采用隔离库中明确标注的数学夹具，仅用于验证算术/约束；不使用真实厂商名，也不导入公开目录，不当作产品报价补数据。

## 8. 跨类别属性与入口测试（待执行）

| 类别/配置 | 属性或用量 | 正向与反向断言 |
|---|---|---|
| Image | width_px、height_px、image_editing、image_count | 数字/布尔/数量类型正确；字符串“高清”不能填 width_px |
| Video | duration_seconds、resolution、quality、avatar_video | 秒数范围和质量枚举生效；时长条件不作用于图片计数 |
| TTS | character_count、character_counting_method、voice_cloning、audio_minutes | 字符和分钟不自动换算；克隆能力需指定模型/套餐支持 |
| Music | song_count、generation_count、duration_seconds、instrumental | song/generation 不默认等价；每次输出数需有来源和明确条件 |
| LLM/API | input_tokens、output_tokens、cached_input_tokens、context_window | 三类 token 独立计价；缓存不自动认定全部输入命中 |
| 属性单值 | 相同实体、属性写入不同当前值 | single 拒绝第二值；multi 允许不同合法值 |
| 属性归属 | model_version_id 指向另一个 model | 复合外键拒绝 |
| 字典复用 | 新入口引用已有属性和 cost metric | 仅加配置，价格规则/计算引擎不变 |
| 新属性 | 增加合法 enum/number 属性与 scope | 无需改实体表；已有规则不受影响 |
| 硬条件/偏好 | 商用许可必需、价格偏好 | 不因偏好高分绕过硬条件；未知硬条件默认拒绝 |
| 排序独立 | 改赞助/佣金记录 | 价格结果、客观排序不变 |
| 类型安全 | 条件引用其他属性值/任意 SQL | FK/发布校验拒绝；不执行脚本 |
| 入口版本 | 修改已发布配置 | 拒绝原地修改；新版本可并存重放 |

## 9. 后续交付及停止点

确认设计后先生成 Migration 包与测试工具，再执行指定隔离库迁移，并提交真实的：

- 每张源表 before/archive/mapped/quarantined/after 数量和哈希对账。
- 迁移文件版本与校验和、执行记录、失败/回滚记录。
- Q1—Q5 的参数、结果和 EXPLAIN 摘要。
- P01—P18 及跨类别属性测试通过/失败清单。
- 旧 API 合同差异、原计算器数据格式兼容结果。

全部完成后停止等待验收，不自动部署或删除旧数据。
