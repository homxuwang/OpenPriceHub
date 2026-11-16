# P1 完整字段字典 · v1.0.0

> 路线更新（2026-11-06）：后续采用 Cloudflare D1。本文为历史 PostgreSQL 草案，不再作为实施依据；请以 [D1 适配方案 v1.1.0](../p1-d1-adaptation-v1.1.0.md) 为准。

日期：2026-11-06。**设计稿，非已执行数据库定义。** 物理 schema 暂定 `oph`。表名与目标概念不一致时明确标注复用关系。

## 0. 类型、空值与公共字段

- `U` = uuid；`T` = text；`N` = numeric(30,12)；`I` = integer；`B` = boolean；`TS` = timestamptz；`D` = date；`J` = jsonb；`C` = char(3)。未来 Migration 使用完整 PostgreSQL 类型。
- `?` 表示可 NULL；**未标 ? 均 NOT NULL**。`=值` 表示默认值；未写默认则由调用方明确提供，不能把缺失值当 0/false。
- `→表` 表示外键到该表 id；`→表.字段` 表示明确的目标键。
- 下述标记 **E** 的业务实体共享：`id U PK`（应用生成）、`created_at TS=now()`、`updated_at TS=now()`。修改时间由数据库维护。
- **A** 的追加实体共享：`id U PK`、`created_at TS=now()`，不带可修改的 updated_at。
- **R** 的关系表只含明确列出的字段；复合主键见约束文档。
- 所有审计参与者为内部 actor_key，不绑定某个 SaaS 身份服务。服务端记录，客户端不可伪造审核者。
- `lifecycle`：draft/active/retired；`verification_state`：pending/verified/stale/unavailable/imported_claim。
- `category` 的初始 code 为 image/video/voice/music/llm_api。旧 text 映射 llm_api，audio 必须人工确认 voice/music 或保留迁移待审。
- published/active 的更严格非空、关联与来源条件见约束文档；draft 允许明确的未知事实。
- 核心数值/关系不进 JSONB；仅类别扩展、特殊计价规则使用 J。原始导入 JSON 原文以 text 或独立归档保存，不能成为第二个权威价格模型。

## 1. 字典与基础业务

| 表 / 公共字段 | 完整业务字段 | 语义 |
|---|---|---|
| currencies / R | `code C PK`；`name T`；`minor_digits I`；`active B=true` | 原始结算币种字典；不是汇率表 |
| units / E | `code T`；`label T`；`dimension T`；`canonical_unit_id U?→units`；`conversion_factor N?`；`is_discrete B` | 原始计量与同维度换算；不把 characters/audio_time、song/generation 或输入/输出 token 合并 |
| pricing_models / R | `code T PK`；`label T`；`active B=true` | 七种计费模式；可追加字典，不用七张套餐表 |
| categories / E | `code T`；`slug T`；`name_en T`；`name_zh T?`；`parent_id U?→categories`；`active B=true` | 分类层级；不得自指或形成环 |
| providers / E | `slug T`；`name T`；`legal_name T?`；`website_url T?`；`lifecycle T=draft` | 组织/服务主体；名称不作为全局主键 |
| products / E | `slug T`；`name T`；`owner_provider_id U?→providers`；`website_url T?`；`summary_en T?`；`summary_zh T?`；`lifecycle T=draft`；`extension J?` | 用户产品，extension 只允许类别扩展且需 schema 校验 |
| product_categories / R | `product_id U→products`；`category_id U→categories`；`is_primary B=false` | 一个产品可多个类别，最多一个主类别 |
| models / E | `slug T`；`name T`；`developer_provider_id U?→providers`；`description T?`；`lifecycle T=draft`；`extension J?` | 独立模型身份；开发方未知不猜测 |
| model_categories / R | `model_id U→models`；`category_id U→categories`；`is_primary B=false` | 同一个多模态模型可归多个类别 |
| model_versions / E | `model_id U→models`；`version_key T`；`display_name T`；`released_on D?`；`version_kind T`；`lifecycle T=draft`；`source_id U?→data_sources` | kind=fixed/rolling_alias/unresolved；不从字符串推测发布日期 |
| product_models / R | `product_id U→products`；`model_id U→models`；`role T`；`source_id U?→data_sources`；`verification_state T=pending` | 复用原表概念；role=underlying/exposed/integrated |
| channels / E | `slug T`；`name T`；`operator_provider_id U?→providers`；`product_id U?→products`；`channel_type T`；`base_url T?`；`lifecycle T=draft` | channel_type=web_app/official_api/third_party_api/marketplace/self_hosted |
| offers / E | `product_id U→products`；`channel_id U→channels`；`offer_key T`；`name T`；`purchase_url T?`；`region_code T=unspecified`；`customer_segment T=unspecified`；`lifecycle T=draft` | 一个商品在一个渠道的入口；unspecified 不等于全球可用 |
| offer_models / E | `offer_id U→offers`；`model_version_id U→model_versions`；`external_model_key T?`；`availability T=unknown`；`source_id U?→data_sources` | availability=available/unavailable/unknown；构成跨渠道模型关系 |
| credit_pools / E | `channel_id U→channels`；`code T`；`name T`；`unit_id U→units`；`transferable B?`；`source_id U?→data_sources` | 厂商/渠道特定积分单位；transferable 未知不设 false 冒充结论 |

## 2. 来源与套餐版本

| 表 / 公共字段 | 完整业务字段 | 语义 |
|---|---|---|
| data_sources / A | `source_key T`；`url T`；`title T`；`publisher_provider_id U?→providers`；`observed_at TS?`；`retrieved_at TS?`；`verified_at TS?`；`valid_until TS?`；`verification_state T=pending`；`evidence_uri T?`；`content_sha256 T?`；`notes T?` | **目标 price_sources 的复用实体**；每次观测/证据一行，追加，不覆盖旧证据；旧日期仅保留原记录意义 |
| pricing_plans / E | `offer_id U→offers`；`plan_key T`；`name T`；`lifecycle T=draft` | 稳定套餐身份，不在此表存可覆盖的 current_price |
| plan_versions / E | `plan_id U→pricing_plans`；`version_no I`；`currency_code C?→currencies.code`；`billing_cadence T`；`billing_period_months I?`；`commitment_months I?`；`tax_mode T=unknown`；`tax_region T?`；`terms_valid_until TS?`；`publication_state T=draft`；`terms_note T?` | cadence=none/metered/monthly/annual/package/one_time；publication_state=draft/published；发布后全树冻结。金额由组件和规则表达 |
| plan_version_models / R | `plan_version_id U→plan_versions`；`offer_model_id U→offer_models` | 精确限制某套餐支持哪个模型版本，不将渠道所有模型自动加入套餐 |
| plan_pricing_models / R | `plan_version_id U→plan_versions`；`pricing_model_code T→pricing_models.code` | 一个套餐版本多种计费方式 |
| plan_version_sources / R | `plan_version_id U→plan_versions`；`source_id U→data_sources`；`role T` | role=pricing/allowance/limitation/terms；同来源可以多个角色 |
| pricing_components / E | `plan_version_id U→plan_versions`；`component_key T`；`name T`；`kind T`；`charge_group T`；`currency_code C?→currencies.code`；`fixed_amount N?`；`unit_id U→units`；`unit_quantity N`；`original_unit_text T`；`rounding_mode T=none`；`rounding_increment N?`；`source_id U?→data_sources` | kind=fixed_fee/usage_fee/credit_purchase/credit_debit/one_time_fee；usage 金额在规则中；固定金额不能与规则金额双计。unit_quantity 保留每 K/M/包等原分母 |

时间字段原则：created_at 是目标库录入时间，不能冒充 observed_at 或 verified_at。旧数据只到日期时保留日期精度说明，迁移转换为 UTC 时必须记录精度损失，不宣称精确时刻。

## 3. 权益、使用量、积分与条件

| 表 / 公共字段 | 完整业务字段 | 语义 |
|---|---|---|
| plan_entitlements / E | `plan_version_id U→plan_versions`；`entitlement_key T`；`kind T`；`charge_group T?`；`model_version_id U?→model_versions`；`unit_id U?→units`；`quantity N?`；`is_unlimited B=false`；`credit_pool_id U?→credit_pools`；`feature_value_id U?→attribute_values`；`grant_component_id U?→pricing_components`；`grant_frequency T`；`reset_period T`；`validity_seconds bigint?`；`rollover_mode T=unknown`；`rollover_limit N?`；`source_id U?→data_sources` | kind=quota/credit/feature；grant_frequency=per_subscription/per_purchase/once；reset_period=none/day/month/year；grant_component 将买包/充值组件与实际到账权益关联 |
| usage_pricing_rules / E | `component_id U→pricing_components`；`rule_key T`；`model_version_id U?→model_versions`；`unit_id U→units`；`unit_quantity N`；`unit_price N?`；`original_unit_text T`；`currency_code C?→currencies.code`；`tier_mode T=flat`；`tier_lower N=0`；`tier_upper N?`；`variant_key T`；`priority I=0`；`special_rule J?`；`source_id U?→data_sources` | tier_mode=flat/graduated/volume；区间按原 unit 计量，unit_quantity 是价格分母。special_rule 是版本化白名单，不是任意脚本 |
| credit_consumption_rules / E | `component_id U→pricing_components`；`rule_key T`；`credit_pool_id U→credit_pools`；`model_version_id U?→model_versions`；`unit_id U→units`；`unit_quantity N`；`credits_consumed N?`；`original_unit_text T`；`variant_key T`；`priority I=0`；`special_rule J?`；`source_id U?→data_sources` | 将实际输出/用量变成同池积分消耗；不附会积分的货币兑换率 |
| pricing_constraints / E | `plan_version_id U→plan_versions`；`constraint_key T`；`kind T`；`component_id U?→pricing_components`；`model_version_id U?→model_versions`；`attribute_id U?→attributes`；`value_id U?→attribute_values`；`quantity N?`；`unit_id U?→units`；`currency_code C?→currencies.code`；`enforcement T=hard`；`source_id U?→data_sources` | kind=min_purchase_amount/min_purchase_units/max_usage/max_duration/concurrency/region/commercial_use/eligibility；数量和货币含义由 kind 约束；同一约束不同时用两种值表示 |
| rule_conditions / E | `usage_rule_id U?→usage_pricing_rules`；`credit_rule_id U?→credit_consumption_rules`；`constraint_id U?→pricing_constraints`；`entitlement_id U?→plan_entitlements`；`group_no I=1`；`attribute_id U→attributes`；`operator T`；`value_id U?→attribute_values`；`upper_value_id U?→attribute_values` | owner 四选一；operator=eq/ne/lt/lte/gt/gte/between/exists；between 两边必填，exists 无值；参数缺失不视为符合 |
| price_history / A | `plan_id U→pricing_plans`；`plan_version_id U?→plan_versions`；`action T`；`effective_at TS`；`recorded_at TS=now()`；`event_sequence bigint`；`publication_key T`；`supersedes_history_id U?→price_history`；`source_id U?→data_sources`；`review_log_id U?→data_review_logs`；`reason T`；`legacy_reference T?` | action=publish/replace/withdraw；publish/replace 必有版本；event_sequence 来自数据库 sequence；旧价与规则引用不可变版本，不再覆盖 components_json |

### 3.1 条件字段的特殊说明

- 分辨率、宽高、质量、输出时长、字符计数方式、并发等通过 attributes 定义类型；条件只引用对应属性的值。
- 多个分辨率允许值使用多个 OR group；同一组里的质量+分辨率+时长条件为 AND。
- `quantity` 与 `unit_id` 的非空组合由 kind 决定；不使用“NULL 表示无限”。无限只能是明确 `is_unlimited=true` 且有来源。
- monetary component/rule 的 currency 必须与 plan_versions currency 一致；credit_debit 无货币金额。多币种售价是同一套餐不同发布分支还是不同 offer，首版采用不同 offer/plan_key，不能在同一版本混合币种。
- 首版一次报价按同一个地区/客户分组/币种计算；不隐式替用户选择其他地区价格。

## 4. 属性与标签

| 表 / 公共字段 | 完整业务字段 | 语义 |
|---|---|---|
| attributes / E | `code T`；`name_en T`；`name_zh T?`；`data_type T`；`unit_id U?→units`；`cardinality T=single`；`description T?`；`is_filterable B=true`；`active B=true` | type=boolean/number/text/enum；cardinality=single/multi；结构变更须版本迁移，不原地把 number 改为 text |
| attribute_scopes / R | `attribute_id U→attributes`；`category_id U→categories`；`target_kind T` | target_kind=product/model/request；用类别限定属性。request 用于规则条件和场景输入 |
| attribute_values / E | `attribute_id U→attributes`；`value_key T`；`value_text T?`；`value_number N?`；`value_boolean B?`；`label_en T?`；`label_zh T?`；`active B=true` | 每行必须且只能填一种值列，且类型匹配。enum 的 value_text 保存稳定枚举键 |
| product_attributes / E | `product_id U→products`；`attribute_id U→attributes`；`attribute_value_id U→attribute_values`；`source_id U?→data_sources`；`verification_state T=pending`；`observed_at TS?` | 值必须属于该属性，产品类别必须允许该属性；单值属性不允许多个当前事实 |
| model_attributes / E | `model_id U→models`；`model_version_id U?→model_versions`；`attribute_id U→attributes`；`attribute_value_id U→attribute_values`；`source_id U?→data_sources`；`verification_state T=pending`；`observed_at TS?` | 版本级覆盖家族级；版本必须属于 model_id；不自动把一个版本能力推广到全部版本 |
| tags / E | `slug T`；`name_en T`；`name_zh T?`；`description T?`；`active B=true` | 统一标签字典，不包含收费金额或佣金 |
| product_tags / R | `product_id U→products`；`tag_id U→tags` | 复合主键避免重复 |
| model_tags / R | `model_id U→models`；`tag_id U→tags` | 标签不作为已证实能力替代属性 |

属性数据和配置值共用 typed value 字典：布尔真假、数值上限、质量枚举等都有明确类型；不生成一张全是无约束字符串的 EAV 表。用户临时输入在请求中校验，不为每次搜索插入字典值。

## 5. 用户需求入口与匹配

| 表 / 公共字段 | 完整业务字段 | 语义 |
|---|---|---|
| ranking_profiles / E | `code T`；`version_no I`；`name T`；`strategy T`；`missing_policy T=last`；`publication_state T=draft` | strategy=lexicographic/weighted；发布后不可修改版本 |
| ranking_terms / R | `ranking_profile_id U→ranking_profiles`；`ordinal I`；`metric_code T`；`attribute_id U?→attributes`；`direction T`；`weight N?`；`normalization T=none` | PK profile+ordinal；metric 白名单：purchase_cost/consumed_cost/effective_unit_cost/verified_at/preference_match/attribute；没有 affiliate 字段 |
| usage_scenarios / E | `code T`；`version_no I`；`name T`；`category_id U→categories`；`horizon_start TS?`；`horizon_end TS?`；`period_kind T`；`description T?`；`publication_state T=draft` | period_kind=month/custom；具体日额度计算必须有起止时间或明示不能精算 |
| scenario_inputs / E | `scenario_id U→usage_scenarios`；`input_key T`；`unit_id U?→units`；`quantity N?`；`attribute_id U?→attributes`；`attribute_value_id U?→attribute_values` | 数量输入(unit+quantity)与参数输入(attribute+value)二选一；LLM input/output/cache 分别一行 |
| discovery_experiences / E | `code T`；`version_no I`；`title_en T`；`title_zh T?`；`target_kind T`；`category_id U?→categories`；`scenario_id U?→usage_scenarios`；`ranking_profile_id U→ranking_profiles`；`publication_state T=draft` | target_kind=product/model/offer；入口不是数据库分类 |
| discovery_criteria / E | `experience_id U→discovery_experiences`；`criterion_key T`；`label_en T`；`label_zh T?`；`mode T`；`data_scope T`；`attribute_id U?→attributes`；`field_code T?`；`input_type T`；`required_input B=false`；`ordinal I` | mode=hard/preference；scope=product/model/channel/plan/cost；attribute 与 field_code 二选一；field_code 为应用注册的安全字段，不是 SQL |
| matching_rules / E | `criterion_id U→discovery_criteria`；`group_no I=1`；`operator T`；`operand_source T`；`literal_value_id U?→attribute_values`；`upper_value_id U?→attribute_values`；`weight N?`；`unknown_policy T=reject` | operand_source=user_input/literal；user_input 不带 literal；hard 默认 reject；preference 使用 no_score，不凭未知属性奖励 |

逻辑规则：同组 AND，组间 OR；入口全部 hard criterion 必须满足，preference 仅影响排序。operator 仅 eq/ne/lt/lte/gt/gte/between/exists，输入值类型与 criterion 对应类型一致。引用模型属性时明确是被选版本还是家族默认，禁止取任意版本最大值。

## 6. 推荐与管理

| 表 / 公共字段 | 完整业务字段 | 语义 |
|---|---|---|
| alternatives / E | `original_product_id U→products`；`alternative_product_id U→products`；`scenario_id U?→usage_scenarios`；`similarity_type T`；`reason T`；`functional_difference T`；`price_advantage_note T?`；`verification_state T=pending`；`verified_at TS?` | 定向关系，价格优势文字不是可直接排序的金额 |
| alternative_sources / R | `alternative_id U→alternatives`；`source_id U→data_sources` | 多来源证据 |
| alternative_features / R | `alternative_id U→alternatives`；`attribute_id U→attributes` | 特征交集依据；不能将数量当成质量评分 |
| data_sync_logs / A | `run_key T`；`source_system T`；`started_at TS`；`finished_at TS?`；`status T`；`source_manifest_sha256 T?`；`read_count bigint`；`mapped_count bigint`；`quarantined_count bigint`；`error_count bigint`；`message T?` | status=running/succeeded/failed；完成后不可重写；run_key 幂等。运行中的状态可受控补完，不作为价格历史 |
| data_review_logs / A | `sync_log_id U?→data_sync_logs`；`entity_kind T`；`entity_key T`；`action T`；`actor_key T`；`reviewed_at TS`；`reason T`；`evidence_source_id U?→data_sources` | action=approve/reject/request_changes/publish/withdraw/map_identity；仅服务端追加；日志 entity_key 不是业务外键 |

## 7. 不另建同义实体的边界

- `price_sources` 复用 `data_sources`，不再维护两份 URL/核验状态。
- `model_versions` 是新增身份层；原 `product_models` 演进为关联，不另复制“产品模型价格表”。
- `plan_versions` 必须新增以保障权益/规则/价格的一致历史；不是每个计费方式建表。
- `usage_scenarios` 与一次用户临时输入不同；不保存每次搜索请求、不存用户身份或支付数据。
- 旧提交、Affiliate、目录版本等不在本次目标结构中重新造一套；原数据完整归档、原接口在切换前继续工作，后续适配需单独确认。
- 导入映射与原始行归档使用版本化迁移清单及 `legacy_archive` 只读 schema，后者逐表保留源结构/原文；不是新的运行时 JSONB 产品库。
