CREATE TABLE `xhs_favorites` (
	`user_id` text NOT NULL,
	`post_id` integer NOT NULL,
	`created_at` integer,
	PRIMARY KEY(`user_id`, `post_id`)
);
--> statement-breakpoint
CREATE INDEX `xhs_favorites_post_idx` ON `xhs_favorites` (`post_id`);--> statement-breakpoint
CREATE INDEX `xhs_favorites_user_created_idx` ON `xhs_favorites` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `xhs_likes` (
	`user_id` text NOT NULL,
	`post_id` integer NOT NULL,
	`created_at` integer,
	PRIMARY KEY(`user_id`, `post_id`)
);
--> statement-breakpoint
CREATE INDEX `xhs_likes_post_idx` ON `xhs_likes` (`post_id`);