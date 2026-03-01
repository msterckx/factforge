CREATE TABLE `category_translations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`language` text NOT NULL,
	`name` text NOT NULL,
	`is_auto_translated` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_translations_category_id_language_unique` ON `category_translations` (`category_id`,`language`);--> statement-breakpoint
CREATE TABLE `subcategory_translations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subcategory_id` integer NOT NULL,
	`language` text NOT NULL,
	`name` text NOT NULL,
	`is_auto_translated` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subcategory_translations_subcategory_id_language_unique` ON `subcategory_translations` (`subcategory_id`,`language`);