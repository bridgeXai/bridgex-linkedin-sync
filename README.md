# BridgeX LinkedIn Sync

Chrome 扩展（Manifest V3）：半自动将 LinkedIn reach out 同步到飞书多维表格 **表 C**，并更新 **表 B** 日统计。

## 文档索引

| 文档 | 读者 | 内容 |
|------|------|------|
| [**安装指南.md**](./安装指南.md) | **同事（首选）** | **保姆级**：下载、安装、配置、日常流程、排障 |
| [**使用说明-快速参考.md**](./使用说明-快速参考.md) | 同事 | 日常操作速查卡 |
| [**SESSION-HANDOFF.md**](./SESSION-HANDOFF.md) | 开发 / Cursor | 架构、飞书表 ID、字段规则、排障 |
| [**DISTRIBUTION.md**](./DISTRIBUTION.md) | 管理员 | 打包、发版、方案 B 定时任务 |
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

## 快速开始（同事）

> **完整步骤 → [`安装指南.md`](./安装指南.md)**  
> 日常速查 → [`使用说明-快速参考.md`](./使用说明-快速参考.md)

**唯一代码来源**：https://github.com/BridgeX-ai/bridgex-linkedin-sync（自行 clone 或 Download ZIP，**不收管理员 zip 包**）

1. `git clone https://github.com/BridgeX-ai/bridgex-linkedin-sync.git D:\Tools\bridgex-linkedin-sync`
2. 向管理员私聊索取 **`lib\secrets.js`** 放进 `lib\` 目录
3. Chrome → `chrome://extensions/` → 开发者模式 → 加载已解压
4. 选项页填 **操作者** + **LinkedIn 账户** → 打开 LinkedIn 主页试同步

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
