ALTER TABLE `challenge_items` ADD `milestone_en` text;
ALTER TABLE `challenge_items` ADD `milestone_nl` text;
ALTER TABLE `challenge_items` DROP COLUMN `milestone`;
ALTER TABLE `challenge_items` DROP COLUMN `fact`;
