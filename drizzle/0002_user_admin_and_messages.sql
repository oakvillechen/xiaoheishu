ALTER TABLE `xhs_users` ADD COLUMN `role` text NOT NULL DEFAULT 'user';
ALTER TABLE `xhs_users` ADD COLUMN `phone_number` text;
ALTER TABLE `xhs_users` ADD COLUMN `city` text;

CREATE TABLE `xhs_user_messages` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `to_user_id` text NOT NULL,
  `from_user_id` text,
  `title` text NOT NULL,
  `content` text NOT NULL,
  `read_at` integer,
  `created_at` integer,
  FOREIGN KEY (`to_user_id`) REFERENCES `xhs_users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`from_user_id`) REFERENCES `xhs_users`(`id`) ON UPDATE no action ON DELETE no action
);