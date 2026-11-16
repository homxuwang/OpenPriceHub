# P1 唯一约束、完整性与索引 · v1.0.0

> 路线更新（2026-11-06）：后续采用 Cloudflare D1。本文为历史 PostgreSQL 草案，不再作为实施依据；请以 [D1 适配方案 v1.1.0](../p1-d1-adaptation-v1.1.0.md) 为准。

日期：2026-11-06。**本文件是设计说明，不是 SQL Migration；约束尚未执行。**

## 1. 约束分层

1. 普通 CHECK：只验证当前行的非负值、四选一 owner、上下界、固定枚举、字段组合。
2. UNIQUE / FK：验证身份唯一、关系存在、同属性值/模型版本归属等。
3. 数据库约束触发器/受控发布事务：验证跨表类型、单值属性、套餐/渠道范围、来源完整性、规则重叠和不可变版本。
4. 应用类型校验：拒绝无穷/NaN、超精度输入、未知操作码、无效 URL 和非法配置；不能替代数据库关键约束。

不能用 CHECK 子查询去伪造跨表完整性；不依赖“当前时间”CHECK 自动把数据变 stale。时效是查询/报价时判断，重新核验追加证据。

## 2. 主键与唯一键

所有 E/A 表主键为 id；R 表见下表。业务键保留可读外部标识，但不以厂商显示名去重。

| 表 | 业务唯一约束 / 关系主键 |
|---|---|
| currencies、pricing_models | code 主键 |
| units | UNIQUE(code)；UNIQUE(id,dimension) 可供复合关系校验 |
| categories | UNIQUE(code)、UNIQUE(slug) |
| providers/products/models/channels | 各自 UNIQUE(slug)，不对 name 唯一；模型开发方未知不得按同名合并 |
| product_categories | PK(product_id,category_id)；is_primary=true 的 product_id 部分唯一索引 |
| model_categories | PK(model_id,category_id)；is_primary=true 的 model_id 部分唯一索引 |
| model_versions | UNIQUE(model_id,version_key)；UNIQUE(id,model_id) 支持复合归属外键 |
| product_models | PK(product_id,model_id,role) |
| offers | UNIQUE(channel_id,offer_key,region_code,customer_segment)；product_id 被绑定在 Offer 身份内，不允许静默换产品 |
| offer_models | UNIQUE(offer_id,model_version_id)；有 external_model_key 时 UNIQUE(offer_id,external_model_key)；UNIQUE(id,offer_id) |
| credit_pools | UNIQUE(channel_id,code) |
| data_sources | UNIQUE(source_key)，同 URL 多次观测允许多行，不用 URL 唯一覆盖旧证据 |
| pricing_plans | UNIQUE(offer_id,plan_key)；UNIQUE(id,offer_id) |
| plan_versions | UNIQUE(plan_id,version_no)；UNIQUE(id,plan_id) |
| plan_version_models | PK(plan_version_id,offer_model_id) |
| plan_pricing_models | PK(plan_version_id,pricing_model_code) |
| plan_version_sources | PK(plan_version_id,source_id,role) |
| pricing_components | UNIQUE(plan_version_id,component_key) |
| plan_entitlements | UNIQUE(plan_version_id,entitlement_key) |
| usage_pricing_rules | UNIQUE(component_id,rule_key)；tier/variant 重叠另见发布约束 |
| credit_consumption_rules | UNIQUE(component_id,rule_key) |
| pricing_constraints | UNIQUE(plan_version_id,constraint_key) |
| rule_conditions | owner+group_no+attribute_id+operator+value_id+upper_value_id 去重，NULL 按相同值处理；按四个 owner 各建部分唯一索引 |
| price_history | UNIQUE(event_sequence)，数据库 sequence 分配；事件幂等使用源批次/legacy_reference 或发布请求幂等键，不能用随机重试新建事件 |
| attributes | UNIQUE(code) |
| attribute_scopes | PK(attribute_id,category_id,target_kind) |
| attribute_values | UNIQUE(attribute_id,value_key)；UNIQUE(id,attribute_id)；按类型分别对 attribute_id+实际值部分唯一 |
| product_attributes | UNIQUE(product_id,attribute_id,attribute_value_id)；single 属性的单值要求由受控事务/触发器校验 |
| model_attributes | UNIQUE NULLS NOT DISTINCT(model_id,model_version_id,attribute_id,attribute_value_id)；single 同作用域只允许一个值 |
| tags | UNIQUE(slug) |
| product_tags/model_tags | PK(product_id,tag_id) / PK(model_id,tag_id) |
| ranking_profiles | UNIQUE(code,version_no) |
| ranking_terms | PK(ranking_profile_id,ordinal) |
| usage_scenarios | UNIQUE(code,version_no) |
| scenario_inputs | UNIQUE(scenario_id,input_key) |
| discovery_experiences | UNIQUE(code,version_no) |
| discovery_criteria | UNIQUE(experience_id,criterion_key)、UNIQUE(experience_id,ordinal) |
| matching_rules | id 主键；(criterion_id,group_no,operator,operand_source,literal_value_id,upper_value_id) NULLS NOT DISTINCT 唯一 |
| alternatives | UNIQUE NULLS NOT DISTINCT(original_product_id,alternative_product_id,scenario_id)；original != alternative |
| alternative_sources/alternative_features | PK(alternative_id,source_id) / PK(alternative_id,attribute_id) |
| data_sync_logs | UNIQUE(run_key) |
| data_review_logs | 追加日志 id 主键；不对 entity_key 唯一，允许多次审查 |

NULLS NOT DISTINCT 按 PostgreSQL 15+ 设计；目标版本确认后生成具体语法。发布请求幂等键在 price_history 增补 `publication_key text NOT NULL UNIQUE`，字段字典以此为必填字段；导入批次生成稳定键，不以时间戳碰运气。

## 3. 数值和单位约束

- monetary amount、unit_price、credits_consumed、quantity、tier_lower、权重不得为负；明确免费值为 0，未知为 NULL。
- unit_quantity、conversion_factor、rounding_increment（启用取整时）必须 >0；tier_upper 非空时必须 >tier_lower。
- 禁止 numeric NaN/Infinity；金额小数精度超过 12 位时先阻止导入并留原文，不能让类型转换悄悄四舍五入价格。扩精度须变更契约后迁移。
- billing_cadence=monthly 时 billing_period_months=1，annual 时为 12；其他 cadence 使用 NULL；commitment_months 非空须 >0。
- 同一 plan_version 的 monetary component/rule 币种一致。新报价不做隐式换汇。
- units 的转换仅同 dimension；自单位 factor=1，所有其他转换必须指向标准单位，不允许环。video_time/audio_time、input_token/output_token/cached_input_token 分开。
- credit_debit 组件金额为空，必须有 credit_consumption_rules；credit_purchase 固定金额与 grant_component_id 对应的积分权益共同定义购买价和到账量。
- 不允许把 credit 数量作为货币金额；池必须属于该版本 Offer 的渠道。
- 不允许固定金额组件同时挂使用量价格，以免基费被当单位费重复乘用量。

## 4. 跨表一致性

| 关系 | 数据库验证 |
|---|---|
| model_attributes.model_version_id 属于 model_id | 复合 FK (model_version_id,model_id) → model_versions(id,model_id) |
| 属性值属于属性 | product_attributes/model_attributes 和各条件表使用复合值归属 FK，或存在明确缺少 attribute_id 的场合由约束触发器查值所属属性 |
| 属性类型正确 | attribute_values 类型专用列恰一非空；触发器核对 attributes.data_type；修改类型有已有值时禁止 |
| 属性类别正确 | product/model 的 categories 与 attribute_scopes 至少有匹配；不能把图片分辨率当 LLM 必填项 |
| 单值/多值 | 修改属性/实体行时锁定相应实体，事务内保证 single 只有一条，避免并发绕过 |
| plan_version_models | 关联 offer_model 的 offer_id 必须等于 version.plan.offer_id |
| 模型规则范围 | rule、entitlement、constraint 的 model_version_id 必须在 plan_version_models 内；NULL 表示产品级/已选范围通用，不代表任意渠道模型 |
| source 引用 | 组件/规则/权益/约束的 source 必须同时出现在该 plan_version_sources 证据集中 |
| price_history 归属 | (plan_version_id,plan_id) 复合 FK；replace/supersedes 只能指向同一套餐 |
| 条件范围 | rule_conditions 的 attribute 必须在对应类别的 request scope，值和 operator 必须兼容 |
| 权益购买关联 | grant_component 与 entitlement 属于同一版本；积分池/单位相符 |
| 配置输入 | criterion 属性/固定字段二选一；field_code 用服务端注册表；匹配值类型与目标相同 |
| 排序指标 | 成本指标只能使用报价返回值；不允许 affiliate、commission、sponsored 等字段 |

## 5. 发布校验与不可变历史

发布 transaction 必须锁定 pricing_plans 行后执行：

1. 检查 currency、cadence、原始单位文字、来源、权益周期、规则语义足够明确；未知不变 0。
2. 所引用来源满足批准的核验/有效期策略；imported_claim 不自动升级 verified。
3. 验证模型/渠道/套餐关联及所有子表外键范围。
4. 对同 variant 的阶梯确保顺序、无重叠、按需连续；尾段无限由 NULL 表示，不能出现两条无限尾段。
5. 检查同优先级、同 charge_group 的条件重叠。复杂特殊规则不能证明互斥时阻止发布；运行时再有歧义则返回 ambiguous，不输出一个看似确定的最低价。
6. 发布后 plan_versions 和其子表（组件、权益、规则、约束、conditions、模式、模型、来源关联）拒绝 UPDATE/DELETE/新增子项。
7. 追加 price_history 事件，publication_key 去重，生成审核记录；全部成功后提交。
8. 撤回追加 withdraw；更正追加新版本/replace。不得 DELETE 旧版本或原证据。

业务外键默认 ON DELETE RESTRICT。产品/套餐下架用 lifecycle 或 history 事件，不 cascade 删除价格历史。维护角色与应用角色分离；应用不能绕过审核直接更新 published 内容。源库备份同样不能当作允许删除原数据的理由。

### 5.1 被历史引用的字典也必须稳定

仅冻结价格子表还不够：已发布版本引用的 units.dimension/conversion_factor、attribute_values 的实际值、attributes.data_type/unit_id、credit_pool 的渠道/单位身份不得原地修改。变化需新增字典值/单位/池并在新版本中引用。标签/翻译可修正文案，但不能改变计量含义。模型版本所属 model 和 Offer 的 product/channel 归属一旦被已发布套餐引用也不可改写。

价格历史重放以固定版本、来源和输入条件为依据。入口配置版本只能重放配置；若要精确重放历史推荐，还需要当时产品/模型事实和请求输入快照，本次不宣称仅凭配置版本已支持完整推荐历史重放。

## 6. 索引设计

PK/UNIQUE 已创建的索引不重复创建。以下以查询方向列出新增 B-tree 或部分索引建议；以 EXPLAIN 结果确认收益。

| 查询 | 索引 |
|---|---|
| 分类产品列表 | product_categories(category_id,product_id)；products(lifecycle,owner_provider_id,id) |
| 分类模型列表 | model_categories(category_id,model_id)；models(developer_provider_id,lifecycle,id) |
| 模型的各渠道 | offer_models(model_version_id,offer_id)；offers(channel_id,lifecycle,id) |
| 渠道可购买套餐 | pricing_plans(offer_id,lifecycle,id)；plan_versions(plan_id,publication_state,version_no DESC) |
| 指定时点价格 | price_history(plan_id,effective_at DESC,event_sequence DESC) INCLUDE(plan_version_id,action,recorded_at) |
| 系统历史回放 | price_history(recorded_at,plan_id)；查询需同时限定 effective_at 与 recorded_at |
| 价格规则选择 | usage_pricing_rules(component_id,model_version_id,variant_key,priority DESC,tier_lower)；credit_consumption_rules(component_id,model_version_id,priority DESC) |
| 条件命中 | 四种 owner 各 (owner_id,group_no,attribute_id) 的非空部分索引 |
| 套餐条件 | pricing_constraints(plan_version_id,kind)；plan_entitlements(plan_version_id,charge_group) |
| 属性值查产品/模型 | product_attributes(attribute_id,attribute_value_id,product_id)；model_attributes(attribute_id,attribute_value_id,model_id,model_version_id) |
| 数值范围 | attribute_values(attribute_id,value_number) WHERE value_number IS NOT NULL |
| 来源时效 | data_sources(verification_state,valid_until)；来源引用的反向 FK 索引按使用量补齐 |
| 标签反向查找 | product_tags(tag_id,product_id)；model_tags(tag_id,model_id) |
| 平替双向查询 | alternatives(original_product_id,verification_state,scenario_id) 与 alternatives(alternative_product_id,verification_state,scenario_id) |
| 入口加载 | discovery_criteria(experience_id,ordinal)；matching_rules(criterion_id,group_no) |
| 审核和批次 | data_review_logs(entity_kind,entity_key,reviewed_at DESC)；data_review_logs(sync_log_id)；data_sync_logs(status,started_at DESC) |

名称模糊搜索可在后续确认 pg_trgm 可用后增加 trigram GIN；不是 P1 核心结构的硬依赖。本次不要求创建扩展。只有实际按 JSONB 扩展字段检索时才加定向表达式/GIN 索引，不给所有 JSONB 列机械建 GIN。

## 7. 配置安全与版本

- discovery、scenario、ranking 一旦发布不得修改已有版本；创建 version_no+1，再显式选择使用版本。
- 发布入口必须引用已发布的 scenario/profile，不能引用草稿规则。
- 单独提高偏好权重不能放宽 hard 条件。
- 未知值处理明确区分缺失、false、0、无限制，不允许 null 自动转换 false/zero。
- weighted 模式的指标单位与归一化必须显式配置；价格比较键不一致时先分组/剔除，不把价格塞入无条件总分。
- rule_conditions/matching_rules 从白名单构建参数化查询，不允许在数据库保存可执行 SQL 字符串。

## 8. 管理与权限前置门槛

当前旧平台/模型写接口缺乏鉴权是已知 P0 缺陷。新 PostgreSQL 写入仅授予服务端受限角色；在旧写入口权限、发布事务和审计验证完成前，不切换生产写流量。本 P1 设计不擅自改造这些接口，也不假装数据库设计能自动修复它们。
