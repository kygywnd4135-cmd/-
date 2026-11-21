ALTER TABLE `users` ADD `tutorial_step` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE users SET tutorial_step=14 WHERE nickname_set=1;
