CREATE TABLE `challenge_games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`game_type` text NOT NULL,
	`icon` text DEFAULT '🎮' NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`title_en` text NOT NULL,
	`title_nl` text NOT NULL,
	`subtitle_en` text DEFAULT '' NOT NULL,
	`subtitle_nl` text DEFAULT '' NOT NULL,
	`available` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_games_slug_unique` ON `challenge_games` (`slug`);--> statement-breakpoint
CREATE TABLE `challenge_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`description_nl` text DEFAULT '' NOT NULL,
	`dates` text,
	`fact` text,
	`hint` text,
	`achievement` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `challenge_games`(`id`) ON UPDATE no action ON DELETE cascade
);
