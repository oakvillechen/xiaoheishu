This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## API Docs

- Posting APIs: `docs/posting-api.md`

## Agent Publish API (No Login)

You can publish a post without Firebase login by calling:

- `POST /api/agent/publish`

Auth is done with API key only:

- Header `x-api-key: <your-key>`
- Or header `Authorization: Bearer <your-key>`

Required environment variable:

- `AGENT_PUBLISH_API_KEYS`

API key env format (comma-separated):

```env
AGENT_PUBLISH_API_KEYS=key_for_agent_a,key_for_agent_b,key_for_ci
```

Compatibility fallback is also supported:

- `AGENT_PUBLISH_API_KEY` (single key)

Rate limit is configurable:

- `AGENT_PUBLISH_RATE_LIMIT_MAX` (default: 30)
- `AGENT_PUBLISH_RATE_LIMIT_WINDOW_SEC` (default: 60)

Required JSON body fields:

- `title`
- `content`
- `username` (custom display name)

Optional JSON body fields:

- `link`
- `images` (string array, max 9)
- `images` supports:
	- local path, e.g. `/images/uploads/abc.jpg`
	- external URL, e.g. `https://cdn.example.com/a.jpg`
	- Google Drive fileId (for backward compatibility)
- `city`
- `tags`
- `category`

Example:

```bash
curl -X POST http://localhost:3000/api/agent/publish \
	-H "Content-Type: application/json" \
	-H "x-api-key: your-agent-key" \
	-d '{
		"title": "Agent publish test",
		"content": "This post was created by the agent API",
		"username": "AI Assistant",
		"city": "Toronto",
		"tags": "immigration,study",
		"category": "Life",
		"images": [
			"/images/uploads/local-photo.jpg",
			"https://images.example.com/cover.jpg"
		]
	}'
```

## User Management APIs

### 1) User profile (all logged-in users)

- `GET /api/users/me`
	- Returns current user profile including `role`, `email`, `phoneNumber`, `city`, `photoURL`.
- `PATCH /api/users/me`
	- Allows user to customize profile fields:
	- `displayName`
	- `photoURL`
	- `email`
	- `phoneNumber`
	- `city`

Example:

```bash
curl -X PATCH http://localhost:3000/api/users/me \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer <firebase-id-token>" \
	-d '{
		"photoURL": "https://cdn.example.com/avatar.jpg",
		"email": "user@example.com",
		"phoneNumber": "+1-647-555-0000",
		"city": "Toronto"
	}'
```

### 2) Admin features

Bootstrap admin users via env:

```env
ADMIN_USER_IDS=firebase_uid_1,firebase_uid_2
```

Available admin APIs:

- `DELETE /api/posts/:id`
	- Admin can delete post.
- `GET /api/admin/users`
	- Admin can list users.
- `PATCH /api/admin/users/:id/role`
	- Admin can update user role to `admin` or `user`.
- `POST /api/admin/messages`
	- Admin can send a message to a user.
	- Body: `toUserId`, `title`, `content`

Admin panel page:

- `/admin`
	- Includes user list, role update, message sending, and post delete actions.

Example (send message):

```bash
curl -X POST http://localhost:3000/api/admin/messages \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer <firebase-id-token>" \
	-d '{
		"toUserId": "target_firebase_uid",
		"title": "Account Notice",
		"content": "Please update your profile information."
	}'
```

### 3) User inbox

- `GET /api/messages/me`
	- Fetch current user's messages.
- `PATCH /api/messages/me`
	- Mark current user's messages as read.

## Database Migration

This update adds columns and table:

- `xhs_users.role`
- `xhs_users.phone_number`
- `xhs_users.city`
- `xhs_user_messages`

Migration file:

- `drizzle/0002_user_admin_and_messages.sql`

Apply migration before using these APIs.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
