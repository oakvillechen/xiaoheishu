import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('xhs_users', {
  id: text('id').primaryKey(), // Firebase UID
  role: text('role').notNull().default('user'), // user | admin
  displayName: text('display_name'),
  photoURL: text('photo_url'),
  email: text('email').notNull(),
  phoneNumber: text('phone_number'),
  city: text('city'),
  interests: text('interests'), // JSON string or comma separated
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const posts = sqliteTable('xhs_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content'),
  link: text('link'),
  images: text('images'), // JSON string array of Google Drive fileIds
  userId: text('user_id').notNull().references(() => users.id),
  city: text('city'), // e.g., "Oakville", "Toronto"
  tags: text('tags'), // e.g., "移民", "留学"
  category: text('category'), // e.g., "Life", "Job", "Study"
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const comments = sqliteTable('xhs_comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id').notNull().references(() => posts.id),
  userId: text('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const userMessages = sqliteTable('xhs_user_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  toUserId: text('to_user_id').notNull().references(() => users.id),
  fromUserId: text('from_user_id').references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  readAt: integer('read_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// 限流计数（固定窗口），key = "<规则名>:<哈希后的主体>"，reset_at 为毫秒时间戳
export const rateLimits = sqliteTable('xhs_rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: integer('reset_at').notNull(),
});

// 维护接口（/api/agent/admin/*）操作日志
export const adminAuditLog = sqliteTable('xhs_admin_audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  action: text('action').notNull(), // 'patch-post' | 'delete-post'
  postId: integer('post_id'),
  actor: text('actor').notNull(), // 'agent-admin:<key 哈希前 12 位>'
  dryRun: integer('dry_run', { mode: 'boolean' }).notNull(),
  before: text('before'), // JSON
  after: text('after'), // JSON
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// 点赞：每个用户对每篇帖子最多一条（复合主键保证唯一，重复点赞是幂等的）
export const likes = sqliteTable(
  'xhs_likes',
  {
    userId: text('user_id').notNull(),
    postId: integer('post_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index('xhs_likes_post_idx').on(t.postId)],
);

// 收藏：同上；(user_id, created_at) 索引用于「我的收藏」按时间倒序分页
export const favorites = sqliteTable(
  'xhs_favorites',
  {
    userId: text('user_id').notNull(),
    postId: integer('post_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.postId] }),
    index('xhs_favorites_post_idx').on(t.postId),
    index('xhs_favorites_user_created_idx').on(t.userId, t.createdAt),
  ],
);
