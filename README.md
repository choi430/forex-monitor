# 汇率监控 (Forex Monitor)

基于 Cloudflare Workers 构建的 USD/KRW 汇率实时监控系统。每分钟通过 Cron
Trigger 抓取汇率与三大股指数据，按四种规则判断是否需要推送通知到飞书群，
并提供一个可安装的 PWA 仪表盘用于实时查看走势和历史数据。

## 功能特性

- **实时抓取**：USD/KRW 汇率（Twelve Data）+ KOSPI / NASDAQ / S&P 500
  三大股指（Yahoo Finance），并根据交易时段动态调整抓取频率。
- **四种推送条件**（可在 admin 面板逐项开关）：
  1. **定期播报** —— 按固定间隔（默认 60 分钟）播报当前行情
  2. **异动检测** —— 基于滚动窗口标准差的统计异常检测
  3. **日内高低点** —— 触及当日新高/新低时推送（带冷却时间，避免刷屏）
  4. **绝对阈值** —— 汇率突破用户设定的高/低位阈值时推送，触发后阈值会
     自动上调 +5 / 下调 -5，避免在同一价位反复触发
- **飞书通知**：告警以飞书互动卡片形式推送到指定群聊（仅推送，参数管理已统一收敛到 `/admin` 面板，不再通过飞书指令双向操作）。
- **PWA 仪表盘**（`/`）：实时汇率、日内区间、四张走势图（USD/KRW + 三大
  股指）。每张图支持双指/滚轮缩放、拖动平移、双击重置，缩放范围限制在
  实际数据区间内（不能缩小到比完整视图还小）；每张图可折叠/展开，折叠
  状态记住在本地，刷新不丢失；可安装到手机主屏幕。
- **历史回看**：每个交易日结束后自动归档，保留 31 天，前端可翻页查看。
- **Admin 参数面板**（`/admin`）：无需重新部署即可在线调整所有可配置参数。

## 架构 / 文件说明

| 文件 | 说明 |
|---|---|
| `index.js` | Worker 入口：路由分发（PWA / API / admin）+ Cron 触发器 |
| `scheduler.js` | Cron 主流程：时段判断、抓取节流、规则求值、通知发送、每日归档 |
| `rules.js` | 四种推送条件的判断逻辑，纯函数，输入状态输出「新状态 + 待发送通知」 |
| `fetcher.js` | 对接 Twelve Data（汇率）和 Yahoo Finance（股指）的数据抓取 |
| `feishu.js` | 飞书 API 封装：获取 tenant_access_token、发送卡片、构建各类告警卡片（仅出站通知，不含指令解析） |
| `config.js` | 全局常量、默认配置、时段划分表、DST/交易时段计算（`getSessionInfo` 等，供后端与 API 响应共用的唯一权威来源）、时间/格式化工具函数 |
| `kv.js` | 对 Cloudflare KV 的读写封装：state / config / 历史归档 / 飞书 token 缓存 |
| `pwa.js` | 前端仪表盘（单文件 HTML，内嵌 CSS/JS，用 Chart.js + chartjs-plugin-zoom 画图） |
| `admin.js` | 参数设置页面（单文件 HTML） |
| `wrangler.toml` | Cloudflare Workers 部署配置（KV 绑定、Cron 表达式等） |

### 数据流

```
Cloudflare Cron（每分钟）
   → scheduler.handleCron()
       → 判断当前时段（HIGH/MID/LOW/INACTIVE）+ 是否到达该时段的抓取间隔
       → fetcher.fetchAllData()          抓汇率 + 三股指
       → rules.evaluateRules()           判断四种推送条件
       → kv.saveState()                  写回 KV
       → feishu.sendCard()               有触发条件则推送
       → （跨交易日边界时）归档前一天数据到 history:<date>
```

PWA 前端通过轮询 `/api/data`（实时）或 `/api/history?date=`（历史）获取
数据后在浏览器端渲染图表。DST/交易时段等计算只在后端 `config.js` 里算
一次（`getSessionInfo`），随 API 响应一起下发，前端不再自行重复计算这
部分逻辑，避免两边实现不同步。

## 交易时段与抓取频率

时间以 CST（UTC+8）计，夏令时期间美股时段会自动平移一小时：

| 时段 | 时间窗口（冬令时） | 默认频率 | 说明 |
|---|---|---|---|
| HIGH | 07:30–09:00 / 13:30–15:30 / 20:00–22:30 | 1 分钟 | KOSPI 开收盘 / 美股开盘窗口 |
| MID  | 07:00–07:30 / 09:00–13:30 / 22:30–00:30 | 3 分钟 | KOSPI 盘中 / 美股盘中 |
| LOW  | 15:30–20:00 / 00:30–07:00 | 15 分钟 | 两个市场之间的空档 / 美股盘后 |
| INACTIVE | 周末（周六开盘后 ～ 周一开盘前） | 不抓取 | 外汇/股市均休市 |

交易日边界为 05:00 CST（夏令时）/ 06:00 CST（冬令时），即当天 00:00–05:00
或 06:00 之间的数据仍归入前一交易日。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 KV 命名空间

```bash
wrangler kv namespace create FOREX_KV
wrangler kv namespace create FOREX_KV --preview
```

把返回的 `id` / `preview_id` 填入 `wrangler.toml` 的 `[[kv_namespaces]]`。

### 3. 配置密钥

```bash
wrangler secret put TWELVE_DATA_KEY      # Twelve Data API Key
wrangler secret put FEISHU_APP_ID        # 飞书自建应用 App ID
wrangler secret put FEISHU_APP_SECRET    # 飞书自建应用 App Secret
wrangler secret put FEISHU_CHAT_ID       # 机器人所在群的 Chat ID
wrangler secret put ADMIN_TOKEN          # /admin 面板访问密码
wrangler secret put TRIGGER_TOKEN        # 外部触发器（cron-job.org）鉴权 Header
```

### 4. 本地调试

```bash
npm run dev
```

### 5. 部署

```bash
npm run deploy
```

## 使用

- **仪表盘**：访问 Worker 根路径 `/`，可直接添加到手机主屏幕作为 PWA 使用。
  - 每张走势图：双指/滚轮缩放，拖动平移，双击/双指双击重置到完整视图；
    缩放状态跨每分钟刷新保持，切换到历史日期或回到实时会自动重置。
  - 每张图右上角的 ⌄ 按钮可折叠/展开，折叠状态记在浏览器本地，下次打开
    仍保持上次的展开/折叠状态。
- **参数设置**：访问 `/admin`，输入 `ADMIN_TOKEN` 后可在线调整所有推送/抓取参数（这是目前唯一的参数管理入口）。

### 双重触发保障

`wrangler.toml` 里配置了 Cloudflare 自带的每分钟 Cron。如果需要更高可靠性，
可以额外用 [cron-job.org](https://cron-job.org) 之类的外部服务定时 POST
`/trigger`（带 `X-Trigger-Token` header）作为备份触发源；两边即使同一分钟
都触发，也会被内部的互斥锁（`cron_lock:<epochMinute>`）挡掉重复执行。

## 可配置参数一览

在 `/admin` 页面可调整：

| 参数 | 说明 | 默认值 |
|---|---|---|
| `n_value` | 异动检测的标准差倍数，越大越不敏感 | 2 |
| `rolling_window` | 异动检测滚动窗口的数据点数 | 30 |
| `broadcast_interval` | 定期播报间隔（分钟） | 60 |
| `cooldown_3` | 条件3（日内高低点）的冷却时间（分钟） | 30 |
| `threshold_high` / `threshold_low` | 条件4 绝对阈值，留空表示不设置；触发后自动 +5 / -5 | 无 |
| `interval_high` / `interval_mid` / `interval_low` | 各时段抓取间隔（分钟） | 1 / 3 / 15 |
| `us_session_start` | 美股时段起始小时（CST），之后 KOSPI 排到最后 | 20 |
| `notify_all` | 全局通知开关 | 开 |
| `notify_1` ~ `notify_4` | 各条件的通知开关 | 开 |

## 技术栈

- [Cloudflare Workers](https://developers.cloudflare.com/workers/) + KV
- [Twelve Data](https://twelvedata.com/) — USD/KRW 实时汇率
- Yahoo Finance（非官方接口）— KOSPI / NASDAQ / S&P 500 行情
- [飞书开放平台](https://open.feishu.cn/) — 仅用于出站消息推送（互动卡片）
- [Chart.js](https://www.chartjs.org/) + [chartjs-plugin-zoom](https://www.chartjs.org/chartjs-plugin-zoom/) + [Hammer.js](https://hammerjs.github.io/)（触屏手势） — 前端图表渲染
- 无框架原生 HTML/CSS/JS（PWA 仪表盘与 admin 面板均为单文件模板字符串）

## 已知限制

- Yahoo Finance 为非官方接口，不保证长期稳定可用；抓取失败时会自动回退
  使用上一次抓到的缓存值，并在 UI 上以红点/延迟"/"标出。
- Cloudflare 免费版 KV 每日写入配额为 1000 次，抓取节奏和互斥锁写入已经
  做过优化以避免提前耗尽额度（详见 `scheduler.js` 内注释）。
- 历史数据仅保留 31 天（KV TTL），超过后无法回看。
