# BridgeX LinkedIn Sync · 分发与运维说明

> 功能与架构详见 [`SESSION-HANDOFF.md`](./SESSION-HANDOFF.md)。本文侧重**安装、打包、Git、方案 B 定时任务**。

---

## 一、给同事安装（无需 Git）

1. 向管理员索取 **`LinkedIn-Extension.zip`**（或拷贝整个文件夹）。
2. 解压到本地，例如 `D:\Tools\LinkedIn-Extension\`。
3. 目录内**直接可见** `manifest.json`、`popup.html`、`lib/`（不要多套一层文件夹）。
4. 复制凭证文件：
   ```powershell
   copy lib\secrets.example.js lib\secrets.js
   ```
   编辑 `lib/secrets.js` 填入飞书 App ID/Secret、Bitable Token、OpenRouter Key（或由管理员预填）。
5. Chrome → `chrome://extensions/` → **开发者模式** → **加载已解压的扩展程序** → 选择该文件夹。
6. 右键插件 → **选项**：
   - **操作者**（真人姓名）
   - **LinkedIn 账户**（如 `BRGX001`）
   - 确认字段映射中 **时间字段 = `sent_at`**
   - **`sent_at` 写入格式**：飞书列为「日期/日期时间」→ 选 **日期时间戳**；仍为「文本」→ 选 **日期文本**
7. 代码或 zip 更新后 → 扩展页 **重新加载**。
8. 排查抓取问题：选项页底部 **解析/同步记录**（看每次履历字数、是否报错）。

### 飞书表 C 列检查清单（首次部署）

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

## 二、管理员打包 zip

```powershell
Set-Location "D:\BridgeX\Network Framework\LinkedIn-Extension"

# 确认 lib\secrets.js 已按分发策略处理（勿把生产 Key 打进公开 zip）

Compress-Archive -Path * -DestinationPath ..\LinkedIn-Extension-dist.zip -Force
```

**建议包含**：源码、`icons/`、`lib/secrets.example.js`、`README.md`、`SESSION-HANDOFF.md`、`DISTRIBUTION.md`、`package.json`、`scripts/`。

**勿包含**（`.gitignore`）：`lib/secrets.js`（除非点对点安全发放）。

---

## 三、Git 仓库（团队开发）

```powershell
Set-Location "D:\BridgeX\Network Framework\LinkedIn-Extension"

git init          # 若尚未初始化
git add .
git status        # 确认 lib/secrets.js 未出现
git commit -m "BridgeX LinkedIn Sync extension"
```

新同事：

```powershell
git clone <repo-url>
cd LinkedIn-Extension
copy lib\secrets.example.js lib\secrets.js
# 编辑 lib\secrets.js
```

---

## 四、版本更新通知（模板）

告知同事：

1. 获取新 zip 或 `git pull`
2. `chrome://extensions/` → **重新加载** 插件
3. 若新增飞书列，对照 `SESSION-HANDOFF.md` §六 / §三 更新表结构
4. （可选）Node 脚本：`npm run rollup:table-b:today` 做一次表 B 对齐

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
| `SESSION-HANDOFF.md` | 主交接文档 |
| `README.md` | 文档入口与快速开始 |
| `lib/secrets.js` | 凭证（不提交 Git） |
| `lib/feishu.js` | 插件写飞书 |
| `scripts/rollup-table-b.mjs` | 全量聚合 CLI |
