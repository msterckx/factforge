ALTER TABLE `challenge_items` ADD `milestone_en` text;
--> statement-breakpoint
ALTER TABLE `challenge_items` ADD `milestone_nl` text;
--> statement-breakpoint
ALTER TABLE `challenge_items` DROP COLUMN `milestone`;
--> statement-breakpoint
ALTER TABLE `challenge_items` DROP COLUMN `fact`;
