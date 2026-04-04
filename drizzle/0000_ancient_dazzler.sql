CREATE TABLE `xhs_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `xhs_posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `xhs_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `xhs_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`link` text NOT NULL,
	`preview_image` text,
	`user_id` text NOT NULL,
	`city` text,
	`tags` text,
	`category` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `xhs_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `xhs_users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`photo_url` text,
	`email` text NOT NULL,
	`interests` text,
	`created_at` integer
);
