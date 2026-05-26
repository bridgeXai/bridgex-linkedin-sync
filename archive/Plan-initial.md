# LinkedIn 行为同步插件开发计划（初版 · 已归档）

> **归档日期**：2026-05-25  
> **说明**：本文为项目启动时的计划文档，多数条目已实现。  
> **当前文档**：[`../README.md`](../README.md) · [`../SESSION-HANDOFF.md`](../SESSION-HANDOFF.md) · [`../DISTRIBUTION.md`](../DISTRIBUTION.md)

这个方案非常完美地契合了“零封号风险”的要求。因为我们完全不向 LinkedIn 页面注入任何脚本，仅仅是读取浏览器原生的 Tab 信息（Title 和 URL），这对于 LinkedIn 的反爬虫系统来说是**100% 隐形**的。

以下是具体的开发计划：

## 1. 核心架构设计
*   **技术栈**: Chrome Extension Manifest V3 + 原生 HTML/CSS/JS (无需复杂框架，保持极简轻量)。
*   **权限需求**: `activeTab` (仅获取当前点击插件时的标签页信息) 和 `storage` (用于本地存储飞书配置)。
*   **交互流程**: 
    1. 用户点击插件图标，弹出 `popup.html`。
    2. 插件自动获取当前 Tab 的 Title 和 URL。
    3. 插件使用正则表达式清洗 Title，提取出纯净的姓名。
    4. 用户点击“已发申请”等按钮。
    5. 插件调用飞书 API，获取 Token 并写入多维表格。

## 2. 关键模块实现方案

### A. 姓名提取逻辑 (Title 解析)
LinkedIn 的网页标题通常有以下几种格式：
*   `John Doe | LinkedIn`
*   `(99+) John Doe - Software Engineer | LinkedIn` (带未读消息数和职位)

**提取策略**:
1. 移除开头的通知标记，例如 `(3)` 或 `(99+)`。
2. 以 `|` 或 `-` 作为分隔符，取第一部分。
3. 去除首尾空格，即可得到纯净的姓名 `John Doe`。

### B. 飞书 API 直连模块
为了方便内部团队使用且不硬编码敏感信息，我们将开发一个**配置页 (Options Page)**：
*   用户需在配置页填入：`App ID`, `App Secret`, `Bitable App Token`, `Table ID`。
*   **写入流程**:
    1. 请求 `https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal` 获取 `tenant_access_token`。
    2. 组装数据：姓名、主页链接、动作类型（如“已发申请”）、操作时间。
    3. 请求 `https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records` 插入新记录。

### C. 极简弹出面板 (Popup UI)
*   **顶部**: 显示提取到的“姓名”和“LinkedIn 链接”（支持手动修改以防提取错误）。
*   **操作区**: 提供四个大按钮：“已发申请”、“已发消息”、“已回复”、“其他”。
*   **状态反馈**: 点击后显示“同步中...”，成功后显示绿色的“✅ 已同步”，并在 1 秒后自动关闭面板。

## 3. 飞书多维表格准备工作 (需要您配合)
在开始编码前或编码过程中，您需要在飞书端准备好：
1.  **创建一个企业自建应用**，获取 `App ID` 和 `App Secret`，并开通“多维表格”的读写权限。
2.  **创建一个多维表格**，包含以下字段（建议）：
    *   `姓名` (多行文本 / 文本)
    *   `LinkedIn主页` (链接)
    *   `动作类型` (单选标签：已发申请, 已发消息, 已回复, 其他)
    *   `操作时间` (日期时间，或使用系统自动创建时间)
    *   `履历备注` (多行文本，可选)

## 4. 进阶履历收集功能（已实现）
*   **右键快捷收集**: 在页面选中工作经历文本，右键点击“BridgeX 同步此信息作为履历备注”，即可暂存；打开插件时会自动填入。
*   **截图 OCR**: 支持直接在插件文本框里按 `Ctrl+V` 粘贴截图，插件将调用 OpenAI 兼容大模型（可在设置页配置 Base 和 Key）自动识别并提取重点，然后追加到备注框内。

## 5. 开发任务清单 (Todos)
- [x] 初始化 Chrome 插件项目 (manifest.json, icons)
- [x] 开发配置页面 (options.html/js) 用于保存飞书 API 凭证
- [x] 开发弹出面板 UI (popup.html/css)
- [x] 实现 Title 解析与姓名提取逻辑
- [x] 实现飞书 API 鉴权与 Bitable 数据写入逻辑
- [x] 增加 ContextMenu 右键划选功能
- [x] 增加 LLM 截图识别功能及备注框同步

## 6. 本地加载方式
1. Chrome 打开 `chrome://extensions/`，开启「开发者模式」。
2. 点击「加载已解压的扩展程序」，选择本目录 `LinkedIn-Extension`。
3. 右键插件图标 →「选项」，填入飞书信息及大模型 API（如需用截图识别功能）。
4. 在 LinkedIn 个人主页打开插件弹窗，即可同步。
