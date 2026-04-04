import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('xhs_users', {
  id: text('id').primaryKey(), // Firebase UID
  displayName: text('display_name'),
  photoURL: text('photo_url'),
  email: text('email').notNull(),
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
