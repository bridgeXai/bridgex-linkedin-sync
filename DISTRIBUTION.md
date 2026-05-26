# BridgeX LinkedIn Sync · 分发与运维说明

> 功能与架构详见 [`SESSION-HANDOFF.md`](./SESSION-HANDOFF.md)。  
> **同事安装请直接看 → [`安装指南.md`](./安装指南.md)**（保姆级步骤）。  
> 日常速查 → [`使用说明-快速参考.md`](./使用说明-快速参考.md)。

**代码仓库（公开，唯一分发渠道）**：https://github.com/bridgeXai/bridgex-linkedin-sync

> **分发策略（2026-05-26 起）**  
> - ✅ 同事自行从 GitHub 获取代码（`git clone` 或网页 Download ZIP）  
> - ✅ 管理员**仅私发** `lib/secrets.js`  
> - ❌ **不再**手工打包 zip、飞书发「解压分发包」

---

## 一、给同事安装

**请把 GitHub 仓库链接 + [`安装指南.md`](./安装指南.md) 发给同事**。

文档包含：从 GitHub 获取代码、加载 Chrome、填身份、验证安装、日常流程、常见问题、版本更新。

管理员额外需做：

1. **私发 `lib/secrets.js`** 给每位同事（仓库不含凭证，**不要**打进任何 zip）
2. 确认同事能打开飞书 [表 C](https://dcnzdjjl3pwl.feishu.cn/base/JaCgbEeGRagC7KsYJtNc2XLPnMN?table=tbl7pWyLK5f15UyO) / [表 B](https://dcnzdjjl3pwl.feishu.cn/base/JaCgbEeGRagC7KsYJtNc2XLPnMN?table=tblvmhRYACuRixCB)
3. 首次部署对照下方 **§1.1 飞书表 C 列检查清单**
4. 代码有更新时 `git push`，并在飞书群通知（模板见 §三）

### 1.1 飞书表 C 列检查清单（管理员首次部署）

| 列名 | 类型 | 说明 |
|------|------|------|
| `target_region` | 文本 | 地区（插件新增） |
| `target_contact_email` | 文本 | 联系邮箱（**手动打开弹窗 → 截屏识别**） |
| `target_contact_phone` | 文本 | 联系电话（**手动打开弹窗 → 截屏识别**） |
| `message_sent` | 长文本 | 发出消息全文 |
| `career_background` | 长文本 | 工作经历（**履历整页截屏** AI） |
| `edu_background` | 长文本 | 教育背景（**履历整页截屏** AI） |
| `pain_angle` | **单选** | 痛点（**发出消息** AI；见 `angle-fields.js`） |
| `offer_angle` | **单选** | 价值（同上） |
| `icp_segment` | **单选** | ICP 行业（17+Other；见 `segment-fields.js`，须与表头一致） |
| `role_segment` | **单选** | 角色（Procurement / Operations / …；见 `segment-fields.js`） |
| `sent_at` | **日期** 或 **日期时间** | 插件只写**当天日期**（见 `SESSION-HANDOFF.md` §5.8） |
| `operator_name` | 文本 | 操作者真人 |
| `status` | 单选 | 含 Sent、Messaged、Replied、**Connected** |

关闭表 C 中「新行自动填 `reply_at`」类自动化（若曾启用）。

**单选字段**：Pain/Offer（`angle-fields.js`）、ICP/角色/CTA/模板（`segment-fields.js`）须与飞书表头选项一致，否则同步会静默不写或报错。详见 `SESSION-HANDOFF.md` §六.五、§六.六。

**使用提示**：
- 主页过长可**多次**点「履历整页截屏」，工作经历/教育背景会**合并**而非覆盖。
- 点 **已发消息** 前必须在 popup 粘贴消息全文，否则会拦截、不写飞书。

---

## 二、管理员发版流程

```powershell
cd "D:\BridgeX\Network Framework\LinkedIn-Extension"   # 或你的本地克隆路径

git add .
git status        # 确认 lib/secrets.js 未出现
git commit -m "描述本次变更"
git push origin master
```

可选：打 tag 标记版本（同事可在 GitHub 看 Releases / 对比 tag）：

```powershell
git tag v0.1.2
git push origin v0.1.2
```

发版后在飞书群通知同事（模板见 §三）。**不需要**再手工打 zip 分发。

---

## 三、Git 仓库

**仓库**：https://github.com/bridgeXai/bridgex-linkedin-sync（Public）

新同事安装见 [`安装指南.md`](./安装指南.md) §三。

---

## 四、版本更新（飞书群通知模板）

复制以下内容到飞书群：

---

**BridgeX LinkedIn Sync 已更新**

仓库：https://github.com/bridgeXai/bridgex-linkedin-sync

**会 Git 的同事**

```powershell
cd D:\Tools\bridgex-linkedin-sync
git pull
```

**不会 Git 的同事**

GitHub 打开上面链接 → **Code → Download ZIP** → 备份 `lib\secrets.js` → 解压覆盖 → 拷回 `secrets.js`

**所有人**

1. Chrome → `chrome://extensions/` → BridgeX → **重新加载**
2. 若本次更新新增飞书列，对照 `SESSION-HANDOFF.md` 检查表 C 结构
3. （可选）`npm run rollup:table-b:today` 对齐表 B

变更说明：（在此填写）

---

## 五、飞书单选与插件按钮对应

表 C **`status`** 须包含：

| 值 | 来源 |
|----|------|
| `Sent` | 已发申请 / 其他 |
| `Messaged` | 已发消息 |
| `Replied` | 已回复 |
| `Connected` | 连接已接受 |

---

## 六、方案 B 全量：表 C → 表 B 聚合

### 何时使用

- 在飞书**手工修改**了表 C 的 `status`
- 漏点插件按钮，但表 C 已由其它方式补全
- 收工希望表 B 与表 C **完全一致**

插件日常 **+1**（方案 A）与脚本 **覆盖**（方案 B 全量）可并存；建议**每天收工**跑一次当天聚合。

### 环境

- **Node.js 18+**（内置 `fetch`）
- 当前目录已配置 `lib/secrets.js`

无需 `npm install`（无第三方依赖）。

### 命令

```powershell
Set-Location "D:\BridgeX\Network Framework\LinkedIn-Extension"

npm run rollup:table-b:dry    # 预览，不写飞书
npm run rollup:table-b        # 默认：最近 7 天
npm run rollup:table-b:today  # 仅今天
node scripts/rollup-table-b.mjs --days 30
npm run rollup:table-b:all    # 全表（慎用）
```

### 聚合规则

按 **`account_id` + `sent_at` 本地日历日** 分组，对表 B **覆盖**（非累加）：

| 表 C `status` | 表 B 字段 |
|---------------|-----------|
| `Sent` | `connect_sent` |
| `Connected` | `connect_sent` + `connect_accepted` |
| `Messaged` | `messages_sent` |
| `Replied` / `Positive` / `Meeting` | `replies_received` |

实现：`lib/rollup-table-b.js` + `lib/table-b-constants.js`。

### Windows 计划任务（每天 22:00 聚合当天）

1. **任务计划程序** → 创建基本任务  
2. 触发器：每天 22:00  
3. 操作：启动程序  
   - **程序**：`C:\Program Files\nodejs\node.exe`  
   - **参数**：`scripts/rollup-table-b.mjs --today`  
   - **起始于**：`D:\BridgeX\Network Framework\LinkedIn-Extension`  
4. 保存前手动执行一次 `npm run rollup:table-b:dry` 确认无报错  

### 与插件「连接已接受」的关系

| 场景 | 表 C | 表 B |
|------|------|------|
| 点插件「连接已接受」 | 更新为 Connected | 当日 `connect_accepted + 1` |
| 只在飞书把 status 改为 Connected | 已是 Connected | 跑 rollup 后对齐 |
| 重复点「连接已接受」 | 不变 | 不重复 +1；rollup 按行数重算 |

---

## 七、右键菜单

| 菜单项 | 存储键 | 用途 |
|--------|--------|------|
| BridgeX 同步此信息作为履历备注 | `temp_memo` | 履历素材框 |
| BridgeX 保存为发出的消息 | `temp_message` | 发出的消息框 |

打开 popup 时自动消费并清空；扩展图标 badge `+1` 提示。

---

## 八、相关文件速查

| 文件 | 作用 |
|------|------|
| `安装指南.md` | **同事安装（保姆级）** |
| `使用说明-快速参考.md` | 日常操作速查卡 |
| `SESSION-HANDOFF.md` | 开发交接文档 |
| `README.md` | 文档入口 |
| `lib/secrets.js` | 凭证（不提交 Git，管理员私发） |
| `lib/feishu.js` | 插件写飞书 |
| `scripts/rollup-table-b.mjs` | 全量聚合 CLI |
