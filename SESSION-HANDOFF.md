# BridgeX LinkedIn Sync 插件 · 会话交接文档

> **用途**：供新 Cursor 会话快速恢复上下文，继续开发或排查问题。  
> **最后更新**：2026-05-25（晚间：sent_at 按日、ICP 单选白名单、解析记录、截屏并集、已发消息校验）  
> **项目路径**：`LinkedIn-Extension/`  
> **文档入口**：[`README.md`](./README.md) · [`DISTRIBUTION.md`](./DISTRIBUTION.md)  
> **关联文档**：`LinkedIn-MVP-执行手册.md` §1.6（飞书三张表字段）、`personas/BRGX001-Jason-Park.md`（示例人设）、[`archive/Plan-initial.md`](./archive/Plan-initial.md)（初版计划归档）

---

## 更新记录（2026-05-25）

### 当日早些时候

| 类别 | 内容 |
|------|------|
| 表 C 字段 | `career_background`、`edu_background` AI 履历解析写入（工作经历 / 教育背景分列） |
| 表 C 字段 | `target_region` 首屏提取；`message_sent` 发出消息全文 |
| Popup | 五个动作按钮（含 **连接已接受**）；发出消息区（粘贴 + 右键，**无**聊天 DOM 自动抓取） |
| 表 B | 方案 A 插件 +1；方案 B 增量（Connected）；方案 B **全量脚本** `rollup-table-b.mjs` |
| 工程 | `lib/profile-extract-page.js` DOM 多路 fallback；`git init` + `DISTRIBUTION.md`；`Plan.md` 归档 |
| 排障 | `reply_at` 误填已确认为飞书自动化，非插件 |
| 字段解析 | `career_background`/`edu_background` ← 履历整页截屏；`pain_angle`/`offer_angle` ← **发出消息**（飞书单选，见 §六.五） |
| 代码 | `lib/resume-fields.js`、`lib/angle-fields.js` 规范化与兜底 |

### 当日晚间（当前代码状态）

| 类别 | 内容 |
|------|------|
| AI 模型 | 默认 **`qwen/qwen3-vl-32b-instruct`**（`lib/llm.js`）；**未经用户确认不得改模型**（曾误换 GLM 已回滚） |
| `sent_at` | 仅精确到**日**（北京时间）；见 §5.8、`formatSentAtForBitable()` |
| ICP / 角色 | `lib/segment-fields.js` 单选白名单（17 个 ICP + 6 个 Role）；写入前 `coerce*`，与飞书表头须一致 |
| 飞书写入 | `personalized_excerpt` 不再塞整段履历；单选字段非法值不写；`TextFieldConvFail` 友好提示（§十一） |
| 截屏并集 | 多次点 **📸 履历整页截屏** / AI 解析：`career_background`、`edu_background` **追加合并**，不覆盖（§5.3） |
| 已发消息 | 点 **已发消息** 且消息框为空 → **拦截同步**，提示先粘贴（§5.4） |
| 解析记录 | `lib/activity-log.js` 本机最近 50 条；Popup 链接 / 设置页查看（§5.9） |
| Prompt | 履历 Prompt 保持「按时间列出经历、尽量写满」风格（勿再强加「纯 OCR 逐字」类指令） |

---

## 一、项目定位（一句话）

Chrome Extension Manifest V3 插件：**半自动**记录 LinkedIn reach out 行为，将目标人信息与动作同步到飞书多维表格 **表 C（Reach out CRM）**，并**更新表 B（每日操作日志）计数**；可选 Node 脚本按表 C **全量回写**表 B 纠偏。配合 MVP 手动触达验证，**不以绕过 LinkedIn 风控为目标**。

---

## 二、核心设计原则（务必遵守）

| 原则 | 说明 |
|------|------|
| **半自动化** | 真人浏览、真人发连接/消息；插件只做旁路记录 |
| **零/低注入优先** | 首屏 DOM 仅在用户打开 popup 时一次性读取；**履历整页截屏**为用户点击后才滚动 |
| **模型变更须确认** | 默认 Qwen3-VL-32B；换模型前与用户确认，勿擅自替换 |
| **物理隔离采集** | 截图（剪贴板 / `captureVisibleTab`）、右键划选 → 对 LinkedIn 风控几乎不可见 |
| **飞书直连** | 企业自建应用 `tenant_access_token` 写 Bitable，**不用** OpenClaw / 飞书 CLI |
| **双层身份** | **操作者（真人）** 与 **LinkedIn 账户（虚拟人设）** 分开记录，不可混填 |

### 已明确拒绝的方案

- ❌ 贴 LinkedIn URL 让后台/插件静默 fetch 页面 HTML（高封号风险）
- ❌ 插件在 LinkedIn 登录时自动弹出面板（破坏零注入）
- ❌ 后台静默自动全页滚动 + DOM 批量抓取（像爬虫；**履历整页截屏**是用户点击后才滚动）
- ❌ 用 OpenClaw / 飞书 CLI 替代自建应用写表
- ❌ 读取 LinkedIn 左侧已登录账号名当作「操作者」
- ❌ **从 LinkedIn 聊天浮层自动抓取消息**（DOM 不稳定、与主页隔离）；改为 **粘贴 / 右键划选**

---

## 三、飞书 Base 与表 ID（当前环境）

**Base App Token**：`JaCgbEeGRagC7KsYJtNc2XLPnMN`  
**Base 链接**：https://dcnzdjjl3pwl.feishu.cn/base/JaCgbEeGRagC7KsYJtNc2XLPnMN

| 表 | Table ID | 用途 | 链接示例 |
|----|----------|------|----------|
| **表 C** Reach out CRM | `tbl7pWyLK5f15UyO` | 一行 = 一条 reach out（插件主写入目标） | [表 C](https://dcnzdjjl3pwl.feishu.cn/base/JaCgbEeGRagC7KsYJtNc2XLPnMN?table=tbl7pWyLK5f15UyO) |
| **表 B** 每日操作日志 | `tblvmhRYACuRixCB` | 一行 = 一个 LinkedIn 账户一天 | [表 B](https://dcnzdjjl3pwl.feishu.cn/base/JaCgbEeGRagC7KsYJtNc2XLPnMN?table=tblvmhRYACuRixCB) |

> 早期曾误把表 B 的链接当作表 C；现已纠正。内置默认值见 `lib/secrets.js`。

### 表 B 与表 C 的关系

| 机制 | 说明 |
|------|------|
| **表 C** | 明细层；每次触达一条记录（或「连接已接受」时更新已有行） |
| **表 B** | 日汇总；键 = `account_id` + 当天 `date` |
| **方案 A** | 插件同步后对该日计数器 **+1**（`connect_sent` / `messages_sent` / `replies_received` / `connect_accepted`） |
| **方案 B 增量** | 按钮「连接已接受」：表 C → `Connected`，表 B `connect_accepted + 1`（已是 Connected 不重复 +1） |
| **方案 B 全量** | `npm run rollup:table-b`：扫表 C，按 `status` + `sent_at` 聚合，**覆盖**表 B 当日计数（纠偏） |
| **仍须人工** | `duration_min`、`abnormal_signals` 等收工字段 |

### 表 C 需在飞书预置的列（插件相关）

除 MVP 手册 §1.6 外，请确认已存在：

- `target_region`（文本）— 地区  
- `message_sent`（长文本）— 发出消息全文  
- `career_background`（长文本）— 工作经历摘要（AI 从履历素材解析）  
- `edu_background`（长文本）— 教育背景摘要（AI 从履历素材解析）  
- `operator_name`（文本）— 操作者真人  
- `status` 单选含：**Sent**、**Messaged**、**Replied**、**Connected**

---

## 四、操作身份（两层，重要）

| 设置页字段 | 含义 | 写入飞书 | 示例 |
|------------|------|----------|------|
| **操作者（真人同事）** | 谁在电脑前操作 | 表 C → `operator_name` | 李靖、朱婧雯 |
| **LinkedIn 账户** | 当前 AdsPower 用的是哪个人设 | 表 C → `account_id`；**表 B 按此汇总** | `BRGX001`、`MVP-01` |

典型场景：

- 李靖用 Jason Park 账户发 connect → 操作者=李靖，账户=BRGX001  
- 李靖用自己的账户操作 → 操作者=李靖，账户=对应 account_id  

人设档案示例：`personas/BRGX001-Jason-Park.md`。

---

## 五、当前已实现功能

### 5.1 基础同步与 Popup 字段

- 打开 popup 时自动读取：**姓名**（Title 正则）、**职位 / 公司 / 地区**（`lib/profile-extract-page.js` 注入提取）、**LinkedIn URL**
- **五个**动作按钮：`已发申请` | `已发消息` | `已回复` | `连接已接受` | `其他`
- 同步：表 C 写入 → 表 B 当日 +1（表 B 失败时表 C 仍成功，popup 会提示）
- **草稿**：按 URL 存 `chrome.storage.local`（含地区、消息、AI 字段）；同步成功后清除

### 5.2 表 C `status` 与表 B 计数（插件按钮）

| 插件按钮 | 表 C `status` | 表 B（方案 A） |
|----------|---------------|----------------|
| 已发申请 | `Sent`（新建行） | `connect_sent + 1` |
| 已发消息 | `Messaged`（新建行） | `messages_sent + 1` |
| 已回复 | `Replied`（新建行） | `replies_received + 1` |
| 连接已接受 | `Connected`（**更新**同 URL 最近一行；无则新建） | `connect_accepted + 1`（已 Connected 不重复） |
| 其他 | `Sent`（新建行） | 同已发申请 |

### 5.3 履历采集

| 方式 | 说明 |
|------|------|
| 右键划选 | 「BridgeX 同步此信息作为履历备注」→ `temp_memo` |
| **📸 履历整页截屏** | 滚动整页（≤18 段），定位 Experience / Education，展开 Show all，AI 填 `career_background` / `edu_background` |
| ✨ AI 智能解析 | 文本 / 粘贴图片 → 公司、职位、地区、**career_background**、**edu_background**、实验字段等 |

AI：**OpenRouter** `qwen/qwen3-vl-32b-instruct`（`lib/llm.js`）。多图 `max_tokens` = 3200。

**多次截屏 / 解析 → 并集（不覆盖）**

- 同一人、同一次 popup 会话内，再次点截屏或 AI 解析时：
  - `career_background`、`edu_background`：新内容与已有内容**去重后追加**（一方包含另一方则保留较长者）。
  - `icp_segment`、`role_segment` 等：仅在新结果非空且旧为空时填补；已有 ICP/角色不强行覆盖。
- 适用场景：主页过长，分两次滚动截屏，合并进素材框与 AI 预览后再同步。
- 实现：`popup.js` → `parseAndFill()` 内 `combineText()`。

### 5.4 发出的消息

| 方式 | 说明 |
|------|------|
| **粘贴** | popup「发出的消息」文本框（推荐） |
| **右键划选** | 「BridgeX 保存为发出的消息」→ 打开 popup 自动填入 |
| ✨ **AI 分类** | 写入/预览 `message_template_id`、`pain_angle`、`offer_angle`、`cta_type` 等 |
| **同步时** | 已填消息但未分类 → 同步前自动 AI 分类；全文写入 `message_sent` |
| **已发消息校验** | 点按钮 **已发消息** 时，若消息框为空 → **不调用飞书**，提示：「同步「已发消息」前，请先在上方粘贴发出的消息原文」 |

> 不提供「抓取聊天」按钮（LinkedIn 聊天浮层 DOM 不可靠）。

### 5.5 方案 B 全量聚合（Node 脚本）

从表 C 按 `account_id` + `sent_at`（本地日）聚合，**覆盖**表 B 计数：

| 表 C `status` | 计入表 B（该日） |
|---------------|------------------|
| `Sent` | `connect_sent` |
| `Connected` | `connect_sent` + `connect_accepted` |
| `Messaged` | `messages_sent` |
| `Replied` / `Positive` / `Meeting` | `replies_received` |

```bash
cd LinkedIn-Extension
npm run rollup:table-b:dry    # 预览
npm run rollup:table-b        # 最近 7 天
npm run rollup:table-b:today  # 仅今天
```

定时任务、计划任务示例 → **`DISTRIBUTION.md` §六**。

### 5.6 配置页（同事必填）

- **操作者** + **LinkedIn 账户**
- Bitable App Token、表 C / 表 B Table ID（默认可覆盖）
- 字段名映射（默认见 §六；**时间字段 = `sent_at`**，勿填 `reply_at`）
- **`sent_at` 写入格式**（见 §5.8）
- 可选映射：`target_region`、`message_sent`、`career_background`、`edu_background` 等

### 5.8 `sent_at` 写入（仅精确到日）

| 设置项 | 写入值 | 飞书列类型建议 |
|--------|--------|----------------|
| **日期时间戳**（默认 `date_ms`） | 北京时间当天 **0:00** 的毫秒数 | 「日期」或「日期时间」 |
| **日期文本**（`date_text`） | `2026-05-25` 样式字符串 | 「文本」 |

- 不再写入「当前时刻」带时分秒的 ISO / 毫秒戳（避免表里出现 `T08:02:20.530Z` 等 UTC 文本）。
- 实现：`lib/feishu.js` → `formatSentAtForBitable()`、`getBeijingDayStartMs()`。
- 兼容旧配置：`datetime_ms` → 按 `date_ms`；`text_iso` → 按 `date_text`。

### 5.9 解析 / 同步记录（本机日志）

| 项 | 说明 |
|----|------|
| 存储 | `chrome.storage.local` → 键 `bridgex_activity_log`，最多 **50** 条 |
| 记录时机 | 履历截屏/文本解析、消息 AI 分类、同步飞书（成功/警告/失败） |
| 每条含 | 时间、类型、模型、URL、姓名、动作、截图张数、**履历/教育/消息字数**、ICP/角色、备注/错误 |
| 查看 | Popup 底部 **「查看解析/同步记录」**；或 **设置页** 底部列表（刷新/清空） |
| 代码 | `lib/activity-log.js`；`popup.js` / `options.js` 写入与展示 |

**用途**：区分「AI 没抽出（日志里履历 0 字）」与「飞书写入失败（日志里带 Feishu 错误）」。同步成功会删草稿，但**日志仍保留**。

### 5.7 内置凭证（`lib/secrets.js`，gitignore）

| 变量 | 说明 |
|------|------|
| `OPENROUTER_API_KEY` | AI |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书应用 |
| `FEISHU_BITABLE_APP_TOKEN` | Base token |
| `FEISHU_TABLE_ID` | 表 C |
| `FEISHU_TABLE_B_ID` | 表 B |

模板：`lib/secrets.example.js`。

---

## 六、飞书表 C 字段映射（插件默认）

| 插件逻辑 | 飞书字段 | 写入 |
|----------|----------|------|
| 姓名 | `target_name` | ✅ |
| 职位 | `target_title` | ✅ |
| 公司 | `target_company` | ✅ |
| 地区 | `target_region` | ✅ |
| 链接 | `target_linkedin_url` | ✅ |
| 动作 | `status` | ✅ |
| 操作时间 | `sent_at` | ✅（按日；见 §5.8） |
| LinkedIn 账户 | `account_id` | ✅ |
| 操作者 | `operator_name` | ✅ |
| 发出消息 | `message_sent` | ✅ |
| 工作经历 | `career_background` | ✅（AI 履历解析，需表 C 已有列） |
| 教育背景 | `edu_background` | ✅（AI 履历解析，需表 C 已有列） |
| Pain / Offer | `pain_angle`、`offer_angle` | ✅ 从**发出消息** AI 分类 + 关键词兜底（飞书**单选**，值须与表头选项一致，见 `lib/angle-fields.js`） |
| ICP / 角色 | `icp_segment`、`role_segment` | ✅ 单选白名单（`lib/segment-fields.js`） |
| CTA / 模板 | `cta_type`、`message_template_id` | ✅ 单选白名单（同上） |
| 履历/摘录 | `personalized_excerpt` | ✅ 仅 AI 短句（≤1500 字），**不**写入整段素材框 |
| 回复时间 / 摘录 | `reply_at`、`reply_excerpt` | ❌ 插件不写 |

### `reply_at` 说明（已结案）

- 插件**从不**写入 `reply_at`。
- 若曾自动出现日期：飞书表 C **自动化「新行填当天」**已关闭；与插件无关。

---

## 六.五、字段解析与写入规则（新会话必读）

> **常见误解**：只点「履历整页截屏」并同步，Background 会有值，但 **Pain Angle / Offer Angle 仍可能为空**——因为后两者主要来自 **发出的消息**，不是履历截图。

### 两条数据管道

```
┌─────────────────────────────────────────────────────────────────┐
│ 管道 A · 履历（个人主页）                                          │
│  📸 履历整页截屏 / 划选 / 粘贴 → lib/llm.js RESUME_SYS_PROMPT      │
│  → lib/resume-fields.js 规范化 + 素材框【工作经历】【教育背景】兜底   │
│  → 写入：career_background, edu_background, target_*, icp/role…  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 管道 B · 发出消息（私信/连接附言全文）                              │
│  粘贴 / 右键「保存为发出的消息」→ ✨ AI 分类 或 同步前自动分类        │
│  → lib/llm.js MESSAGE_SYS_PROMPT + lib/angle-fields.js 白名单/兜底 │
│  → 写入：message_sent, pain_angle, offer_angle, cta_type…         │
└─────────────────────────────────────────────────────────────────┘
```

### 表 C 字段 → 数据来源对照

| 飞书字段 | 类型 | 主要来源 | 插件按钮/动作 |
|----------|------|----------|---------------|
| `target_name` / `title` / `company` / `target_region` | 文本 | 打开 popup 首屏 DOM（`profile-extract-page.js`） | 任意同步 |
| `career_background` | **长文本** | 管道 A：履历整页截屏 + AI | 截屏后同步 |
| `edu_background` | **长文本** | 管道 A：同上 | 截屏后同步 |
| `message_sent` | **长文本** | 管道 B：用户粘贴的消息全文 | **已发消息** 等 |
| `pain_angle` | **单选** | 管道 B：消息 AI + 关键词兜底 | 填了消息再同步 |
| `offer_angle` | **单选** | 管道 B：同上 | 填了消息再同步 |
| `cta_type` | 单选/文本 | 管道 B 或履历 AI | 视话术 |
| `icp_segment` | **单选** | A 或 B；须在 `ICP_SEGMENT_OPTIONS` 内 | 见 §六.六 |
| `role_segment` | **单选** | A 或 B；须在 `ROLE_SEGMENT_OPTIONS` 内 | 见 §六.六 |
| `personalized_excerpt` | 文本 | A 或 B | — |
| `status` / `sent_at` / `account_id` / `operator_name` | — | 插件按钮 + 配置 | 五个动作按钮 |

### 履历整页截屏（管道 A）细节

| 项 | 说明 |
|----|------|
| 按钮 | Popup **「📸 履历整页截屏」**（非首屏单张） |
| 流程 | 注入 `linkedin-capture-plan.js` → 定位 **Experience / Education** → 尝试 **Show all** → 滚动 ≤18 段 → 选 ≤8 张送 AI → 恢复滚动位置 |
| AI | `parseResumeContent()`，`max_tokens` 多图时 **3200** |
| 多次截屏 | 同会话内 **并集合并** career/edu，不覆盖（§5.3） |
| 兜底 | 素材框若含 `【工作经历】` / `【教育背景】`，同步前 `enrichAiFieldsFromMemo()` 仍会写入对应列 |
| 预览 | Popup「AI 补充字段」应出现 **工作经历 / 教育背景**；若无，看素材框是否有内容 |
| 关键文件 | `popup.js`（`runResumeCaptureAndParse`）、`lib/resume-fields.js`、`lib/linkedin-capture-plan.js` |

### Pain Angle / Offer Angle（管道 B）细节

| 项 | 说明 |
|----|------|
| **为何为空** | ① 未填「发出的消息」就同步；② AI 返回空；③ 返回值**不在飞书单选选项里**（API 会静默不写） |
| **飞书列类型** | 表 C 中 `pain_angle`、`offer_angle` 为**单选**，选项须与插件白名单一致 |
| **白名单** | `lib/angle-fields.js` → `PAIN_ANGLE_OPTIONS` / `OFFER_ANGLE_OPTIONS` |
| **同步逻辑** | `ensureAnglesBeforeSync()`：有 `message_sent` 且 Pain/Offer 空 → 自动再跑消息 AI；再 `enrichAiFieldsWithAngles()` 关键词兜底 |
| **MVP 参考选项** | 见下表（与验证方案一致；**若飞书表改了选项，必须同步改 `angle-fields.js`**） |

**当前 `PAIN_ANGLE_OPTIONS`（节选）**

- 获客效率、成本下降、渠道扩展  
- supplier evaluation、traceability、quality compliance、operations efficiency、market access  

**当前 `OFFER_ANGLE_OPTIONS`（节选）**

- 帮你找客户、帮你验证市场、帮你拓展渠道  
- traceability & sourcing、investment / partnership、strategic collaboration、product validation、channel partnership  

**关键词兜底示例**（`inferAnglesFromMessageText`）

| 消息含… | 可能 Pain | 可能 Offer |
|---------|-----------|------------|
| supplier / sourcing / procurement | supplier evaluation | traceability & sourcing |
| investor / biotech / pharma | market access | investment / partnership |
| cost / efficiency | 获客效率 | 帮你找客户 |

**已观测现象（2026-05-25）**

- Gülce 行：`message_sent` + `pain_angle` + `offer_angle` 均有 → 消息分类成功  
- Isao 行：`edu_background` + `message_sent` + `cta_type` 有，**Pain/Offer 空** → 当时未跑消息分类或选项不匹配；修复后需**重载扩展 + 带消息再同步**

### 六.六、ICP / 角色 / CTA 单选白名单（`lib/segment-fields.js`）

飞书表 C 中 `icp_segment`、`role_segment`、`cta_type`、`message_template_id` 建议为**单选**。插件写入前会 `coerce*`，**不在列表中的值不会写入 API**（避免 `SingleSelectFieldConvFail`）。

**`ICP_SEGMENT_OPTIONS`（17 + Other）**

Biopharma (General)、Vaccine Manufacturing、mRNA Therapeutics、Monoclonal Antibodies (mAb)、Cell & Gene Therapy (CGT)、Recombinant Proteins、Biosimilars、CDMO、CRO、API、Filtration / Membrane Technology、Medical Devices、Diagnostics / IVD、Life Science Research Tools、Food & Beverage、Cosmetics & Personal Care、Other

**`ROLE_SEGMENT_OPTIONS`**

Procurement、Supply Chain、Operations、Finance、Founder、Other

**`CTA_TYPE_OPTIONS`**：Connect、Reply、Meeting、Other  

**`MESSAGE_TEMPLATE_ID_OPTIONS`**：A、B、C

> 若飞书表头选项与上表不一致，须**同时**改飞书列选项与 `segment-fields.js` / `llm.js` Prompt 中的列表。

### 推荐完整流程（发私信并填满实验字段）

1. LinkedIn **个人主页** → **📸 履历整页截屏**（过长可截两次，自动并集）→ 确认预览有工作经历/教育背景  
2. 复制**已发送的私信全文** → 粘贴到「发出的消息」  
3. 点 **✨ AI 分类** → 预览应含 **Pain / Offer / CTA**  
4. 点 **已发消息** 同步（**无消息正文会拦截**）  
5. 飞书表 C 核对；异常时打开 **解析/同步记录** 看履历字数与错误信息

### 字段为空 · 排障决策树

```
career_background / edu_background 空？
  → 是否点了「履历整页截屏」且预览/素材框有内容？
  → 设置页字段映射是否为 career_background / edu_background？
  → 飞书列是否为长文本？

pain_angle / offer_angle 空？
  → 是否填写了「发出的消息」？
  → 同步前预览是否有 Pain / Offer？
  → 飞书单选选项是否与 lib/angle-fields.js 完全一致？
  → 改飞书选项或改 angle-fields.js 后重载扩展再试
```

---

### 两层权限

1. **开放平台 scope**（`base:record:create`、`bitable:app` 等）  
2. **文档级权限** — 该应用能否编辑此 Base  

| 现象 | 处理 |
|------|------|
| HTTP 403 / `91403 Forbidden` | Base → **「…」→「更多」→「添加文档应用」** → **可编辑** / **可管理** |
| 读成功、写失败 | 表 C、表 B 均需授权 |

参考：[飞书：如何为应用开通文档权限](https://open.feishu.cn/document/faq/trouble-shooting/how-to-add-permissions-to-app?lang=zh-CN)

---

## 八、代码结构

```
LinkedIn-Extension/
├── README.md
├── package.json               # npm run rollup:table-b*
├── manifest.json
├── background.js              # 右键 → temp_memo / temp_message
├── popup.html / popup.css / popup.js
├── options.html / options.css / options.js
├── scripts/
│   ├── rollup-table-b.mjs     # 方案 B 全量 CLI
│   └── load-node-config.mjs
├── lib/
│   ├── config.js
│   ├── feishu.js              # 插件：表 C 写入、表 B +1、连接已接受
│   ├── rollup-table-b.js      # 全量聚合逻辑
│   ├── feishu-client.js       # Node 飞书 API
│   ├── table-b-constants.js   # 表 B 字段与 status 聚合规则
│   ├── profile-extract-page.js   # 注入：职位/公司/地区
│   ├── linkedin-capture-plan.js  # 注入：Experience/Education 截屏计划
│   ├── resume-fields.js         # career/edu 规范化、素材框兜底、多图采样
│   ├── angle-fields.js          # pain/offer 单选白名单、消息关键词兜底
│   ├── segment-fields.js        # icp/role/cta/模板 单选白名单
│   ├── activity-log.js          # 本机解析/同步记录（50 条）
│   ├── llm.js                   # 履历 + 消息分类 prompt；DEFAULT_MODEL
│   ├── name-parser.js
│   ├── secrets.js / secrets.example.js
├── icons/
├── DISTRIBUTION.md
├── SESSION-HANDOFF.md         # 本文档
├── Plan.md → 归档说明
└── archive/Plan-initial.md
```

### 关键 API

- Token: `POST .../auth/v3/tenant_access_token/internal`
- 列表记录: `GET .../records`（全量脚本分页）
- 新增: `POST .../records`
- 更新: `PUT .../records/{record_id}`
- 搜索: `POST .../records/search`

---

## 九、安装与使用

详见 **`DISTRIBUTION.md` §一**。摘要：

1. 加载已解压扩展 → 配置 `lib/secrets.js` 与选项页  
2. LinkedIn 个人页打开 popup → 核对字段 → 点动作按钮  
3. 改代码后 **重新加载扩展**

### 典型流程 A：发连接

1. AdsPower 打开目标人主页  
2. 打开插件 → **📸 履历整页截屏**（或划选履历）  
3. 核对姓名、公司、头衔、**地区**  
4. **已发申请** → 表 C + 表 B `connect_sent + 1`

### 典型流程 B：发私信（含 Pain/Offer）

1. 主页 → **📸 履历整页截屏**（可多次，career/edu **并集**）  
2. 复制已发私信 → 粘贴「发出的消息」→ **✨ AI 分类**（填 `pain_angle` / `offer_angle` / `cta_type`）  
3. **已发消息**（消息框为空会**拦截**）→ 表 C 全字段 + 表 B `messages_sent + 1`

### 典型流程 C：对方接受连接

1. 打开**同一人** LinkedIn 主页  
2. **连接已接受** → 表 C 该 URL 最近行 → `Connected`；表 B `connect_accepted + 1`

### 典型流程 D：收工纠偏

```powershell
npm run rollup:table-b:today
```

---

## 十、开发进度清单

| 状态 | 项 |
|------|-----|
| ✅ | MV3 插件骨架、popup、options |
| ✅ | 飞书表 C/B 写入 + 文档级权限 |
| ✅ | OpenRouter + 飞书凭证内置 |
| ✅ | 履历整页截屏（≤18 张，含 Experience/Education）、草稿、双层身份 |
| ✅ | `target_region`、`message_sent`、`career_background`、`edu_background`、发出消息 AI 分类 |
| ✅ | 连接已接受 → Connected + `connect_accepted` |
| ✅ | 方案 B 全量 `rollup-table-b.mjs` |
| ✅ | DOM fallback（`profile-extract-page.js`） |
| ✅ | GitHub 分发说明（`DISTRIBUTION.md`、`安装指南.md`） |
| ✅ | `Plan.md` 归档 |
| ✅ | `pain_angle` / `offer_angle` 消息分类 + 单选白名单（`angle-fields.js`） |
| ✅ | `reply_at` 飞书自动化问题结案 |
| ✅ | `sent_at` 按日写入 + 设置页格式选项 |
| ✅ | `segment-fields.js` ICP/角色/CTA 单选白名单 |
| ✅ | 多次截屏 career/edu **并集** |
| ✅ | 「已发消息」空消息拦截 |
| ✅ | `activity-log.js` 解析/同步记录 |
| ✅ | 飞书 `TextFieldConvFail` 提示与 `personalized_excerpt` 写入修正 |

**暂无待办**（MVP 插件范围）。后续可选：表 C 多阶段状态机、回复摘录写入、解析记录导出等。

---

## 十一、已知问题与排障速查

| 问题 | 处理 |
|------|------|
| Forbidden / 91403 | §七 文档级权限 |
| 表 B 没更新 | 表 B 权限；选项页 `account_id`；或跑 `rollup:table-b:today` |
| 地区为空 | 手填；或改进 `profile-extract-page.js` selector |
| 履历截屏不完整 | 最多 18 张；先让 Experience/Education 进入页面再截；或划选补充 |
| 草稿丢失 | 同 URL 重开 popup；勿在未同步前清缓存 |
| `operator_name` 为空 | 表 C 是否有列；选项页是否填操作者 |
| 表 B 与表 C 计数不一致 | 跑方案 B 全量聚合；检查表 C `status` 是否人工改对 |
| 聊天无法自动抓取 | **设计如此**；请粘贴或右键划选 |
| **Background 有，Pain/Offer 空** | **正常若未填消息**；见 **§六.五**；填消息 → AI 分类 → 再同步；核对飞书单选与 `angle-fields.js` |
| **Background 空** | 重跑履历整页截屏；看预览与素材框；`resume-fields.js` 兜底 |
| **Pain/Offer 有预览但飞书空** | 飞书单选选项与写入值不一致；改表选项或改 `angle-fields.js` |
| **TextFieldConvFail** | `sent_at` 列类型与设置不一致（§5.8）；勿把整段履历映射到 `personalized_excerpt` 短文本列；见 `feishu.js` 错误提示 |
| **ICP/角色有预览但飞书空** | 值不在 `segment-fields.js` 白名单；改飞书选项或改代码列表 |
| **同步后履历变少** | 查 **解析/同步记录**：若解析时履历字数已很少 → 未截屏或 AI 未抽出；若字数多但飞书空 → 字段映射/列类型问题 |
| **多次截屏仍不全** | 并集只合并 popup 内已有 + 本次结果；每次截屏后看预览字数；必要时多截几次再同步 |

---

## 十二、新会话快速 Prompt（复制即用）

```
我在做 BridgeX LinkedIn MVP 的 Chrome 插件，路径 LinkedIn-Extension/。
请先读 README.md、SESSION-HANDOFF.md（尤其 §六.五 字段解析规则）和 LinkedIn-MVP-执行手册.md §1.6。

当前状态摘要（2026-05-25 晚间）：
- 半自动同步表 C（tbl7pWyLK5f15UyO），表 B（tblvmhRYACuRixCB）按 account_id + sent_at（按日）汇总。
- AI：OpenRouter **qwen/qwen3-vl-32b-instruct**（换模型须用户确认）。
- 履历 A：📸 截屏可多次，career/edu **并集**；消息 B：粘贴 + AI 分类；**已发消息** 无正文会拦截。
- 单选白名单：angle-fields.js（pain/offer）、segment-fields.js（icp/role/cta/模板）。
- sent_at：仅日期（date_ms / date_text）；解析记录 activity-log.js（设置页或 Popup 查看）。
- 操作者 operator_name + 账户 account_id 分层；详见 SESSION-HANDOFF §5.8、§5.9、§六.六。

请在此基础上继续：[你的任务]
```

---

## 十三、Git 与仓库

- 已在 `LinkedIn-Extension/` 执行 **`git init`**（2026-05-25）
- `lib/secrets.js` 在 `.gitignore`，**勿提交**
- 提交、打包、定时脚本 → **`DISTRIBUTION.md`**
