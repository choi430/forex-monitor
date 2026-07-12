# Forex Monitor — 部署指南

## 项目概览

```
Cloudflare Workers (Cron 每分钟)
  → Twelve Data API       USD/KRW 汇率
  → Yahoo Finance 非官方   KOSPI / NASDAQ / S&P 500
  → Cloudflare KV         状态存储
  → 飞书自建应用机器人      双向：推送告警 + 接收指令
  → PWA 面板              https://your-worker.workers.dev/
```

---

## 第一步：准备工具

```bash
# 安装 Node.js（需要 18+）和 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login
```

---

## 第二步：创建 Cloudflare KV 命名空间

```bash
# 生产环境
wrangler kv namespace create FOREX_KV

# 预览环境（本地开发用）
wrangler kv namespace create FOREX_KV --preview
```

命令输出中会包含 `id`，将两个 id 分别填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding    = "FOREX_KV"
id         = "填入生产环境 id"
preview_id = "填入预览环境 id"
```

---

## 第三步：申请 Twelve Data API Key

1. 访问 https://twelvedata.com → 免费注册
2. 进入 Dashboard → API Keys → 复制 Key

---

## 第四步：创建飞书自建应用（约 30–40 分钟）

### 4-1 创建应用

1. 访问 https://open.feishu.cn/app → 「创建企业自建应用」
2. 填写名称（如「汇率监控机器人」）、描述，上传图标

### 4-2 开启机器人能力

「应用功能」→「机器人」→ 开启

### 4-3 配置权限

「权限管理」→ 开通以下权限：
- `im:message`（读取消息）
- `im:message:send_as_bot`（以机器人身份发送消息）
- `im:chat`（获取群信息）

### 4-4 配置事件订阅

「事件订阅」→ 填写请求 URL：

```
https://your-worker-name.your-account.workers.dev/feishu/webhook
```

> ⚠️ 这个 URL 需要先部署 Worker（第五步）才能通过验证。
> 可以先跳过，部署后再回来填。

订阅事件：`im.message.receive_v1`（接收消息）

### 4-5 记录应用凭证

「凭证与基础信息」页面，记录：
- App ID
- App Secret

「事件订阅」页面，记录：
- Verification Token

### 4-6 发布应用

「版本管理与发布」→「创建版本」→「申请线上发布」
（自建应用无需审核，直接发布即可）

### 4-7 获取群 Chat ID

将机器人添加到你的飞书群后，有两种方式获取 Chat ID：

**方式 A（推荐）**：在群设置里复制群链接，链接末尾的字符串即为 Chat ID。

**方式 B**：调用飞书 API `GET /im/v1/chats` 查询机器人所在的群列表。

---

## 第五步：配置 Secrets

在项目目录下依次执行：

```bash
wrangler secret put TWELVE_DATA_KEY
# 粘贴你的 Twelve Data API Key

wrangler secret put FEISHU_APP_ID
# 粘贴飞书 App ID

wrangler secret put FEISHU_APP_SECRET
# 粘贴飞书 App Secret

wrangler secret put FEISHU_CHAT_ID
# 粘贴群 Chat ID

wrangler secret put FEISHU_VERIFY_TOKEN
# 粘贴飞书事件订阅 Verification Token
```

---

## 第六步：部署

```bash
# 安装依赖
npm install

# 部署到 Cloudflare
npm run deploy
```

部署成功后会输出 Worker URL，例如：
```
https://forex-monitor.your-account.workers.dev
```

---

## 第七步：回到飞书填写 Webhook URL

「事件订阅」→ 请求 URL 填写：
```
https://forex-monitor.your-account.workers.dev/feishu/webhook
```

点击「验证」，飞书会发送一个 challenge 请求，Worker 会自动响应通过验证。

---

## 第八步：将 PWA 添加到手机桌面

1. 用 iPhone Safari 打开 `https://forex-monitor.your-account.workers.dev`
2. 点击底部「分享」按钮 → 「添加到主屏幕」
3. 确认添加，图标会出现在桌面

---

## 飞书指令速查

在机器人所在群内发送：

| 指令 | 说明 |
|------|------|
| `/help` | 查看所有指令 |
| `/status` | 查看当前所有参数 |
| `/pause` | 暂停所有通知 |
| `/resume` | 恢复所有通知 |
| `/pause 2` | 单独暂停条件2（异动检测） |
| `/resume 2` | 单独恢复条件2 |
| `/set th_high 1380` | 设置高位阈值 |
| `/set th_low 1300` | 设置低位阈值 |
| `/clear th_high` | 清除高位阈值 |
| `/set n 2.5` | 修改异动检测倍数 |
| `/set cooldown_3 60` | 修改条件3冷却时间（分钟） |
| `/set broadcast 90` | 修改定期播报间隔（分钟） |

---

## 本地开发

```bash
# 本地测试（模拟 Worker 环境）
npm run dev

# 手动触发一次 Cron（测试数据拉取）
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

---

## KV 用量参考（免费层）

| 指标 | 每日用量 | 免费上限 |
|------|---------|---------|
| KV 读取 | ~1,100 次 | 100,000 次 |
| KV 写入 | ~535 次   | 1,000 次   |
| Twelve Data credits | 532 次 | 800 次 |
| Worker 请求（Cron） | 1,440 次 | 100,000 次 |
