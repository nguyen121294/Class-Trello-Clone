-- 1. Create organizations table first (since users & workspaces reference it)
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- 2. Add org_id to users and workspaces
ALTER TABLE "users" ADD COLUMN "org_id" UUID;
CREATE INDEX "users_org_id_idx" ON "users"("org_id");
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspaces" ADD COLUMN "org_id" UUID;
CREATE INDEX "workspaces_org_id_idx" ON "workspaces"("org_id");
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Add google_drive_url, golive_date to boards
ALTER TABLE "boards" ADD COLUMN "google_drive_url" TEXT;
ALTER TABLE "boards" ADD COLUMN "golive_date" DATE;

-- 4. Add jira_url, expected_result to cards
ALTER TABLE "cards" ADD COLUMN "jira_url" TEXT;
ALTER TABLE "cards" ADD COLUMN "expected_result" TEXT;

-- 5. Create milestones table
CREATE TABLE "milestones" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "target_date" DATE NOT NULL,
    "payment_amount" DECIMAL(15,2),
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "milestones_board_id_target_date_idx" ON "milestones"("board_id", "target_date");
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Create card_assignees table
CREATE TABLE "card_assignees" (
    "id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "user_id" UUID,
    "external_name" TEXT,
    "assignee_type" TEXT NOT NULL DEFAULT 'internal',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_assignees_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "card_assignees_card_id_idx" ON "card_assignees"("card_id");
CREATE INDEX "card_assignees_user_id_idx" ON "card_assignees"("user_id");
ALTER TABLE "card_assignees" ADD CONSTRAINT "card_assignees_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_assignees" ADD CONSTRAINT "card_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Create card_dependencies table
CREATE TABLE "card_dependencies" (
    "id" UUID NOT NULL,
    "predecessor_id" UUID NOT NULL,
    "successor_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FS',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_dependencies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "card_dependencies_predecessor_id_successor_id_key" ON "card_dependencies"("predecessor_id", "successor_id");
CREATE INDEX "card_dependencies_successor_id_idx" ON "card_dependencies"("successor_id");
ALTER TABLE "card_dependencies" ADD CONSTRAINT "card_dependencies_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_dependencies" ADD CONSTRAINT "card_dependencies_successor_id_fkey" FOREIGN KEY ("successor_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Create weekly_reports table
CREATE TABLE "weekly_reports" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "week_number" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "near_milestone_id" UUID,
    "weeks_to_golive" DECIMAL(5,1),
    "meetings" JSONB,
    "pdf_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "weekly_reports_board_id_week_number_year_key" ON "weekly_reports"("board_id", "week_number", "year");
CREATE INDEX "weekly_reports_board_id_idx" ON "weekly_reports"("board_id");
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_near_milestone_id_fkey" FOREIGN KEY ("near_milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 9. Create weekly_report_tasks table
CREATE TABLE "weekly_report_tasks" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "scope_type" TEXT NOT NULL,
    "module_name" TEXT,
    "expected_result" TEXT,
    "internal_pics_text" TEXT,
    "client_pics_text" TEXT,
    "status_text" TEXT,
    "progress_evaluation" TEXT,
    "is_carried_over" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_report_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "weekly_report_tasks_report_id_idx" ON "weekly_report_tasks"("report_id");
CREATE INDEX "weekly_report_tasks_card_id_idx" ON "weekly_report_tasks"("card_id");
ALTER TABLE "weekly_report_tasks" ADD CONSTRAINT "weekly_report_tasks_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "weekly_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_report_tasks" ADD CONSTRAINT "weekly_report_tasks_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 10. Create member_weekly_checkins table
CREATE TABLE "member_weekly_checkins" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "week_number" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "done_text" TEXT NOT NULL,
    "plan_text" TEXT NOT NULL,
    "blocker_text" TEXT,
    "hours_worked" DECIMAL(5,1),
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_weekly_checkins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "member_weekly_checkins_board_id_user_id_week_number_year_key" ON "member_weekly_checkins"("board_id", "user_id", "week_number", "year");
CREATE INDEX "member_weekly_checkins_board_id_week_number_year_idx" ON "member_weekly_checkins"("board_id", "week_number", "year");
ALTER TABLE "member_weekly_checkins" ADD CONSTRAINT "member_weekly_checkins_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_weekly_checkins" ADD CONSTRAINT "member_weekly_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
