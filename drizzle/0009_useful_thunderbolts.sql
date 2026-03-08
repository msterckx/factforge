CREATE TABLE `challenge_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`challenge_id` text NOT NULL,
	`score` integer NOT NULL,
	`max_score` integer NOT NULL,
	`completed_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `challenge_scores_user_challenge_idx` ON `challenge_scores` (`user_email`,`challenge_id`);