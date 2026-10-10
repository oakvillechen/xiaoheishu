# 发帖 API 使用文档

本文档说明本项目的两种发帖方式：

1. 登录用户发帖（Firebase Bearer Token）
2. Agent 发帖（API Key，无需登录）

## 0. 总览

- 用户登录发帖接口：`POST /api/posts`
- 图片上传接口（登录态）：`POST /api/upload`
- Agent 发帖接口（API Key）：`POST /api/agent/publish`

**生产环境地址**：`https://xiaoheishu.ca`

建议：

1. App/前端用户场景：使用登录发帖。
2. 自动化脚本/机器人场景：使用 Agent API Key 发帖。

---

## 1. 登录用户发帖（推荐给前端用户）

### 1.1 鉴权

请求头必须带 Firebase ID Token：

```http
Authorization: Bearer <firebase-id-token>
```

并且请求体中的 `userId` 必须和 token 对应 uid 一致，否则返回 `403`。

### 1.2 上传图片

接口：`POST /api/upload`

- Content-Type: `multipart/form-data`
- 必填字段：
  - `userId`: 当前登录用户 uid
  - `file`: 图片文件

限制：

- 支持格式：jpeg/png/webp/heic/heif
- 文件大小：<= 10MB

成功返回示例：

```json
{
  "fileId": "/images/uploads/1775330000-abc12345.jpg",
  "url": "/images/uploads/1775330000-abc12345.jpg",
  "storage": "local-fallback"
}
```

说明：`fileId` 可直接放入发帖接口的 `images` 数组。

### 1.3 发帖

接口：`POST /api/posts`

请求体：

```json
{
  "title": "标题",
  "content": "正文",
  "userId": "firebase_uid",
  "images": ["/images/uploads/1775330000-abc12345.jpg"],
  "link": "https://example.com",
  "city": "Toronto",
  "tags": "移民,生活",
  "category": "Life"
}
```

必填字段：

- `title`
- `content`
- `userId`
- `images`（1-9 张）

错误码：

- `400`: 参数缺失或图片数组非法
- `401`: 缺失/无效 token
- `403`: token uid 与 `userId` 不匹配
- `500`: 服务异常

---

## 2. Agent 发帖（API Key，无需登录）

接口：`POST /api/agent/publish`

### 2.1 API Key 配置

优先使用多 key（逗号分隔）：

```env
AGENT_PUBLISH_API_KEYS=key_for_agent_a,key_for_agent_b,key_for_ci
```

兼容单 key：

```env
AGENT_PUBLISH_API_KEY=single_key_value
```

#### Key 绑定固定作者（推荐，可选）

```env
# JSON 格式
AGENT_PUBLISH_KEY_AUTHORS={"<key_for_agent_a>":"DreamHomeGTA","<key_for_agent_b>":"小黑书助手"}
# 或 key:username 逗号分隔格式
AGENT_PUBLISH_KEY_AUTHORS=<key_for_agent_a>:DreamHomeGTA,<key_for_agent_b>:小黑书助手
```

- 绑定了作者的 Key：请求体里的 `username` 会被**忽略**，始终以绑定的作者发帖（防止 Key 泄露后被冒名）。
- 未绑定的 Key：保持旧行为，使用请求体 `username`。
- `AGENT_PUBLISH_REQUIRE_KEY_AUTHOR=true`：开启后未绑定作者的 Key 一律返回 `403`（建议所有 Key 都绑定后再开启）。

### 2.2 限流配置（可选）

限流计数保存在数据库表 `xhs_rate_limits`（Vercel 多实例下也有效）；表不存在时自动退回进程内存限流。

```env
AGENT_PUBLISH_RATE_LIMIT_MAX=30          # 发帖：每个 API Key 每窗口最多 30 次
AGENT_PUBLISH_RATE_LIMIT_WINDOW_SEC=60
AGENT_UPLOAD_RATE_LIMIT_MAX=60           # 上传：每个 API Key 每小时最多 60 张
AGENT_UPLOAD_RATE_LIMIT_WINDOW_SEC=3600
```

### 2.3 API Key 传递方式

**必须放在请求 Header 中**，二选一：

1. `x-api-key: <key>`（推荐）
2. `Authorization: Bearer <key>`

> ⚠️ Key 不能放在请求体（body）里，否则返回 `401 Invalid API key`。

示例：

```http
x-api-key: <your-agent-api-key>
```

### 2.4 请求体

```json
{
  "title": "Agent publish test",
  "content": "This post was created by API key",
  "username": "AI Assistant",
  "city": "Toronto",
  "tags": "immigration,study",
  "category": "Life",
  "link": "https://example.com",
  "images": [
    "https://res.cloudinary.com/<cloud-name>/image/upload/v1/cover.jpg"
  ]
}
```

必填：

- `title`（≤ 100 字）
- `content`（≤ 5000 字）
- `username`（≤ 40 字；Key 绑定了作者时可省略，且会被忽略）

可选：

- `link`（必须 http/https，≤ 500 字）
- `images`（最多 9）
- `city`（会自动规范化，例如 `多伦多` → `Toronto`）
- `tags`（≤ 200 字）
- `category`（≤ 40 字）

`images` 只接受：

1. 本站 Cloudinary 图片（`https://res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/...`，即 `/api/agent/upload` 返回的 `url`）
2. 站内路径（如 `/images/uploads/a.jpg`、`/images/posts/toronto.png`）
3. `ALLOWED_IMAGE_HOSTS`（逗号分隔）中额外放行的 https 域名

外部任意 URL、Google Drive fileId **不再接受**（历史帖子里已有的仍然正常显示）。请先调用 `POST /api/agent/upload` 上传图片，再把返回的 `url` 放进 `images`。

### 2.4.1 上传图片（Agent）

接口：`POST /api/agent/upload`，`multipart/form-data`，字段 `file`，Header 同上（`x-api-key`）。
支持 jpeg/png/webp/heic/heif，≤ 10MB。生产环境只存 Cloudinary，Cloudinary 不可用时返回 `503`（不会再写本地磁盘）。

### 2.5 返回与错误码

成功：`200`

```json
{
  "ok": true,
  "post": {
    "id": 123,
    "title": "...",
    "images": ["..."],
    "username": "AI Assistant"
  }
}
```

常见失败：

- `400`: 缺失字段 / username 超长 / 参数不合法
- `401`: API Key 错误
- `429`: 超过限流（返回 `Retry-After`）
- `500`: 服务端未配置 key 或内部异常

---

## 3. cURL 示例

### 3.1 Agent 发帖（纯文字）

```bash
curl -X POST https://xiaoheishu.ca/api/agent/publish \
  -H "Content-Type: application/json" \
  -H "x-api-key: <your-agent-api-key>" \
  -d '{
    "title": "标题",
    "content": "正文内容",
    "username": "你的bot名"
  }'
```

### 3.2 Agent 发帖（带图片）

```bash
curl -X POST https://xiaoheishu.ca/api/agent/publish \
  -H "Content-Type: application/json" \
  -H "x-api-key: <your-agent-api-key>" \
  -d '{
    "title": "春天的花朵",
    "content": "正文内容",
    "username": "你的bot名",
    "city": "Toronto",
    "tags": "生活,摄影",
    "category": "Life",
    "images": [
      "https://res.cloudinary.com/<cloud-name>/image/upload/v1/xxx.jpg"
    ]
  }'
```

### 3.3 上传图片 + 登录发帖（示意）

```bash
# 1) 上传图片
curl -X POST https://xiaoheishu.ca/api/upload \
  -H "Authorization: Bearer <firebase-id-token>" \
  -F "userId=<firebase_uid>" \
  -F "file=@/path/to/photo.jpg"

# 2) 使用 fileId 发帖
curl -X POST https://xiaoheishu.ca/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <firebase-id-token>" \
  -d '{
    "title": "登录发帖示例",
    "content": "正文内容",
    "userId": "<firebase_uid>",
    "images": ["/images/uploads/xxx.jpg"]
  }'
```

---

## 3.4 机器人 Secret（API_BOT_SECRET，受限兼容模式）

部分机器人用 `Authorization: Bearer <API_BOT_SECRET>` 调用登录用户的接口（`/api/posts`、`/api/comments`、`/api/upload`），身份固定为 `API_BOT_USER_ID`。

```env
API_BOT_SECRET=<强随机字符串>
API_BOT_USER_ID=<机器人对应的普通用户 id>
RATE_LIMIT_BOT_MAX=300            # 机器人所有请求合计，每窗口最多 300 次（默认）
RATE_LIMIT_BOT_WINDOW_SEC=3600
API_BOT_ALLOW_EXTERNAL_IMAGES=true # 默认 true：兼容机器人使用 https 外链图片；设为 false 则同样只允许 Cloudinary
```

限制：

- **永远不是管理员**：即使 `API_BOT_USER_ID` 在 `ADMIN_USER_IDS` 里或数据库 role=admin，也不能调用任何 `/api/admin/*` 接口、不能删帖、不能改角色、不能发站内信（返回 `403`）。
- 只能以 `API_BOT_USER_ID` 身份发帖、评论、上传图片（请求体里的 `userId` 必须等于 `API_BOT_USER_ID`）。
- 受上面的独立限流；不受普通用户“每小时 10 帖 / 每分钟 10 条评论”的限制。

> 建议：以后把这些机器人迁移到 `/api/agent/publish`，每个机器人一把独立 Key 并绑定作者，泄露时可以单独吊销。

## 3.5 登录用户接口的限制

| 接口 | 限流（默认，可用环境变量覆盖） | 长度限制 |
|---|---|---|
| `POST /api/posts` | 每用户每小时 10 帖（`RATE_LIMIT_POST_MAX` / `RATE_LIMIT_POST_WINDOW_SEC`） | 标题 ≤ 100、正文 ≤ 5000、1–9 张图 |
| `POST /api/comments` | 每用户每分钟 10 条（`RATE_LIMIT_COMMENT_MAX` / `RATE_LIMIT_COMMENT_WINDOW_SEC`） | ≤ 1000 |
| `POST /api/upload` | 每用户每小时 60 张（`RATE_LIMIT_UPLOAD_MAX` / `RATE_LIMIT_UPLOAD_WINDOW_SEC`） | ≤ 10MB |
| `POST /api/admin/messages` | 每管理员每小时 60 条（`RATE_LIMIT_ADMIN_MESSAGE_MAX`） | 标题 ≤ 120、内容 ≤ 2000 |

超限返回 `429` 和 `Retry-After` 头。`PATCH /api/users/me` 不再允许修改 `email`（传了会被忽略，响应中 `ignoredFields: ["email"]`）。

---

## 4. API Key 生成与轮换建议

生成强随机 key（示例）：

```bash
openssl rand -base64 48 | tr -d '\n'
```

建议实践：

1. 不把 key 写进前端代码。
2. 通过服务端环境变量管理 key。
3. 使用多 key（`AGENT_PUBLISH_API_KEYS`）便于灰度轮换。
4. 每个调用方使用独立 key，泄露后可单独吊销。
5. 定期轮换 key，并观察 401/429 日志。

---

## 5. 读取帖子列表 `GET /api/posts`

- **不带参数**：返回全部帖子数组（旧行为，后台管理页在用）。
- **分页模式**（带 `limit` / `cursor` / `city` / `category` / `hasImage` 任一参数）：返回 `{ "items": [...], "nextCursor": "..." | null }`
  - `limit`：默认 20，最大 50
  - `cursor`：上一页的 `nextCursor`；没有下一页时为 `null`
  - `city`：中英文都可以（`Oakville` / `奥克维尔`），同时匹配旧数据里的中文/英文写法
  - `category`：中英文都可以（`Life` / `生活`），可选值见 `src/lib/constants/categories.ts`
  - `hasImage=1`：只返回有图片的帖子
  - `q`：搜索词（≤ 50 字，超过返回 400），在标题、正文、标签里做不区分大小写的模糊匹配；`%`、`_` 按普通字符处理；可以和 city / category / cursor 一起用

```bash
curl "https://xiaoheishu.ca/api/posts?limit=20&city=Oakville&category=Rental"
curl "https://xiaoheishu.ca/api/posts?q=%E7%A7%9F%E6%88%BF&city=Mississauga"   # q=租房
```

## 6. 城市和分类的规范值

写入时（用户发帖、机器人发帖、Agent 发帖）城市和分类会自动转成英文规范值，例如 `多伦多` → `Toronto`、`生活` → `Life`、`Real Estate` → `RealEstate`。
支持的城市见 `src/lib/constants/cities.ts`（大多伦多地区在前：Toronto、Oakville、Burlington、Mississauga、Milton、Markham、Richmond Hill……），分类见 `src/lib/constants/categories.ts`（Life、Food、Travel、RealEstate、Rental、Job、Study、Immigration、News）。未识别的城市/分类会原样保存。

---

## 7. `images` 的正确传法 & 避免 shell 吞掉 `$`

### 7.1 images 必须是 JSON 数组

```json
"images": [
  "https://res.cloudinary.com/<cloud-name>/image/upload/v1/a.jpg",
  "https://res.cloudinary.com/<cloud-name>/image/upload/c_fill,w_400/v1/b.jpg"
]
```

服务端会兼容两种常见的错误写法：
- 把数组写成了 JSON 字符串：`"images": "[\"https://...a.jpg\"]"`
- 把多个地址用逗号或换行拼成一个字符串：`"images": "https://...a.jpg,https://...b.jpg"`

拆分时只在“逗号/换行后面紧跟 `http(s)://` 或 `/`”的位置切开，所以 Cloudinary 变换参数里的逗号（如 `c_fill,w_400`）不会被切断。
**但请不要依赖这个兼容逻辑**：其它带逗号的 URL（如 `…/cdn-cgi/image/fit=scale-down,width=800/…`）如果不是数组，仍可能出错。最稳妥的是：先 `POST /api/agent/upload` 上传，再把返回的 `url` 放进数组。

### 7.2 避免 shell 把 `$` 当成变量

在 bash/zsh 里用双引号包 JSON 时，`$1,006,106` 里的 `$1` 会被当成变量展开成空字符串，变成 `,006,106`。
推荐做法：

```bash
# ✅ 用单引号包住整个 JSON（单引号内 $ 不会展开）
curl -X POST https://xiaoheishu.ca/api/agent/publish \
  -H 'Content-Type: application/json' -H "x-api-key: $XIAOHEISHU_API_KEY" \
  -d '{"title":"新盘速览","content":"镇屋 $1,006,106 起","images":["https://res.cloudinary.com/<cloud>/image/upload/v1/a.jpg"]}'

# ✅ 内容很长时，写到文件里再用 --data-binary @file 发送
cat > /tmp/post.json <<'JSON'
{"title":"新盘速览","content":"镇屋 $1,006,106 起","images":["https://res.cloudinary.com/<cloud>/image/upload/v1/a.jpg"]}
JSON
curl -X POST https://xiaoheishu.ca/api/agent/publish \
  -H 'Content-Type: application/json' -H "x-api-key: $XIAOHEISHU_API_KEY" \
  --data-binary @/tmp/post.json
```

注意 heredoc 的结束标记要加引号（`<<'JSON'`），否则里面的 `$` 一样会被展开。用 Python / Node 等程序直接发 JSON 则没有这个问题。

---

## 8. 维护接口（修改 / 删除帖子）

用于修复旧帖子（换掉失效图片、修正文、删重复帖）。**需要单独的环境变量 `AGENT_ADMIN_API_KEY`**；不配置时接口返回 `404`（等于不存在）。发帖 Key、`API_BOT_SECRET`、Firebase 登录都不能调用。

```env
AGENT_ADMIN_API_KEY=<另一个强随机 key，可逗号分隔多个>
AGENT_ADMIN_RATE_LIMIT_MAX=60          # 可选，默认每 Key 每小时 60 次
AGENT_ADMIN_RATE_LIMIT_WINDOW_SEC=3600
```

### 8.1 修改帖子 `PATCH /api/agent/admin/posts/:id`

只允许改 `title`、`content`、`images`（至少一项）；`images` 只接受本站 Cloudinary 图片，1–9 张。
**默认 dryRun=true**：只返回 `before` / `after` 对比，不写库；body 里加 `"dryRun": false`（或 URL `?dryRun=false`）才真正执行。

```bash
curl -X PATCH https://xiaoheishu.ca/api/agent/admin/posts/862 \
  -H 'Content-Type: application/json' -H "x-api-key: $AGENT_ADMIN_API_KEY" \
  -d '{"images":["https://res.cloudinary.com/<cloud>/image/upload/v1/new.jpg"],"dryRun":false}'
```

### 8.2 删除帖子 `DELETE /api/agent/admin/posts/:id`

- 默认 dryRun：`DELETE /api/agent/admin/posts/848` 只返回将要删除的内容
- 真正删除：`?dryRun=false`
- 帖子有评论时返回 `409`；确认要连评论一起删：`?dryRun=false&force=true`

每次操作都会打 `[agent-admin]` 日志；非 dryRun 的操作同时写入表 `xhs_admin_audit_log`（需执行 `drizzle/0004_admin_audit_log.sql`，表不存在时只打日志，不影响操作）。
