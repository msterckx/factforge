ALTER TABLE `challenge_games` ADD `quiz_category_id` integer REFERENCES categories(id);--> statement-breakpoint
ALTER TABLE `challenge_games` ADD `quiz_subcategory_id` integer REFERENCES subcategories(id);--> statement-breakpoint
ALTER TABLE `challenge_games` ADD `quiz_question_limit` integer;