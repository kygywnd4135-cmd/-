CREATE TABLE `friend_requests` (
	`pair_key` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `friend_requests_sender` ON `friend_requests` (`sender_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `friend_requests_recipient` ON `friend_requests` (`recipient_id`,`created_at`);