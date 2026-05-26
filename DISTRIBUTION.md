# BridgeX LinkedIn Sync · 分发与运维说明

> 功能与架构详见 [`SESSION-HANDOFF.md`](./SESSION-HANDOFF.md)。本文侧重**安装、打包、Git、方案 B 定时任务**。

**代码仓库（公开）**：https://github.com/BridgeX-ai/bridgex-linkedin-sync

---

## 一、给同事安装

### 1.1 你需要准备什么

| 项目 | 说明 |
|------|------|
| **Chrome 浏览器** | 桌面版，需能开「开发者模式」 |
| **插件文件夹** | 见下方「方式 A / B」二选一 |
| **`lib/secrets.js`** | 凭证文件，**向管理员索取**（或按模板自行填写） |
| **飞书 Base 权限** | 管理员需把自建应用加到多维表格，授予**可编辑** |
| **AdsPower + LinkedIn** | 日常触达用；插件只在 LinkedIn 个人页旁路记录 |

> **两层身份（必配）**：「操作者」= 真人姓名；「LinkedIn 账户」= 当前人设代号（如 `BRGX001`）。两者不可混填。

---

### 1.2 获取插件代码（二选一）

#### 方式 A：Git 克隆（推荐，方便以后更新）

1. 克隆到本地固定目录，例如：
   ```powershell
   git clone https://github.com/BridgeX-ai/bridgex-linkedin-sync.git D:\Tools\bridgex-linkedin-sync
   cd D:\Tools\bridgex-linkedin-sync
   ```
2. 后续更新只需：
   ```powershell
   cd D:\Tools\bridgex-linkedin-sync
   git pull
   ```
   然后在 `chrome://extensions/` 点插件的 **重新加载**。

#### 方式 B：下载 zip（无需 Git）

1. 向管理员索取 **`LinkedIn-Extension.zip`**，或从 GitHub **Releases** 下载最新包。
2. 解压到本地，例如 `D:\Tools\bridgex-linkedin-sync\`。
3. 解压后目录内**直接可见** `manifest.json`、`popup.html`、`lib/`（不要多套一层文件夹）。
4. 后续更新：重新下载 zip **覆盖**原目录（见 §四），保留 `lib/secrets.js`。

---

### 1.3 配置凭证（首次必做）

```powershell
cd D:\Tools\bridgex-linkedin-sync   # 换成你的实际路径
copy lib\secrets.example.js lib\secrets.js
```

- **推荐**：直接向管理员索取已填好的 `lib/secrets.js`（飞书 App、Bitable Token、OpenRouter Key）。
- **自行填写**：用记事本编辑 `lib/secrets.js`，填入管理员提供的值。
- **注意**：`lib/secrets.js` **不会**随 `git pull` 被覆盖，更新代码时无需重做（除非你主动删了它）。

---

### 1.4 加载 Chrome 插件

1. 打开 Chrome，地址栏输入 `chrome://extensions/`。
2. 右上角打开 **开发者模式**。
3. 点击 **加载已解压的扩展程序**。
4. 选择插件目录（含 `manifest.json` 的那一层）。
5. 加载成功后，建议 **固定** 扩展图标到工具栏。

> 未上架 Chrome 商店的插件不会自动更新；代码更新后必须手动 **重新加载**。

---

### 1.5 插件选项页（首次必做）

右键扩展图标 → **选项**，填写：

| 字段 | 示例 | 说明 |
|------|------|------|
| **操作者** | 李靖 | 写入表 C `operator_name` |
| **LinkedIn 账户** | `BRGX001` | 写入表 C `account_id`，表 B 按此日汇总 |
| **时间字段** | `sent_at` | 勿填 `reply_at` |
| **`sent_at` 写入格式** | 见飞书列类型 | 列为「日期/日期时间」→ **日期时间戳**；仍为「文本」→ **日期文本** |

Bitable App Token、表 C / 表 B ID 通常已有默认值；若管理员给了专用 Base，按说明覆盖即可。

---

### 1.6 验证安装是否成功

1. 用 AdsPower 打开任意 **LinkedIn 个人主页**。
2. 点击插件图标，popup 应自动显示：**姓名、职位、公司、地区、URL**。
3. 点 **已发申请**（或任意动作按钮）试同步一条。
4. 到飞书 **表 C** 确认新行；表 B 当日计数 +1（若表 B 未变，见 [`SESSION-HANDOFF.md` §十一](./SESSION-HANDOFF.md) 或跑 `rollup:table-b:today`）。
5. 异常时：选项页底部 **解析/同步记录** 查看报错。

---

### 1.7 日常使用速查

| 场景 | 操作 |
|------|------|
| 发连接 | 核对字段 → **已发申请** |
| 发私信 | 粘贴消息全文 →（可选）AI 分类 → **已发消息** |
| 对方接受连接 | 打开同一人主页 → **连接已接受** |
| 收履历 | **履历整页截屏**（可多次，自动合并） |
| 收工纠偏表 B | `npm run rollup:table-b:today`（需 Node 18+，可选） |

### 1.8 飞书表 C 列检查清单（管理员首次部署）

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

## 三、Git 仓库（管理员 / 开发）

**仓库**：https://github.com/BridgeX-ai/bridgex-linkedin-sync（Public，任何人可克隆）

### 管理员：推送更新

```powershell
cd "D:\BridgeX\Network Framework\LinkedIn-Extension"   # 或你的本地克隆路径

git add .
git status        # 确认 lib/secrets.js 未出现
git commit -m "描述本次变更"
git push origin master
```

可选：打 tag 并建 Release，方便非 Git 同事下载 zip：

```powershell
git tag v0.1.1
git push origin v0.1.1
# GitHub → Releases → Draft new release → 上传 LinkedIn-Extension-dist.zip
```

### 新同事克隆

见 **§1.2 方式 A**。

---

## 四、版本更新（发给同事的通知模板）

复制以下内容到飞书群：

---

**BridgeX LinkedIn Sync 已更新至 v0.x.x**

**Git 用户**

```powershell
cd D:\Tools\bridgex-linkedin-sync
git pull
```

**zip 用户**

1. 下载最新包（Release 或找管理员要 zip）
2. **先备份** 目录里的 `lib\secrets.js`
3. 解压覆盖原目录，再把 `secrets.js` 拷回去

**所有人**

1. Chrome → `chrome://extensions/` → 找到 **BridgeX LinkedIn Sync** → **重新加载**
2. 若本次更新新增飞书列，对照 `SESSION-HANDOFF.md` 检查表 C 结构
3. （可选）`npm run rollup:table-b:today` 对齐表 B

变更说明：（在此填写）

---

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
