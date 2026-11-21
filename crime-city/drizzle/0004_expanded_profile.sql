ALTER TABLE `player_profiles` ADD `featured_achievement` text;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `last_game_honor` integer DEFAULT 0 NOT NULL;