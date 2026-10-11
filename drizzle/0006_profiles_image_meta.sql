CREATE TABLE `xhs_image_meta` (
	`url` text PRIMARY KEY NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `xhs_user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`bio` text,
	`updated_at` integer
);
