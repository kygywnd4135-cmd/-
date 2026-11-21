CREATE TABLE `profile_photos` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `use_photo` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `users` SET `avatar`=0 WHERE `avatar` NOT IN (0,1);
--> statement-breakpoint
UPDATE `player_profiles` SET `frame`='classic' WHERE `frame` NOT IN ('classic','crimson');
