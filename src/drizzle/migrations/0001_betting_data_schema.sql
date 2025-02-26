DO $$ BEGIN
 CREATE TYPE "public"."bet_result" AS ENUM('Won', 'Lost', 'Push', 'Pending', 'Canceled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."bet_type" AS ENUM('Single', 'Parlay', 'Teaser', 'Round Robin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Single bets table
CREATE TABLE IF NOT EXISTS "single_bets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "date_placed" timestamp with time zone,
  "status" text,
  "league" text,
  "match" text,
  "bet_type" text,
  "market" text,
  "selection" text,
  "price" real,
  "wager" real,
  "winnings" real,
  "payout" real,
  "result" text,
  "bet_slip_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Parlay headers table
CREATE TABLE IF NOT EXISTS "parlay_headers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "date_placed" timestamp with time zone,
  "status" text,
  "match" text,
  "bet_type" text,
  "market" text,
  "selection" text,
  "price" real,
  "wager" real,
  "winnings" real,
  "payout" real,
  "potential_payout" real,
  "result" text,
  "bet_slip_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Parlay legs table
CREATE TABLE IF NOT EXISTS "parlay_legs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parlay_id" uuid NOT NULL,
  "leg_number" integer NOT NULL,
  "status" text,
  "league" text,
  "match" text,
  "market" text,
  "selection" text,
  "price" real,
  "game_date" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Team stats aggregation table
CREATE TABLE IF NOT EXISTS "team_stats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "team" text NOT NULL,
  "league" text,
  "total_bets" integer DEFAULT 0 NOT NULL,
  "wins" integer DEFAULT 0 NOT NULL,
  "losses" integer DEFAULT 0 NOT NULL,
  "pushes" integer DEFAULT 0 NOT NULL,
  "pending" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Player stats aggregation table
CREATE TABLE IF NOT EXISTS "player_stats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "player" text NOT NULL,
  "prop_types" text[],
  "total_bets" integer DEFAULT 0 NOT NULL,
  "wins" integer DEFAULT 0 NOT NULL,
  "losses" integer DEFAULT 0 NOT NULL,
  "pushes" integer DEFAULT 0 NOT NULL,
  "pending" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Prop stats aggregation table
CREATE TABLE IF NOT EXISTS "prop_stats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "prop_type" text NOT NULL,
  "total_bets" integer DEFAULT 0 NOT NULL,
  "wins" integer DEFAULT 0 NOT NULL,
  "losses" integer DEFAULT 0 NOT NULL,
  "pushes" integer DEFAULT 0 NOT NULL,
  "pending" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Foreign key for parlay legs
ALTER TABLE "parlay_legs" ADD CONSTRAINT "parlay_legs_parlay_id_fkey" 
FOREIGN KEY ("parlay_id") REFERENCES "parlay_headers"("id") ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "single_bets.user_id_index" ON "single_bets" ("user_id");
CREATE INDEX IF NOT EXISTS "parlay_headers.user_id_index" ON "parlay_headers" ("user_id");
CREATE INDEX IF NOT EXISTS "parlay_headers.bet_slip_id_index" ON "parlay_headers" ("bet_slip_id");
CREATE INDEX IF NOT EXISTS "parlay_legs.parlay_id_index" ON "parlay_legs" ("parlay_id");
CREATE INDEX IF NOT EXISTS "team_stats.user_id_index" ON "team_stats" ("user_id");
CREATE INDEX IF NOT EXISTS "team_stats.team_index" ON "team_stats" ("team");
CREATE INDEX IF NOT EXISTS "player_stats.user_id_index" ON "player_stats" ("user_id");
CREATE INDEX IF NOT EXISTS "player_stats.player_index" ON "player_stats" ("player");
CREATE INDEX IF NOT EXISTS "prop_stats.user_id_index" ON "prop_stats" ("user_id");
CREATE INDEX IF NOT EXISTS "prop_stats.prop_type_index" ON "prop_stats" ("prop_type");
