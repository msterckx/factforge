PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_text` text NOT NULL,
	`answer` text NOT NULL,
	`category_id` integer NOT NULL,
	`subcategory_id` integer,
	`difficulty` text DEFAULT 'easy' NOT NULL,
	`did_you_know` text,
	`image_path` text,
	`image_is_hint` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_questions`("id", "question_text", "answer", "category_id", "subcategory_id", "difficulty", "did_you_know", "image_path", "image_is_hint", "created_at", "updated_at") SELECT "id", "question_text", "answer", "category_id", "subcategory_id", "difficulty", "did_you_know", "image_path", "image_is_hint", "created_at", "updated_at" FROM `questions`;--> statement-breakpoint
DROP TABLE `questions`;--> statement-breakpoint
ALTER TABLE `__new_questions` RENAME TO `questions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;