# BridgeX LinkedIn Sync

Chrome 扩展（Manifest V3）：半自动将 LinkedIn reach out 同步到飞书多维表格 **表 C**，并更新 **表 B** 日统计。

## 文档索引

| 文档 | 读者 | 内容 |
|------|------|------|
| [**SESSION-HANDOFF.md**](./SESSION-HANDOFF.md) | 开发 / **新 Cursor 会话** | **主文档**：架构、飞书表 ID、字段规则、排障、更新记录 |
| [**DISTRIBUTION.md**](./DISTRIBUTION.md) | 管理员 / 同事 | 安装、zip 打包、Git、方案 B 定时任务 |
| [Plan.md](./Plan.md) | — | 已归档，指向上述文档 |
| [archive/Plan-initial.md](./archive/Plan-initial.md) | — | 初版计划全文 |

上级 MVP 手册（仓库根目录）：`LinkedIn-MVP-执行手册.md` §1.6（三张表字段定义）。

## 字段速查（易混）

| 想填的列 | 你要做什么 |
|----------|------------|
| `career_background` / `edu_background` | 个人主页 → **📸 履历整页截屏**（可**多次**截屏，自动**并集**） |
| `pain_angle` / `offer_angle` | 粘贴**发出的消息** → **✨ AI 分类** → 再同步 |
| `message_sent` | 同上；点 **已发消息** 时**必须**先粘贴正文 |
| `sent_at` | 自动写入**当天日期**（北京时间）；列类型见设置页 §5.8 |

详见 [**SESSION-HANDOFF.md §六.五 / §六.六 / §5.8 / §5.9**](./SESSION-HANDOFF.md)。

## 快速开始（同事安装）

> 完整步骤见 [**DISTRIBUTION.md §一**](./DISTRIBUTION.md#一给同事安装)。

**代码仓库**：https://github.com/BridgeX-ai/bridgex-linkedin-sync（公开，可直接克隆）

1. **获取代码**：`git clone` 或向管理员要 zip（见 DISTRIBUTION.md）  
2. **配置凭证**：复制 `lib/secrets.example.js` → `lib/secrets.js`（推荐向管理员索取已填好的文件）  
3. **加载插件**：Chrome → `chrome://extensions/` → 开发者模式 → 加载已解压 → 选本目录  
4. **选项页**：填写「操作者」「LinkedIn 账户」；确认 **`sent_at` 写入格式** 与飞书列类型一致  
5. **试用**：LinkedIn 个人页打开 popup → 点动作按钮 → 检查飞书表 C 是否写入  
6. **更新**：`git pull` 或覆盖 zip 后 → 扩展页 **重新加载**（不会自动更新）

收工可选（Node 18+）：

```powershell
npm run rollup:table-b:today
```

## 当前版本能力摘要（2026-05-25 晚间）

- 首屏提取：姓名、职位、公司、地区、URL  
- 履历：**履历整页截屏** → `career_background` / `edu_background`；**多次截屏并集**  
- 消息：粘贴 + AI 分类 → `message_sent` / `pain_angle` / `offer_angle`；**已发消息** 无正文**拦截同步**  
- 单选字段：ICP（17 项）、角色、Pain/Offer、CTA、模板（白名单见 `segment-fields.js` / `angle-fields.js`）  
- `sent_at`：仅精确到**日**（北京时间）  
- 本机 **解析/同步记录**（最近 50 条）  
- 动作：已发申请 / 已发消息 / 已回复 / **连接已接受** / 其他  
- 表 B：插件 +1；`npm run rollup:table-b` 全量纠偏  
- AI：**`qwen/qwen3-vl-32b-instruct`**（换模型须与负责人确认）
