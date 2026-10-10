CREATE TABLE `xhs_admin_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`post_id` integer,
	`actor` text NOT NULL,
	`dry_run` integer NOT NULL,
	`before` text,
	`after` text,
	`created_at` integer
);
