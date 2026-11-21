CREATE TABLE `google_accounts` (
	`subject` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_accounts_user_id_unique` ON `google_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `google_auth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`verifier` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lobby_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lobby_messages_created` ON `lobby_messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `lobby_messages_user_created` ON `lobby_messages` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lobby_presence` (
	`user_id` text PRIMARY KEY NOT NULL,
	`seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `player_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '뉴비 머미러' NOT NULL,
	`frame` text DEFAULT 'classic' NOT NULL,
	`points` integer DEFAULT 0 NOT NULL
);
