CREATE TABLE `question_translations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`language` text NOT NULL,
	`question_text` text NOT NULL,
	`answer` text NOT NULL,
	`did_you_know` text,
	`is_auto_translated` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_translations_question_id_language_unique` ON `question_translations` (`question_id`,`language`);