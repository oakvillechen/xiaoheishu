PRAGMA foreign_keys=OFF;

CREATE TABLE `__new_xhs_posts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `content` text,
  `link` text,
  `images` text,
  `user_id` text NOT NULL,
  `city` text,
  `tags` text,
  `category` text,
  `created_at` integer,
  FOREIGN KEY (`user_id`) REFERENCES `xhs_users`(`id`) ON UPDATE no action ON DELETE no action
);

INSERT INTO `__new_xhs_posts` (
  `id`,
  `title`,
  `content`,
  `link`,
  `images`,
  `user_id`,
  `city`,
  `tags`,
  `category`,
  `created_at`
)
SELECT
  `id`,
  `title`,
  `content`,
  `link`,
  CASE
    WHEN `preview_image` IS NULL OR TRIM(`preview_image`) = '' THEN NULL
    ELSE json_array(`preview_image`)
  END AS `images`,
  `user_id`,
  `city`,
  `tags`,
  `category`,
  `created_at`
FROM `xhs_posts`;

DROP TABLE `xhs_posts`;
ALTER TABLE `__new_xhs_posts` RENAME TO `xhs_posts`;

PRAGMA foreign_keys=ON;
