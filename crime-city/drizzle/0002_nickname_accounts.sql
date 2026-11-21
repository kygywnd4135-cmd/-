ALTER TABLE `users` ADD `login_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `nickname_set` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `nickname_changed_at` integer;--> statement-breakpoint
UPDATE `users` SET `login_id`=`nickname` WHERE `login_id` IS NULL AND `id` NOT IN (SELECT `user_id` FROM `google_accounts`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_id_unique` ON `users` (`login_id`);
