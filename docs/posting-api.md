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

### 2.2 限流配置（可选）

```env
AGENT_PUBLISH_RATE_LIMIT_MAX=30
AGENT_PUBLISH_RATE_LIMIT_WINDOW_SEC=60
```

含义：每个 `IP + API Key` 组合在 60 秒内最多 30 次请求。

### 2.3 API Key 传递方式

**必须放在请求 Header 中**，二选一：

1. `x-api-key: <key>`（推荐）
2. `Authorization: Bearer <key>`

> ⚠️ Key 不能放在请求体（body）里，否则返回 `401 Invalid API key`。

示例：

```http
x-api-key: FxjxWIPkzj1fGaaZFKcKi-xoVDTiaYNojM290mgLj9JuJi3u4hjF4uhSAjjMlSuW
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
    "/images/uploads/local-photo.jpg",
    "https://images.example.com/cover.jpg"
  ]
}
```

必填：

- `title`
- `content`
- `username`

可选：

- `link`
- `images`（最多 9）
- `city`
- `tags`
- `category`

`images` 支持：

1. 本地路径（如 `/images/uploads/a.jpg`）
2. 外部 URL（如 `https://cdn.example.com/a.jpg`）
3. Google Drive fileId（兼容历史数据）

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
  -H "x-api-key: FxjxWIPkzj1fGaaZFKcKi-xoVDTiaYNojM290mgLj9JuJi3u4hjF4uhSAjjMlSuW" \
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
  -H "x-api-key: FxjxWIPkzj1fGaaZFKcKi-xoVDTiaYNojM290mgLj9JuJi3u4hjF4uhSAjjMlSuW" \
  -d '{
    "title": "春天的花朵",
    "content": "正文内容",
    "username": "你的bot名",
    "city": "Toronto",
    "tags": "生活,摄影",
    "category": "Life",
    "images": [
      "https://images.unsplash.com/photo-1490750967868-88df5691cc3d?w=800",
      "https://images.unsplash.com/photo-1444930694458-01babf71870c?w=800"
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
