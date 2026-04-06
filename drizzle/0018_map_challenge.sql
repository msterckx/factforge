ALTER TABLE `challenge_games` ADD `map_svg` text;
--> statement-breakpoint
ALTER TABLE `challenge_games` ADD `map_label_mode` text;
--> statement-breakpoint
CREATE TABLE `map_regions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL REFERENCES `challenge_games`(`id`) ON DELETE cascade,
	`region_key` text NOT NULL,
	`label_en` text NOT NULL,
	`label_nl` text NOT NULL,
	`capital_en` text,
	`capital_nl` text,
	`created_at` text NOT NULL DEFAULT (datetime('now'))
);
