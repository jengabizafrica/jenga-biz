drop trigger if exists "trg_sync_financial_records" on "public"."financial_transactions";

drop policy "Users can manage financial records for their businesses" on "public"."financial_records";

drop policy "Users can manage their own businesses" on "public"."businesses";

drop policy "Users can view their own businesses" on "public"."businesses";

drop policy "Users can delete their own transactions" on "public"."financial_transactions";

drop policy "Users can insert their own transactions" on "public"."financial_transactions";

drop policy "Users can update their own transactions" on "public"."financial_transactions";

drop policy "Users can view their own transactions" on "public"."financial_transactions";

alter table "public"."financial_transactions" drop constraint "financial_transactions_business_id_fkey";

alter table "public"."milestone_completion_analytics" drop constraint "milestone_completion_analytics_business_id_fkey";

alter table "public"."milestone_completion_analytics" drop constraint "milestone_completion_analytics_user_id_fkey";

alter table "public"."profiles" drop constraint "profiles_hub_id_fkey";

drop function if exists "public"."has_role"(p_user_id uuid, p_role user_role);

drop function if exists "public"."is_admin_or_hub_manager"(p_user_id uuid);

drop function if exists "public"."is_super_admin"(p_user_id uuid);

drop function if exists "public"."migrate_milestones_to_strategies"();

drop function if exists "public"."service_add_user_role"(target_user_id uuid, new_role user_role, requester_user_id uuid, requester_ip inet, requester_user_agent text);

drop function if exists "public"."set_milestone_user_id"();

drop function if exists "public"."sync_financial_records"();

drop view if exists "public"."financial_records_with_hub";

drop index if exists "public"."idx_financial_transactions_business_id";

drop index if exists "public"."idx_role_change_audit_actor_id";

drop index if exists "public"."idx_role_change_audit_user_id";

create table "public"."app_settings" (
    "key" text not null,
    "value" text not null,
    "description" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."app_settings" enable row level security;

create table "public"."approval_audit" (
    "id" uuid not null default gen_random_uuid(),
    "approval_id" uuid not null,
    "action" text not null,
    "performed_by" uuid,
    "reason" text,
    "requester_ip" inet,
    "requester_user_agent" text,
    "created_at" timestamp with time zone default now()
);


alter table "public"."approval_audit" enable row level security;

create table "public"."business_progress_stages" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "strategy_id" uuid,
    "stage_name" text not null,
    "started_at" timestamp with time zone not null default now(),
    "completed_at" timestamp with time zone,
    "time_spent_seconds" integer default 0,
    "form_fields_completed" integer default 0,
    "total_form_fields" integer default 0,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."business_progress_stages" enable row level security;

create table "public"."business_survival_records" (
    "id" uuid not null default gen_random_uuid(),
    "business_id" uuid not null,
    "assessment_date" date not null default CURRENT_DATE,
    "months_in_operation" integer not null default 0,
    "is_active" boolean not null default true,
    "closure_date" date,
    "closure_reason" text,
    "revenue_trend" text,
    "employee_count" integer default 0,
    "survival_risk_score" integer,
    "risk_factors" text[],
    "support_interventions" text[],
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."business_survival_records" enable row level security;

create table "public"."finance_access_records" (
    "id" uuid not null default gen_random_uuid(),
    "business_id" uuid not null,
    "record_date" date not null default CURRENT_DATE,
    "funding_source" text not null,
    "funding_type" text not null,
    "amount_requested" numeric(12,2),
    "amount_approved" numeric(12,2),
    "amount_disbursed" numeric(12,2),
    "interest_rate" numeric(5,2),
    "loan_term_months" integer,
    "purpose" text,
    "application_status" text default 'pending'::text,
    "rejection_reason" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."finance_access_records" enable row level security;

create table "public"."geographic_analytics" (
    "id" uuid not null default gen_random_uuid(),
    "country_code" text not null,
    "country_name" text not null,
    "region" text,
    "user_count" integer not null default 0,
    "active_businesses" integer not null default 0,
    "total_revenue" numeric default 0,
    "last_updated" timestamp with time zone not null default now()
);


alter table "public"."geographic_analytics" enable row level security;

create table "public"."invite_codes" (
    "id" uuid not null default gen_random_uuid(),
    "code" text not null,
    "created_by" uuid not null,
    "invited_email" text not null,
    "account_type" text not null,
    "used_at" timestamp with time zone,
    "used_by" uuid,
    "expires_at" timestamp with time zone not null default (now() + '7 days'::interval),
    "created_at" timestamp with time zone not null default now(),
    "deleted_by" uuid,
    "deleted_at" timestamp with time zone,
    "hub_id" uuid
);


alter table "public"."invite_codes" enable row level security;

create table "public"."job_creation_records" (
    "id" uuid not null default gen_random_uuid(),
    "business_id" uuid not null,
    "jobs_created" integer not null default 0,
    "job_type" text,
    "recorded_date" date not null default CURRENT_DATE,
    "created_at" timestamp with time zone not null default now(),
    "employment_type" text default 'full_time'::text,
    "skill_level" text default 'entry'::text,
    "average_wage" numeric(10,2),
    "benefits_provided" boolean default false,
    "gender_breakdown" jsonb default '{"male": 0, "other": 0, "female": 0}'::jsonb,
    "age_breakdown" jsonb default '{"55+": 0, "18-25": 0, "26-35": 0, "36-45": 0, "46-55": 0}'::jsonb,
    "retention_rate" numeric(5,2),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."job_creation_records" enable row level security;

create table "public"."loan_readiness_assessments" (
    "id" uuid not null default gen_random_uuid(),
    "business_id" uuid not null,
    "assessment_date" date not null default CURRENT_DATE,
    "credit_score" integer,
    "revenue_stability_score" integer,
    "cash_flow_score" integer,
    "debt_to_income_ratio" numeric(5,2),
    "collateral_value" numeric(12,2) default 0,
    "business_plan_score" integer,
    "financial_documentation_score" integer,
    "overall_readiness_score" integer,
    "readiness_level" text,
    "recommendations" text[],
    "assessed_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."loan_readiness_assessments" enable row level security;

create table "public"."milestones" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "strategy_id" uuid,
    "title" text not null,
    "target_date" date,
    "status" text default 'not-started'::text,
    "business_stage" text default 'ideation'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "completed_at" timestamp with time zone,
    "milestone_type" text,
    "description" text
);


alter table "public"."milestones" enable row level security;

create table "public"."pending_approvals" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "user_email" text not null,
    "full_name" text,
    "invite_code" text,
    "payload" jsonb,
    "status" approval_status default 'pending'::approval_status,
    "approved_by" uuid,
    "approved_at" timestamp with time zone,
    "rejection_reason" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."pending_approvals" enable row level security;

create table "public"."settings_audit" (
    "id" uuid not null default gen_random_uuid(),
    "setting_key" text not null,
    "old_value" text,
    "new_value" text,
    "changed_by" uuid,
    "requester_ip" inet,
    "requester_user_agent" text,
    "created_at" timestamp with time zone default now()
);


alter table "public"."settings_audit" enable row level security;

create table "public"."strategies" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "template_id" text,
    "template_name" text,
    "business_name" text,
    "vision" text,
    "mission" text,
    "target_market" text,
    "revenue_model" text,
    "value_proposition" text,
    "key_partners" text,
    "marketing_approach" text,
    "operational_needs" text,
    "growth_goals" text,
    "language" text default 'en'::text,
    "country" text default 'KE'::text,
    "currency" text default 'KES'::text,
    "is_active" boolean default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "business_id" uuid
);


alter table "public"."strategies" enable row level security;

create table "public"."template_usage_analytics" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "template_id" text not null,
    "template_name" text not null,
    "selected_at" timestamp with time zone not null default now(),
    "completed_at" timestamp with time zone,
    "completion_percentage" numeric default 0,
    "time_to_complete_minutes" integer,
    "abandoned_at_stage" text,
    "conversion_type" text,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."template_usage_analytics" enable row level security;

create table "public"."user_activities" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "activity_type" text not null,
    "activity_data" jsonb default '{}'::jsonb,
    "ip_address" inet,
    "user_agent" text,
    "country_code" text,
    "region" text,
    "city" text,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."user_activities" enable row level security;

create table "public"."user_journey_analytics" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "session_id" text not null,
    "page_path" text not null,
    "action_type" text not null,
    "action_data" jsonb default '{}'::jsonb,
    "timestamp" timestamp with time zone not null default now(),
    "user_agent" text,
    "referrer" text,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."user_journey_analytics" enable row level security;

alter table "public"."analytics_summaries" drop column "value";

alter table "public"."analytics_summaries" add column "additional_data" jsonb default '{}'::jsonb;

alter table "public"."analytics_summaries" add column "created_at" timestamp with time zone not null default now();

alter table "public"."analytics_summaries" add column "metric_value" numeric not null default 0;

alter table "public"."analytics_summaries" alter column "metric_date" set not null;

alter table "public"."analytics_summaries" alter column "metric_type" set not null;

alter table "public"."analytics_summaries" enable row level security;

alter table "public"."businesses" alter column "name" set not null;

alter table "public"."businesses" alter column "stage" set default 'idea'::business_stage;

alter table "public"."businesses" alter column "user_id" set not null;

alter table "public"."financial_records" drop column "expenses";

alter table "public"."financial_records" drop column "revenue";

alter table "public"."financial_transactions" drop column "business_id";

alter table "public"."financial_transactions" add column "category" text not null;

alter table "public"."financial_transactions" add column "description" text not null;

alter table "public"."financial_transactions" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."financial_transactions" alter column "amount" set not null;

alter table "public"."financial_transactions" alter column "currency" set default 'KES'::text;

alter table "public"."financial_transactions" alter column "currency" set not null;

alter table "public"."financial_transactions" alter column "strategy_id" set not null;

alter table "public"."financial_transactions" alter column "transaction_date" set default CURRENT_DATE;

alter table "public"."financial_transactions" alter column "transaction_date" set not null;

alter table "public"."financial_transactions" alter column "transaction_date" set data type date using "transaction_date"::date;

alter table "public"."financial_transactions" alter column "transaction_type" set not null;

alter table "public"."financial_transactions" alter column "user_id" set not null;

alter table "public"."financial_transactions" enable row level security;

alter table "public"."hubs" enable row level security;

alter table "public"."milestone_completion_analytics" drop column "completion_date";

alter table "public"."milestone_completion_analytics" drop column "milestone_id";

alter table "public"."milestone_completion_analytics" add column "business_stage" text;

alter table "public"."milestone_completion_analytics" add column "completed_at" timestamp with time zone;

alter table "public"."milestone_completion_analytics" add column "created_at" timestamp with time zone not null default now();

alter table "public"."milestone_completion_analytics" add column "days_to_complete" integer;

alter table "public"."milestone_completion_analytics" add column "milestone_category" text;

alter table "public"."milestone_completion_analytics" add column "milestone_title" text not null;

alter table "public"."milestone_completion_analytics" add column "status" text not null default 'planned'::text;

alter table "public"."milestone_completion_analytics" add column "target_date" date;

alter table "public"."milestone_completion_analytics" alter column "user_id" set not null;

alter table "public"."milestone_completion_analytics" enable row level security;

alter table "public"."profiles" add column "business_type" text;

alter table "public"."profiles" add column "contact_person_name" text;

alter table "public"."profiles" add column "contact_person_title" text;

alter table "public"."profiles" add column "contact_phone" text;

alter table "public"."profiles" add column "first_name" text;

alter table "public"."profiles" add column "industry" text;

alter table "public"."profiles" add column "last_name" text;

alter table "public"."profiles" add column "logo_url" text;

alter table "public"."profiles" add column "organization_id" uuid;

alter table "public"."profiles" add column "profile_picture_url" text;

alter table "public"."profiles" add column "website" text;

alter table "public"."profiles" alter column "account_type" set default 'business'::text;

alter table "public"."profiles" alter column "country" set default 'KE'::text;

alter table "public"."profiles" alter column "created_at" set not null;

alter table "public"."profiles" alter column "is_profile_complete" set default false;

alter table "public"."profiles" alter column "updated_at" set not null;

alter table "public"."role_change_audit" drop column "actor_id";

alter table "public"."role_change_audit" drop column "created_at";

alter table "public"."role_change_audit" drop column "metadata";

alter table "public"."role_change_audit" drop column "reason";

alter table "public"."role_change_audit" drop column "user_id";

alter table "public"."role_change_audit" add column "action_type" text not null;

alter table "public"."role_change_audit" add column "changed_by_user_id" uuid not null;

alter table "public"."role_change_audit" add column "ip_address" inet;

alter table "public"."role_change_audit" add column "target_user_id" uuid not null;

alter table "public"."role_change_audit" add column "timestamp" timestamp with time zone not null default now();

alter table "public"."role_change_audit" add column "user_agent" text;

alter table "public"."role_change_audit" enable row level security;

alter table "public"."user_roles" alter column "role" set default 'entrepreneur'::user_role;

CREATE UNIQUE INDEX app_settings_pkey ON public.app_settings USING btree (key);

CREATE UNIQUE INDEX approval_audit_pkey ON public.approval_audit USING btree (id);

CREATE UNIQUE INDEX business_progress_stages_pkey ON public.business_progress_stages USING btree (id);

CREATE UNIQUE INDEX business_survival_records_pkey ON public.business_survival_records USING btree (id);

CREATE UNIQUE INDEX finance_access_records_pkey ON public.finance_access_records USING btree (id);

CREATE UNIQUE INDEX geographic_analytics_country_code_key ON public.geographic_analytics USING btree (country_code);

CREATE UNIQUE INDEX geographic_analytics_pkey ON public.geographic_analytics USING btree (id);

CREATE INDEX idx_business_progress_stages_stage ON public.business_progress_stages USING btree (stage_name);

CREATE INDEX idx_business_progress_stages_user_id ON public.business_progress_stages USING btree (user_id);

CREATE INDEX idx_geographic_analytics_country ON public.geographic_analytics USING btree (country_code);

CREATE INDEX idx_invite_codes_code ON public.invite_codes USING btree (code);

CREATE INDEX idx_invite_codes_email ON public.invite_codes USING btree (invited_email);

CREATE INDEX idx_milestone_completion_analytics_business ON public.milestone_completion_analytics USING btree (business_id);

CREATE INDEX idx_milestone_completion_analytics_user_id ON public.milestone_completion_analytics USING btree (user_id);

CREATE INDEX idx_milestones_description ON public.milestones USING gin (to_tsvector('english'::regconfig, COALESCE(description, ''::text)));

CREATE INDEX idx_milestones_strategy_id ON public.milestones USING btree (strategy_id);

CREATE INDEX idx_template_usage_analytics_template ON public.template_usage_analytics USING btree (template_id);

CREATE INDEX idx_template_usage_analytics_user_id ON public.template_usage_analytics USING btree (user_id);

CREATE INDEX idx_user_activities_country ON public.user_activities USING btree (country_code);

CREATE INDEX idx_user_activities_type_date ON public.user_activities USING btree (activity_type, created_at);

CREATE INDEX idx_user_activities_user_id ON public.user_activities USING btree (user_id);

CREATE INDEX idx_user_journey_analytics_session ON public.user_journey_analytics USING btree (session_id);

CREATE INDEX idx_user_journey_analytics_user_id ON public.user_journey_analytics USING btree (user_id);

CREATE UNIQUE INDEX invite_codes_code_key ON public.invite_codes USING btree (code);

CREATE INDEX invite_codes_deleted_at_idx ON public.invite_codes USING btree (deleted_at);

CREATE INDEX invite_codes_hub_id_idx ON public.invite_codes USING btree (hub_id);

CREATE UNIQUE INDEX invite_codes_pkey ON public.invite_codes USING btree (id);

CREATE UNIQUE INDEX job_creation_records_pkey ON public.job_creation_records USING btree (id);

CREATE UNIQUE INDEX loan_readiness_assessments_pkey ON public.loan_readiness_assessments USING btree (id);

CREATE UNIQUE INDEX milestones_pkey ON public.milestones USING btree (id);

CREATE UNIQUE INDEX pending_approvals_pkey ON public.pending_approvals USING btree (id);

CREATE UNIQUE INDEX settings_audit_pkey ON public.settings_audit USING btree (id);

CREATE INDEX strategies_business_id_idx ON public.strategies USING btree (business_id);

CREATE UNIQUE INDEX strategies_pkey ON public.strategies USING btree (id);

CREATE UNIQUE INDEX template_usage_analytics_pkey ON public.template_usage_analytics USING btree (id);

CREATE UNIQUE INDEX unique_business_strategy ON public.strategies USING btree (business_id);

CREATE UNIQUE INDEX user_activities_pkey ON public.user_activities USING btree (id);

CREATE UNIQUE INDEX user_journey_analytics_pkey ON public.user_journey_analytics USING btree (id);

alter table "public"."app_settings" add constraint "app_settings_pkey" PRIMARY KEY using index "app_settings_pkey";

alter table "public"."approval_audit" add constraint "approval_audit_pkey" PRIMARY KEY using index "approval_audit_pkey";

alter table "public"."business_progress_stages" add constraint "business_progress_stages_pkey" PRIMARY KEY using index "business_progress_stages_pkey";

alter table "public"."business_survival_records" add constraint "business_survival_records_pkey" PRIMARY KEY using index "business_survival_records_pkey";

alter table "public"."finance_access_records" add constraint "finance_access_records_pkey" PRIMARY KEY using index "finance_access_records_pkey";

alter table "public"."geographic_analytics" add constraint "geographic_analytics_pkey" PRIMARY KEY using index "geographic_analytics_pkey";

alter table "public"."invite_codes" add constraint "invite_codes_pkey" PRIMARY KEY using index "invite_codes_pkey";

alter table "public"."job_creation_records" add constraint "job_creation_records_pkey" PRIMARY KEY using index "job_creation_records_pkey";

alter table "public"."loan_readiness_assessments" add constraint "loan_readiness_assessments_pkey" PRIMARY KEY using index "loan_readiness_assessments_pkey";

alter table "public"."milestones" add constraint "milestones_pkey" PRIMARY KEY using index "milestones_pkey";

alter table "public"."pending_approvals" add constraint "pending_approvals_pkey" PRIMARY KEY using index "pending_approvals_pkey";

alter table "public"."settings_audit" add constraint "settings_audit_pkey" PRIMARY KEY using index "settings_audit_pkey";

alter table "public"."strategies" add constraint "strategies_pkey" PRIMARY KEY using index "strategies_pkey";

alter table "public"."template_usage_analytics" add constraint "template_usage_analytics_pkey" PRIMARY KEY using index "template_usage_analytics_pkey";

alter table "public"."user_activities" add constraint "user_activities_pkey" PRIMARY KEY using index "user_activities_pkey";

alter table "public"."user_journey_analytics" add constraint "user_journey_analytics_pkey" PRIMARY KEY using index "user_journey_analytics_pkey";

alter table "public"."approval_audit" add constraint "approval_audit_approval_id_fkey" FOREIGN KEY (approval_id) REFERENCES pending_approvals(id) ON DELETE CASCADE not valid;

alter table "public"."approval_audit" validate constraint "approval_audit_approval_id_fkey";

alter table "public"."approval_audit" add constraint "approval_audit_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES auth.users(id) not valid;

alter table "public"."approval_audit" validate constraint "approval_audit_performed_by_fkey";

alter table "public"."business_survival_records" add constraint "business_survival_records_survival_risk_score_check" CHECK (((survival_risk_score >= 0) AND (survival_risk_score <= 100))) not valid;

alter table "public"."business_survival_records" validate constraint "business_survival_records_survival_risk_score_check";

alter table "public"."financial_transactions" add constraint "financial_transactions_amount_check" CHECK ((amount > (0)::numeric)) not valid;

alter table "public"."financial_transactions" validate constraint "financial_transactions_amount_check";

alter table "public"."geographic_analytics" add constraint "geographic_analytics_country_code_key" UNIQUE using index "geographic_analytics_country_code_key";

alter table "public"."invite_codes" add constraint "invite_codes_account_type_check" CHECK ((account_type = ANY (ARRAY['business'::text, 'organization'::text]))) not valid;

alter table "public"."invite_codes" validate constraint "invite_codes_account_type_check";

alter table "public"."invite_codes" add constraint "invite_codes_code_key" UNIQUE using index "invite_codes_code_key";

alter table "public"."invite_codes" add constraint "invite_codes_deleted_by_fkey" FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL not valid;

alter table "public"."invite_codes" validate constraint "invite_codes_deleted_by_fkey";

alter table "public"."invite_codes" add constraint "invite_codes_hub_id_fkey" FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE SET NULL not valid;

alter table "public"."invite_codes" validate constraint "invite_codes_hub_id_fkey";

alter table "public"."job_creation_records" add constraint "job_creation_records_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE not valid;

alter table "public"."job_creation_records" validate constraint "job_creation_records_business_id_fkey";

alter table "public"."loan_readiness_assessments" add constraint "loan_readiness_assessments_business_plan_score_check" CHECK (((business_plan_score >= 0) AND (business_plan_score <= 100))) not valid;

alter table "public"."loan_readiness_assessments" validate constraint "loan_readiness_assessments_business_plan_score_check";

alter table "public"."loan_readiness_assessments" add constraint "loan_readiness_assessments_cash_flow_score_check" CHECK (((cash_flow_score >= 0) AND (cash_flow_score <= 100))) not valid;

alter table "public"."loan_readiness_assessments" validate constraint "loan_readiness_assessments_cash_flow_score_check";

alter table "public"."loan_readiness_assessments" add constraint "loan_readiness_assessments_credit_score_check" CHECK (((credit_score >= 300) AND (credit_score <= 850))) not valid;

alter table "public"."loan_readiness_assessments" validate constraint "loan_readiness_assessments_credit_score_check";

alter table "public"."loan_readiness_assessments" add constraint "loan_readiness_assessments_financial_documentation_score_check" CHECK (((financial_documentation_score >= 0) AND (financial_documentation_score <= 100))) not valid;

alter table "public"."loan_readiness_assessments" validate constraint "loan_readiness_assessments_financial_documentation_score_check";

alter table "public"."loan_readiness_assessments" add constraint "loan_readiness_assessments_overall_readiness_score_check" CHECK (((overall_readiness_score >= 0) AND (overall_readiness_score <= 100))) not valid;

alter table "public"."loan_readiness_assessments" validate constraint "loan_readiness_assessments_overall_readiness_score_check";

alter table "public"."loan_readiness_assessments" add constraint "loan_readiness_assessments_readiness_level_check" CHECK ((readiness_level = ANY (ARRAY['not_ready'::text, 'partially_ready'::text, 'loan_ready'::text, 'highly_qualified'::text]))) not valid;

alter table "public"."loan_readiness_assessments" validate constraint "loan_readiness_assessments_readiness_level_check";

alter table "public"."loan_readiness_assessments" add constraint "loan_readiness_assessments_revenue_stability_score_check" CHECK (((revenue_stability_score >= 0) AND (revenue_stability_score <= 100))) not valid;

alter table "public"."loan_readiness_assessments" validate constraint "loan_readiness_assessments_revenue_stability_score_check";

alter table "public"."milestones" add constraint "fk_milestones_strategy_id_strategy_id_cascade" FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE not valid;

alter table "public"."milestones" validate constraint "fk_milestones_strategy_id_strategy_id_cascade";

alter table "public"."milestones" add constraint "milestones_business_stage_check" CHECK ((business_stage = ANY (ARRAY['ideation'::text, 'early'::text, 'growth'::text]))) not valid;

alter table "public"."milestones" validate constraint "milestones_business_stage_check";

alter table "public"."milestones" add constraint "milestones_status_check" CHECK ((status = ANY (ARRAY['not-started'::text, 'in-progress'::text, 'complete'::text, 'overdue'::text]))) not valid;

alter table "public"."milestones" validate constraint "milestones_status_check";

alter table "public"."milestones" add constraint "milestones_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."milestones" validate constraint "milestones_user_id_fkey";

alter table "public"."pending_approvals" add constraint "pending_approvals_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id) not valid;

alter table "public"."pending_approvals" validate constraint "pending_approvals_approved_by_fkey";

alter table "public"."pending_approvals" add constraint "pending_approvals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."pending_approvals" validate constraint "pending_approvals_user_id_fkey";

alter table "public"."role_change_audit" add constraint "role_change_audit_action_type_check" CHECK ((action_type = ANY (ARRAY['add'::text, 'remove'::text]))) not valid;

alter table "public"."role_change_audit" validate constraint "role_change_audit_action_type_check";

alter table "public"."settings_audit" add constraint "settings_audit_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES auth.users(id) not valid;

alter table "public"."settings_audit" validate constraint "settings_audit_changed_by_fkey";

alter table "public"."strategies" add constraint "strategies_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE not valid;

alter table "public"."strategies" validate constraint "strategies_business_id_fkey";

alter table "public"."strategies" add constraint "strategies_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."strategies" validate constraint "strategies_user_id_fkey";

alter table "public"."strategies" add constraint "unique_business_strategy" UNIQUE using index "unique_business_strategy";

alter table "public"."profiles" add constraint "profiles_hub_id_fkey" FOREIGN KEY (hub_id) REFERENCES hubs(id) not valid;

alter table "public"."profiles" validate constraint "profiles_hub_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.analyze_drop_off_points()
 RETURNS TABLE(page_path text, total_entries bigint, total_exits bigint, drop_off_rate numeric, avg_time_on_page numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH page_entries AS (
    SELECT page_path, COUNT(*) as entries
    FROM public.user_journey_analytics 
    WHERE action_type = 'page_view'
    GROUP BY page_path
  ),
  page_exits AS (
    SELECT page_path, COUNT(*) as exits
    FROM public.user_journey_analytics 
    WHERE action_type = 'exit'
    GROUP BY page_path
  ),
  page_times AS (
    SELECT 
      page_path,
      AVG(
        CASE 
          WHEN action_data->>'time_on_page' IS NOT NULL 
          THEN (action_data->>'time_on_page')::numeric 
          ELSE NULL 
        END
      ) as avg_time
    FROM public.user_journey_analytics 
    WHERE action_type = 'exit'
    GROUP BY page_path
  )
  SELECT 
    pe.page_path,
    pe.entries as total_entries,
    COALESCE(px.exits, 0) as total_exits,
    ROUND(
      (COALESCE(px.exits, 0)::numeric / pe.entries::numeric) * 100, 2
    ) as drop_off_rate,
    ROUND(COALESCE(pt.avg_time, 0), 2) as avg_time_on_page
  FROM page_entries pe
  LEFT JOIN page_exits px ON pe.page_path = px.page_path
  LEFT JOIN page_times pt ON pe.page_path = pt.page_path
  ORDER BY drop_off_rate DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_pending_org(approval_id uuid, requester_ip inet DEFAULT NULL::inet, requester_user_agent text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  target_user_id uuid;
  approval_record public.pending_approvals;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user is super admin
  IF NOT public.is_super_admin(current_user_id) THEN
    RAISE EXCEPTION 'Access denied: only super admins can approve organizations';
  END IF;
  
  -- Get the approval record
  SELECT * INTO approval_record
  FROM public.pending_approvals
  WHERE id = approval_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request not found or already processed';
  END IF;
  
  target_user_id := approval_record.user_id;
  
  -- Update approval status
  UPDATE public.pending_approvals
  SET
    status = 'approved',
    approved_by = current_user_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = approval_id;
  
  -- Assign hub_manager role to the user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'hub_manager')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Create audit record
  INSERT INTO public.approval_audit (
    approval_id,
    action,
    performed_by,
    requester_ip,
    requester_user_agent
  ) VALUES (
    approval_id,
    'approved',
    current_user_id,
    requester_ip,
    requester_user_agent
  );
  
  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_stage_completion_rates()
 RETURNS TABLE(stage_name text, total_starts bigint, total_completions bigint, completion_rate numeric, avg_time_to_complete numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    bps.stage_name,
    COUNT(*) as total_starts,
    COUNT(bps.completed_at) as total_completions,
    ROUND(
      (COUNT(bps.completed_at)::numeric / COUNT(*)::numeric) * 100, 2
    ) as completion_rate,
    ROUND(
      AVG(
        CASE 
          WHEN bps.completed_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (bps.completed_at - bps.started_at)) / 60.0 
          ELSE NULL 
        END
      ), 2
    ) as avg_time_to_complete
  FROM public.business_progress_stages bps
  GROUP BY bps.stage_name
  ORDER BY total_starts DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_strategy_financials(p_strategy_id uuid)
 RETURNS TABLE(id uuid, strategy_id uuid, record_date date, amount numeric, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        fr.id,
        fr.strategy_id,
        fr.record_date,
        fr.amount,
        fr.created_at,
        fr.updated_at
    FROM 
        public.financial_records fr
    WHERE 
        fr.strategy_id = p_strategy_id
    ORDER BY 
        fr.record_date DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert profile with better error handling
  BEGIN
    INSERT INTO public.profiles (
      id, 
      email, 
      full_name, 
      account_type,
      is_profile_complete
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'account_type', 'business'),
      false
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
  END;
  
  -- Insert user role with security bypass
  BEGIN
    -- Bypass the security trigger by setting application_name
    SET application_name = 'secure_role_function';
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
      NEW.id,
      CASE 
        WHEN COALESCE(NEW.raw_user_meta_data ->> 'account_type', 'business') = 'organization' 
        THEN 'hub_manager'::user_role
        ELSE 'entrepreneur'::user_role
      END
    );
    
    -- Reset application_name
    RESET application_name;
  EXCEPTION
    WHEN OTHERS THEN
      -- Reset application_name even if there's an error
      RESET application_name;
      RAISE WARNING 'Role creation failed for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_org_signup(user_id uuid, user_email text, full_name text, invite_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  auto_approve boolean DEFAULT FALSE;
  approval_id uuid;
  result jsonb;
BEGIN
  -- Check auto-approve setting
  SELECT (value = 'true' OR value = '1') INTO auto_approve
  FROM public.app_settings
  WHERE key = 'auto_approve_organizations';
  
  -- Default to false if setting doesn't exist
  auto_approve := COALESCE(auto_approve, FALSE);
  
  -- Create user profile
  INSERT INTO public.profiles (id, email, full_name, account_type, is_profile_complete)
  VALUES (user_id, user_email, full_name, 'organization', FALSE)
  ON CONFLICT (id) DO UPDATE SET
    email = user_email,
    full_name = full_name,
    account_type = 'organization',
    updated_at = now();
  
  IF auto_approve THEN
    -- Auto-approve: assign hub_manager role immediately
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_id, 'hub_manager')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    result := jsonb_build_object(
      'status', 'approved',
      'message', 'Organization account approved automatically'
    );
  ELSE
    -- Manual approval: create pending approval record
    INSERT INTO public.pending_approvals (
      user_id,
      user_email,
      full_name,
      invite_code,
      payload,
      status
    ) VALUES (
      user_id,
      user_email,
      full_name,
      invite_code,
      jsonb_build_object(
        'signup_time', now(),
        'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent'
      ),
      'pending'
    )
    RETURNING id INTO approval_id;
    
    -- Create audit record
    INSERT INTO public.approval_audit (
      approval_id,
      action,
      performed_by
    ) VALUES (
      approval_id,
      'created',
      user_id
    );
    
    result := jsonb_build_object(
      'status', 'pending',
      'message', 'Organization account pending approval by super admin',
      'approval_id', approval_id
    );
  END IF;
  
  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin_or_hub_manager(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin', 'hub_manager')
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(user_id, 'super_admin');
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_direct_role_manipulation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Allow the secure functions to operate
  IF current_setting('application_name', true) = 'secure_role_function' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Block direct INSERT/UPDATE/DELETE operations on user_roles
  RAISE EXCEPTION 'Direct manipulation of user_roles table is not allowed. Use add_user_role_with_audit() or remove_user_role_with_audit() functions.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_pending_org(approval_id uuid, rejection_reason text DEFAULT NULL::text, requester_ip inet DEFAULT NULL::inet, requester_user_agent text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user is super admin
  IF NOT public.is_super_admin(current_user_id) THEN
    RAISE EXCEPTION 'Access denied: only super admins can reject organizations';
  END IF;
  
  -- Update approval status
  UPDATE public.pending_approvals
  SET
    status = 'rejected',
    approved_by = current_user_id,
    approved_at = now(),
    rejection_reason = rejection_reason,
    updated_at = now()
  WHERE id = approval_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request not found or already processed';
  END IF;
  
  -- Create audit record
  INSERT INTO public.approval_audit (
    approval_id,
    action,
    performed_by,
    reason,
    requester_ip,
    requester_user_agent
  ) VALUES (
    approval_id,
    'rejected',
    current_user_id,
    rejection_reason,
    requester_ip,
    requester_user_agent
  );
  
  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_app_setting_with_audit(setting_key text, setting_value text, requester_ip inet DEFAULT NULL::inet, requester_user_agent text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  old_value text;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user is super admin
  IF NOT public.is_super_admin(current_user_id) THEN
    RAISE EXCEPTION 'Access denied: only super admins can modify settings';
  END IF;
  
  -- Get old value for audit
  SELECT value INTO old_value 
  FROM public.app_settings 
  WHERE key = setting_key;
  
  -- Upsert the setting
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES (setting_key, setting_value, now())
  ON CONFLICT (key)
  DO UPDATE SET
    value = setting_value,
    updated_at = now();
  
  -- Create audit record
  INSERT INTO public.settings_audit (
    setting_key,
    old_value,
    new_value,
    changed_by,
    requester_ip,
    requester_user_agent
  ) VALUES (
    setting_key,
    old_value,
    setting_value,
    current_user_id,
    requester_ip,
    requester_user_agent
  );
  
  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.setup_super_admin(admin_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Get the user ID for the provided email
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = admin_email;
    
    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', admin_email;
    END IF;
    
    -- Insert super_admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'super_admin'::user_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Also add admin role for broader permissions
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin'::user_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN admin_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_geographic_analytics()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO public.geographic_analytics (country_code, country_name, user_count, active_businesses)
  SELECT 
    COALESCE(ua.country_code, 'Unknown') as country_code,
    CASE 
      WHEN ua.country_code = 'KE' THEN 'Kenya'
      WHEN ua.country_code = 'TZ' THEN 'Tanzania'
      WHEN ua.country_code = 'UG' THEN 'Uganda'
      WHEN ua.country_code = 'RW' THEN 'Rwanda'
      WHEN ua.country_code = 'ET' THEN 'Ethiopia'
      WHEN ua.country_code = 'GH' THEN 'Ghana'
      WHEN ua.country_code = 'NG' THEN 'Nigeria'
      WHEN ua.country_code = 'ZA' THEN 'South Africa'
      WHEN ua.country_code = 'EG' THEN 'Egypt'
      WHEN ua.country_code = 'MA' THEN 'Morocco'
      ELSE 'Unknown'
    END as country_name,
    COUNT(DISTINCT ua.user_id) as user_count,
    COUNT(DISTINCT b.id) as active_businesses
  FROM public.user_activities ua
  LEFT JOIN public.businesses b ON b.user_id = ua.user_id AND b.is_active = true
  WHERE ua.activity_type = 'login'
  GROUP BY ua.country_code
  ON CONFLICT (country_code) 
  DO UPDATE SET 
    user_count = EXCLUDED.user_count,
    active_businesses = EXCLUDED.active_businesses,
    last_updated = now();
$function$
;

CREATE OR REPLACE FUNCTION public.add_user_role_with_audit(target_user_id uuid, new_role user_role, hub_id uuid DEFAULT NULL::uuid, requester_ip inet DEFAULT NULL::inet, requester_user_agent text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DECLARE
    current_user_id uuid;
  BEGIN
    current_user_id := auth.uid();

    -- Super admins can always assign roles
    IF public.is_super_admin(current_user_id) THEN
      NULL; -- allowed
    ELSE
      -- For non-super-admins we only allow assigning hub-scoped roles when hub_id is provided
      IF hub_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: only super admins can assign global roles';
      END IF;

      -- Ensure requester has admin/hub_manager role for this hub
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = current_user_id
          AND ur.hub_id = hub_id
          AND ur.role IN ('admin','hub_manager')
      ) THEN
        RAISE EXCEPTION 'Access denied: not authorized for this hub';
      END IF;
    END IF;

    INSERT INTO public.user_roles (user_id, role, hub_id, assigned_by)
    VALUES (target_user_id, new_role, hub_id, current_user_id)
    ON CONFLICT (user_id, role, hub_id) DO NOTHING;

    RETURN FOUND;
  END;
  $function$
;

CREATE OR REPLACE FUNCTION public.add_user_role_with_audit(target_user_id uuid, new_role user_role, requester_ip inet DEFAULT NULL::inet, requester_user_agent text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user is super admin
  IF NOT public.is_super_admin(current_user_id) THEN
    RAISE EXCEPTION 'Access denied: only super admins can assign roles';
  END IF;
  
  -- Insert role (will be ignored if already exists due to UNIQUE constraint)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, new_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Return whether a new role was actually added
  RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_or_update_strategy_with_business(p_strategy_data jsonb, p_business_data jsonb DEFAULT NULL::jsonb, p_milestones_data jsonb[] DEFAULT '{}'::jsonb[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_business_id uuid;
  v_strategy_id uuid;
  v_milestone jsonb;
  v_result jsonb;
  v_milestones jsonb[] := '{}';
BEGIN
  -- Basic handling: prefer explicit business_id in strategy, then business data, else create a minimal business
  IF p_strategy_data->>'business_id' IS NOT NULL AND p_strategy_data->>'business_id' != '' THEN
    v_business_id := (p_strategy_data->>'business_id')::uuid;
  END IF;

  IF p_business_data IS NOT NULL THEN
    IF p_business_data->>'id' IS NOT NULL AND p_business_data->>'id' != '' THEN
      v_business_id := (p_business_data->>'id')::uuid;
      UPDATE public.businesses
      SET
        name = COALESCE(p_business_data->>'name', name),
        business_type = COALESCE(p_business_data->>'business_type', business_type),
        stage = COALESCE((p_business_data->>'stage')::public.business_stage, stage),
        description = COALESCE(p_business_data->>'description', description),
        registration_number = COALESCE(p_business_data->>'registration_number', registration_number),
        registration_certificate_url = COALESCE(p_business_data->>'registration_certificate_url', registration_certificate_url),
        updated_at = now()
      WHERE id = v_business_id
      RETURNING id INTO v_business_id;
    ELSE
      IF v_business_id IS NOT NULL THEN
        UPDATE public.businesses
        SET
          name = COALESCE(p_business_data->>'name', name),
          business_type = COALESCE(p_business_data->>'business_type', business_type),
          stage = COALESCE((p_business_data->>'stage')::public.business_stage, stage),
          description = COALESCE(p_business_data->>'description', description),
          registration_number = COALESCE(p_business_data->>'registration_number', registration_number),
          registration_certificate_url = COALESCE(p_business_data->>'registration_certificate_url', registration_certificate_url),
          updated_at = now()
        WHERE id = v_business_id
        RETURNING id INTO v_business_id;
      ELSE
        INSERT INTO public.businesses (
          user_id,
          hub_id,
          name,
          business_type,
          stage,
          description,
          registration_number,
          registration_certificate_url,
          is_active
        ) VALUES (
          (p_business_data->>'user_id')::uuid,
          NULLIF(p_business_data->>'hub_id', '')::uuid,
          p_business_data->>'name',
          p_business_data->>'business_type',
          COALESCE((p_business_data->>'stage')::public.business_stage, 'idea'::public.business_stage),
          p_business_data->>'description',
          p_business_data->>'registration_number',
          p_business_data->>'registration_certificate_url',
          COALESCE((p_business_data->>'is_active')::boolean, true)
        )
        RETURNING id INTO v_business_id;
      END IF;
    END IF;

    IF v_business_id IS NOT NULL THEN
      p_strategy_data := jsonb_set(p_strategy_data, '{business_id}', to_jsonb(v_business_id::text));
    END IF;
  END IF;

  -- If still no business_id, create a minimal business when creating a new strategy
  IF (p_strategy_data->>'id' IS NULL OR p_strategy_data->>'id' = '') AND (v_business_id IS NULL) THEN
    INSERT INTO public.businesses (
      user_id,
      name,
      is_active
    ) VALUES (
      (p_strategy_data->>'user_id')::uuid,
      COALESCE(p_strategy_data->>'business_name', 'My Business'),
      true
    ) RETURNING id INTO v_business_id;

    p_strategy_data := jsonb_set(p_strategy_data, '{business_id}', to_jsonb(v_business_id::text));
  END IF;

  -- Create or update strategy: only reference existing strategy columns
  IF p_strategy_data->>'id' IS NOT NULL AND p_strategy_data->>'id' != '' THEN
    UPDATE public.strategies
    SET
      business_id = COALESCE(NULLIF((p_strategy_data->>'business_id'), '')::uuid, business_id),
      business_name = COALESCE(p_strategy_data->>'business_name', business_name),
      vision = COALESCE(p_strategy_data->>'vision', vision),
      mission = COALESCE(p_strategy_data->>'mission', mission),
      target_market = COALESCE(p_strategy_data->>'target_market', target_market),
      revenue_model = COALESCE(p_strategy_data->>'revenue_model', revenue_model),
      value_proposition = COALESCE(p_strategy_data->>'value_proposition', value_proposition),
      key_partners = COALESCE(p_strategy_data->>'key_partners', key_partners),
      marketing_approach = COALESCE(p_strategy_data->>'marketing_approach', marketing_approach),
      operational_needs = COALESCE(p_strategy_data->>'operational_needs', operational_needs),
      growth_goals = COALESCE(p_strategy_data->>'growth_goals', growth_goals),
      updated_at = now()
    WHERE id = (p_strategy_data->>'id')::uuid
    RETURNING id INTO v_strategy_id;
  ELSE
    INSERT INTO public.strategies (
      user_id,
      business_id,
      business_name,
      vision,
      mission,
      target_market,
      revenue_model,
      value_proposition,
      key_partners,
      marketing_approach,
      operational_needs,
      growth_goals
    ) VALUES (
      (p_strategy_data->>'user_id')::uuid,
      NULLIF((p_strategy_data->>'business_id'), '')::uuid,
      p_strategy_data->>'business_name',
      p_strategy_data->>'vision',
      p_strategy_data->>'mission',
      p_strategy_data->>'target_market',
      p_strategy_data->>'revenue_model',
      p_strategy_data->>'value_proposition',
      p_strategy_data->>'key_partners',
      p_strategy_data->>'marketing_approach',
      p_strategy_data->>'operational_needs',
      p_strategy_data->>'growth_goals'
    )
    RETURNING id INTO v_strategy_id;
  END IF;

  -- Remove existing milestones and (re)create if provided
  DELETE FROM public.milestones WHERE strategy_id = v_strategy_id;

  IF p_milestones_data IS NOT NULL AND array_length(p_milestones_data, 1) > 0 THEN
    FOREACH v_milestone IN ARRAY p_milestones_data LOOP
      INSERT INTO public.milestones (
        strategy_id,
        business_id,
        title,
        description,
        status,
        target_date,
        milestone_type,
        completed_at
      ) VALUES (
        v_strategy_id,
        COALESCE(NULLIF((v_milestone->>'business_id'), '')::uuid, NULLIF((p_strategy_data->>'business_id'), '')::uuid),
        v_milestone->>'title',
        v_milestone->>'description',
        COALESCE((v_milestone->>'status')::public.milestone_status, 'pending'::public.milestone_status),
        NULLIF(v_milestone->>'target_date', '')::timestamptz,
        COALESCE((v_milestone->>'milestone_type')::public.milestone_type, 'other'::public.milestone_type),
        CASE WHEN v_milestone->>'completed_at' IS NOT NULL AND v_milestone->>'completed_at' != '' THEN (v_milestone->>'completed_at')::timestamptz ELSE NULL END
      )
      RETURNING to_jsonb(milestones.*) INTO v_milestone;

      v_milestones := array_append(v_milestones, v_milestone);
    END LOOP;
  END IF;

  -- Return the created/updated strategy with its business and milestones
  SELECT jsonb_build_object(
    'strategy', to_jsonb(s) || jsonb_build_object(
      'milestones', COALESCE((SELECT jsonb_agg(m.*) FROM public.milestones m WHERE m.strategy_id = s.id), '[]'::jsonb)
    ),
    'business', (SELECT to_jsonb(b.*) FROM public.businesses b WHERE b.id = s.business_id)
  ) INTO v_result
  FROM public.strategies s
  WHERE s.id = v_strategy_id;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error in create_or_update_strategy_with_business: %', SQLERRM;
END;
$function$
;

create or replace view "public"."financial_records_with_hub" as  SELECT fr.id,
    fr.business_id,
    fr.record_date,
    fr.amount,
    fr.metric_type,
    fr.notes,
    fr.created_at,
    fr.updated_at,
    b.hub_id
   FROM (financial_records fr
     LEFT JOIN businesses b ON ((fr.business_id = b.id)));


CREATE OR REPLACE FUNCTION public.remove_user_role_with_audit(target_user_id uuid, old_role user_role, hub_id uuid DEFAULT NULL::uuid, requester_ip inet DEFAULT NULL::inet, requester_user_agent text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DECLARE
    requester_id uuid;
  BEGIN
    requester_id := auth.uid();

    -- If hub_id is NULL, this is a global role removal; only super_admins may do that
    IF hub_id IS NULL THEN
      IF NOT public.is_super_admin(requester_id) THEN
        RAISE EXCEPTION 'Access denied: only super admins can remove global roles';
      END IF;
    ELSE
      -- If hub_id provided, allow removal if requester is super_admin or admin/hub_manager for that hub
      IF NOT public.is_super_admin(requester_id) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = requester_id
            AND ur.hub_id = hub_id
            AND ur.role IN ('admin','hub_manager')
        ) THEN
          RAISE EXCEPTION 'Access denied: not authorized to remove roles for this hub';
        END IF;
      END IF;
    END IF;

    DELETE FROM public.user_roles
    WHERE user_id = target_user_id
      AND role = old_role
      AND (hub_id IS NULL AND hub_id IS NULL OR hub_id = hub_id);

    RETURN true;
  END;
  $function$
;

CREATE OR REPLACE FUNCTION public.remove_user_role_with_audit(target_user_id uuid, old_role user_role, requester_ip inet DEFAULT NULL::inet, requester_user_agent text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  requester_id uuid;
  role_exists boolean;
BEGIN
  -- Get the requester's user ID
  requester_id := auth.uid();
  
  -- Check if requester has admin privileges
  IF NOT is_admin_or_hub_manager(requester_id) THEN
    RAISE EXCEPTION 'Insufficient privileges to remove user roles';
  END IF;
  
  -- Prevent removing super_admin role from yourself
  IF requester_id = target_user_id AND old_role = 'super_admin' THEN
    RAISE EXCEPTION 'Cannot remove super_admin role from yourself';
  END IF;
  
  -- Check if role exists
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE user_id = target_user_id AND role = old_role
  ) INTO role_exists;
  
  IF NOT role_exists THEN
    RETURN false; -- Role doesn't exist
  END IF;
  
  -- Log the change before removal
  INSERT INTO public.role_change_audit (
    changed_by_user_id, 
    target_user_id, 
    old_role, 
    action_type,
    ip_address,
    user_agent
  )
  VALUES (
    requester_id, 
    target_user_id, 
    old_role, 
    'remove',
    requester_ip,
    requester_user_agent
  );
  
  -- Remove the role (bypassing trigger)
  SET application_name = 'secure_role_function';
  DELETE FROM public.user_roles 
  WHERE user_id = target_user_id AND role = old_role;
  RESET application_name;
  
  RETURN true;
END;
$function$
;

grant delete on table "public"."app_settings" to "anon";

grant insert on table "public"."app_settings" to "anon";

grant references on table "public"."app_settings" to "anon";

grant select on table "public"."app_settings" to "anon";

grant trigger on table "public"."app_settings" to "anon";

grant truncate on table "public"."app_settings" to "anon";

grant update on table "public"."app_settings" to "anon";

grant delete on table "public"."app_settings" to "authenticated";

grant insert on table "public"."app_settings" to "authenticated";

grant references on table "public"."app_settings" to "authenticated";

grant select on table "public"."app_settings" to "authenticated";

grant trigger on table "public"."app_settings" to "authenticated";

grant truncate on table "public"."app_settings" to "authenticated";

grant update on table "public"."app_settings" to "authenticated";

grant delete on table "public"."app_settings" to "service_role";

grant insert on table "public"."app_settings" to "service_role";

grant references on table "public"."app_settings" to "service_role";

grant select on table "public"."app_settings" to "service_role";

grant trigger on table "public"."app_settings" to "service_role";

grant truncate on table "public"."app_settings" to "service_role";

grant update on table "public"."app_settings" to "service_role";

grant delete on table "public"."approval_audit" to "anon";

grant insert on table "public"."approval_audit" to "anon";

grant references on table "public"."approval_audit" to "anon";

grant select on table "public"."approval_audit" to "anon";

grant trigger on table "public"."approval_audit" to "anon";

grant truncate on table "public"."approval_audit" to "anon";

grant update on table "public"."approval_audit" to "anon";

grant delete on table "public"."approval_audit" to "authenticated";

grant insert on table "public"."approval_audit" to "authenticated";

grant references on table "public"."approval_audit" to "authenticated";

grant select on table "public"."approval_audit" to "authenticated";

grant trigger on table "public"."approval_audit" to "authenticated";

grant truncate on table "public"."approval_audit" to "authenticated";

grant update on table "public"."approval_audit" to "authenticated";

grant delete on table "public"."approval_audit" to "service_role";

grant insert on table "public"."approval_audit" to "service_role";

grant references on table "public"."approval_audit" to "service_role";

grant select on table "public"."approval_audit" to "service_role";

grant trigger on table "public"."approval_audit" to "service_role";

grant truncate on table "public"."approval_audit" to "service_role";

grant update on table "public"."approval_audit" to "service_role";

grant delete on table "public"."business_progress_stages" to "anon";

grant insert on table "public"."business_progress_stages" to "anon";

grant references on table "public"."business_progress_stages" to "anon";

grant select on table "public"."business_progress_stages" to "anon";

grant trigger on table "public"."business_progress_stages" to "anon";

grant truncate on table "public"."business_progress_stages" to "anon";

grant update on table "public"."business_progress_stages" to "anon";

grant delete on table "public"."business_progress_stages" to "authenticated";

grant insert on table "public"."business_progress_stages" to "authenticated";

grant references on table "public"."business_progress_stages" to "authenticated";

grant select on table "public"."business_progress_stages" to "authenticated";

grant trigger on table "public"."business_progress_stages" to "authenticated";

grant truncate on table "public"."business_progress_stages" to "authenticated";

grant update on table "public"."business_progress_stages" to "authenticated";

grant delete on table "public"."business_progress_stages" to "service_role";

grant insert on table "public"."business_progress_stages" to "service_role";

grant references on table "public"."business_progress_stages" to "service_role";

grant select on table "public"."business_progress_stages" to "service_role";

grant trigger on table "public"."business_progress_stages" to "service_role";

grant truncate on table "public"."business_progress_stages" to "service_role";

grant update on table "public"."business_progress_stages" to "service_role";

grant delete on table "public"."business_survival_records" to "anon";

grant insert on table "public"."business_survival_records" to "anon";

grant references on table "public"."business_survival_records" to "anon";

grant select on table "public"."business_survival_records" to "anon";

grant trigger on table "public"."business_survival_records" to "anon";

grant truncate on table "public"."business_survival_records" to "anon";

grant update on table "public"."business_survival_records" to "anon";

grant delete on table "public"."business_survival_records" to "authenticated";

grant insert on table "public"."business_survival_records" to "authenticated";

grant references on table "public"."business_survival_records" to "authenticated";

grant select on table "public"."business_survival_records" to "authenticated";

grant trigger on table "public"."business_survival_records" to "authenticated";

grant truncate on table "public"."business_survival_records" to "authenticated";

grant update on table "public"."business_survival_records" to "authenticated";

grant delete on table "public"."business_survival_records" to "service_role";

grant insert on table "public"."business_survival_records" to "service_role";

grant references on table "public"."business_survival_records" to "service_role";

grant select on table "public"."business_survival_records" to "service_role";

grant trigger on table "public"."business_survival_records" to "service_role";

grant truncate on table "public"."business_survival_records" to "service_role";

grant update on table "public"."business_survival_records" to "service_role";

grant delete on table "public"."finance_access_records" to "anon";

grant insert on table "public"."finance_access_records" to "anon";

grant references on table "public"."finance_access_records" to "anon";

grant select on table "public"."finance_access_records" to "anon";

grant trigger on table "public"."finance_access_records" to "anon";

grant truncate on table "public"."finance_access_records" to "anon";

grant update on table "public"."finance_access_records" to "anon";

grant delete on table "public"."finance_access_records" to "authenticated";

grant insert on table "public"."finance_access_records" to "authenticated";

grant references on table "public"."finance_access_records" to "authenticated";

grant select on table "public"."finance_access_records" to "authenticated";

grant trigger on table "public"."finance_access_records" to "authenticated";

grant truncate on table "public"."finance_access_records" to "authenticated";

grant update on table "public"."finance_access_records" to "authenticated";

grant delete on table "public"."finance_access_records" to "service_role";

grant insert on table "public"."finance_access_records" to "service_role";

grant references on table "public"."finance_access_records" to "service_role";

grant select on table "public"."finance_access_records" to "service_role";

grant trigger on table "public"."finance_access_records" to "service_role";

grant truncate on table "public"."finance_access_records" to "service_role";

grant update on table "public"."finance_access_records" to "service_role";

grant delete on table "public"."geographic_analytics" to "anon";

grant insert on table "public"."geographic_analytics" to "anon";

grant references on table "public"."geographic_analytics" to "anon";

grant select on table "public"."geographic_analytics" to "anon";

grant trigger on table "public"."geographic_analytics" to "anon";

grant truncate on table "public"."geographic_analytics" to "anon";

grant update on table "public"."geographic_analytics" to "anon";

grant delete on table "public"."geographic_analytics" to "authenticated";

grant insert on table "public"."geographic_analytics" to "authenticated";

grant references on table "public"."geographic_analytics" to "authenticated";

grant select on table "public"."geographic_analytics" to "authenticated";

grant trigger on table "public"."geographic_analytics" to "authenticated";

grant truncate on table "public"."geographic_analytics" to "authenticated";

grant update on table "public"."geographic_analytics" to "authenticated";

grant delete on table "public"."geographic_analytics" to "service_role";

grant insert on table "public"."geographic_analytics" to "service_role";

grant references on table "public"."geographic_analytics" to "service_role";

grant select on table "public"."geographic_analytics" to "service_role";

grant trigger on table "public"."geographic_analytics" to "service_role";

grant truncate on table "public"."geographic_analytics" to "service_role";

grant update on table "public"."geographic_analytics" to "service_role";

grant delete on table "public"."invite_codes" to "anon";

grant insert on table "public"."invite_codes" to "anon";

grant references on table "public"."invite_codes" to "anon";

grant select on table "public"."invite_codes" to "anon";

grant trigger on table "public"."invite_codes" to "anon";

grant truncate on table "public"."invite_codes" to "anon";

grant update on table "public"."invite_codes" to "anon";

grant delete on table "public"."invite_codes" to "authenticated";

grant insert on table "public"."invite_codes" to "authenticated";

grant references on table "public"."invite_codes" to "authenticated";

grant select on table "public"."invite_codes" to "authenticated";

grant trigger on table "public"."invite_codes" to "authenticated";

grant truncate on table "public"."invite_codes" to "authenticated";

grant update on table "public"."invite_codes" to "authenticated";

grant delete on table "public"."invite_codes" to "service_role";

grant insert on table "public"."invite_codes" to "service_role";

grant references on table "public"."invite_codes" to "service_role";

grant select on table "public"."invite_codes" to "service_role";

grant trigger on table "public"."invite_codes" to "service_role";

grant truncate on table "public"."invite_codes" to "service_role";

grant update on table "public"."invite_codes" to "service_role";

grant delete on table "public"."job_creation_records" to "anon";

grant insert on table "public"."job_creation_records" to "anon";

grant references on table "public"."job_creation_records" to "anon";

grant select on table "public"."job_creation_records" to "anon";

grant trigger on table "public"."job_creation_records" to "anon";

grant truncate on table "public"."job_creation_records" to "anon";

grant update on table "public"."job_creation_records" to "anon";

grant delete on table "public"."job_creation_records" to "authenticated";

grant insert on table "public"."job_creation_records" to "authenticated";

grant references on table "public"."job_creation_records" to "authenticated";

grant select on table "public"."job_creation_records" to "authenticated";

grant trigger on table "public"."job_creation_records" to "authenticated";

grant truncate on table "public"."job_creation_records" to "authenticated";

grant update on table "public"."job_creation_records" to "authenticated";

grant delete on table "public"."job_creation_records" to "service_role";

grant insert on table "public"."job_creation_records" to "service_role";

grant references on table "public"."job_creation_records" to "service_role";

grant select on table "public"."job_creation_records" to "service_role";

grant trigger on table "public"."job_creation_records" to "service_role";

grant truncate on table "public"."job_creation_records" to "service_role";

grant update on table "public"."job_creation_records" to "service_role";

grant delete on table "public"."loan_readiness_assessments" to "anon";

grant insert on table "public"."loan_readiness_assessments" to "anon";

grant references on table "public"."loan_readiness_assessments" to "anon";

grant select on table "public"."loan_readiness_assessments" to "anon";

grant trigger on table "public"."loan_readiness_assessments" to "anon";

grant truncate on table "public"."loan_readiness_assessments" to "anon";

grant update on table "public"."loan_readiness_assessments" to "anon";

grant delete on table "public"."loan_readiness_assessments" to "authenticated";

grant insert on table "public"."loan_readiness_assessments" to "authenticated";

grant references on table "public"."loan_readiness_assessments" to "authenticated";

grant select on table "public"."loan_readiness_assessments" to "authenticated";

grant trigger on table "public"."loan_readiness_assessments" to "authenticated";

grant truncate on table "public"."loan_readiness_assessments" to "authenticated";

grant update on table "public"."loan_readiness_assessments" to "authenticated";

grant delete on table "public"."loan_readiness_assessments" to "service_role";

grant insert on table "public"."loan_readiness_assessments" to "service_role";

grant references on table "public"."loan_readiness_assessments" to "service_role";

grant select on table "public"."loan_readiness_assessments" to "service_role";

grant trigger on table "public"."loan_readiness_assessments" to "service_role";

grant truncate on table "public"."loan_readiness_assessments" to "service_role";

grant update on table "public"."loan_readiness_assessments" to "service_role";

grant delete on table "public"."milestones" to "anon";

grant insert on table "public"."milestones" to "anon";

grant references on table "public"."milestones" to "anon";

grant select on table "public"."milestones" to "anon";

grant trigger on table "public"."milestones" to "anon";

grant truncate on table "public"."milestones" to "anon";

grant update on table "public"."milestones" to "anon";

grant delete on table "public"."milestones" to "authenticated";

grant insert on table "public"."milestones" to "authenticated";

grant references on table "public"."milestones" to "authenticated";

grant select on table "public"."milestones" to "authenticated";

grant trigger on table "public"."milestones" to "authenticated";

grant truncate on table "public"."milestones" to "authenticated";

grant update on table "public"."milestones" to "authenticated";

grant delete on table "public"."milestones" to "service_role";

grant insert on table "public"."milestones" to "service_role";

grant references on table "public"."milestones" to "service_role";

grant select on table "public"."milestones" to "service_role";

grant trigger on table "public"."milestones" to "service_role";

grant truncate on table "public"."milestones" to "service_role";

grant update on table "public"."milestones" to "service_role";

grant delete on table "public"."pending_approvals" to "anon";

grant insert on table "public"."pending_approvals" to "anon";

grant references on table "public"."pending_approvals" to "anon";

grant select on table "public"."pending_approvals" to "anon";

grant trigger on table "public"."pending_approvals" to "anon";

grant truncate on table "public"."pending_approvals" to "anon";

grant update on table "public"."pending_approvals" to "anon";

grant delete on table "public"."pending_approvals" to "authenticated";

grant insert on table "public"."pending_approvals" to "authenticated";

grant references on table "public"."pending_approvals" to "authenticated";

grant select on table "public"."pending_approvals" to "authenticated";

grant trigger on table "public"."pending_approvals" to "authenticated";

grant truncate on table "public"."pending_approvals" to "authenticated";

grant update on table "public"."pending_approvals" to "authenticated";

grant delete on table "public"."pending_approvals" to "service_role";

grant insert on table "public"."pending_approvals" to "service_role";

grant references on table "public"."pending_approvals" to "service_role";

grant select on table "public"."pending_approvals" to "service_role";

grant trigger on table "public"."pending_approvals" to "service_role";

grant truncate on table "public"."pending_approvals" to "service_role";

grant update on table "public"."pending_approvals" to "service_role";

grant delete on table "public"."settings_audit" to "anon";

grant insert on table "public"."settings_audit" to "anon";

grant references on table "public"."settings_audit" to "anon";

grant select on table "public"."settings_audit" to "anon";

grant trigger on table "public"."settings_audit" to "anon";

grant truncate on table "public"."settings_audit" to "anon";

grant update on table "public"."settings_audit" to "anon";

grant delete on table "public"."settings_audit" to "authenticated";

grant insert on table "public"."settings_audit" to "authenticated";

grant references on table "public"."settings_audit" to "authenticated";

grant select on table "public"."settings_audit" to "authenticated";

grant trigger on table "public"."settings_audit" to "authenticated";

grant truncate on table "public"."settings_audit" to "authenticated";

grant update on table "public"."settings_audit" to "authenticated";

grant delete on table "public"."settings_audit" to "service_role";

grant insert on table "public"."settings_audit" to "service_role";

grant references on table "public"."settings_audit" to "service_role";

grant select on table "public"."settings_audit" to "service_role";

grant trigger on table "public"."settings_audit" to "service_role";

grant truncate on table "public"."settings_audit" to "service_role";

grant update on table "public"."settings_audit" to "service_role";

grant delete on table "public"."strategies" to "anon";

grant insert on table "public"."strategies" to "anon";

grant references on table "public"."strategies" to "anon";

grant select on table "public"."strategies" to "anon";

grant trigger on table "public"."strategies" to "anon";

grant truncate on table "public"."strategies" to "anon";

grant update on table "public"."strategies" to "anon";

grant delete on table "public"."strategies" to "authenticated";

grant insert on table "public"."strategies" to "authenticated";

grant references on table "public"."strategies" to "authenticated";

grant select on table "public"."strategies" to "authenticated";

grant trigger on table "public"."strategies" to "authenticated";

grant truncate on table "public"."strategies" to "authenticated";

grant update on table "public"."strategies" to "authenticated";

grant delete on table "public"."strategies" to "service_role";

grant insert on table "public"."strategies" to "service_role";

grant references on table "public"."strategies" to "service_role";

grant select on table "public"."strategies" to "service_role";

grant trigger on table "public"."strategies" to "service_role";

grant truncate on table "public"."strategies" to "service_role";

grant update on table "public"."strategies" to "service_role";

grant delete on table "public"."template_usage_analytics" to "anon";

grant insert on table "public"."template_usage_analytics" to "anon";

grant references on table "public"."template_usage_analytics" to "anon";

grant select on table "public"."template_usage_analytics" to "anon";

grant trigger on table "public"."template_usage_analytics" to "anon";

grant truncate on table "public"."template_usage_analytics" to "anon";

grant update on table "public"."template_usage_analytics" to "anon";

grant delete on table "public"."template_usage_analytics" to "authenticated";

grant insert on table "public"."template_usage_analytics" to "authenticated";

grant references on table "public"."template_usage_analytics" to "authenticated";

grant select on table "public"."template_usage_analytics" to "authenticated";

grant trigger on table "public"."template_usage_analytics" to "authenticated";

grant truncate on table "public"."template_usage_analytics" to "authenticated";

grant update on table "public"."template_usage_analytics" to "authenticated";

grant delete on table "public"."template_usage_analytics" to "service_role";

grant insert on table "public"."template_usage_analytics" to "service_role";

grant references on table "public"."template_usage_analytics" to "service_role";

grant select on table "public"."template_usage_analytics" to "service_role";

grant trigger on table "public"."template_usage_analytics" to "service_role";

grant truncate on table "public"."template_usage_analytics" to "service_role";

grant update on table "public"."template_usage_analytics" to "service_role";

grant delete on table "public"."user_activities" to "anon";

grant insert on table "public"."user_activities" to "anon";

grant references on table "public"."user_activities" to "anon";

grant select on table "public"."user_activities" to "anon";

grant trigger on table "public"."user_activities" to "anon";

grant truncate on table "public"."user_activities" to "anon";

grant update on table "public"."user_activities" to "anon";

grant delete on table "public"."user_activities" to "authenticated";

grant insert on table "public"."user_activities" to "authenticated";

grant references on table "public"."user_activities" to "authenticated";

grant select on table "public"."user_activities" to "authenticated";

grant trigger on table "public"."user_activities" to "authenticated";

grant truncate on table "public"."user_activities" to "authenticated";

grant update on table "public"."user_activities" to "authenticated";

grant delete on table "public"."user_activities" to "service_role";

grant insert on table "public"."user_activities" to "service_role";

grant references on table "public"."user_activities" to "service_role";

grant select on table "public"."user_activities" to "service_role";

grant trigger on table "public"."user_activities" to "service_role";

grant truncate on table "public"."user_activities" to "service_role";

grant update on table "public"."user_activities" to "service_role";

grant delete on table "public"."user_journey_analytics" to "anon";

grant insert on table "public"."user_journey_analytics" to "anon";

grant references on table "public"."user_journey_analytics" to "anon";

grant select on table "public"."user_journey_analytics" to "anon";

grant trigger on table "public"."user_journey_analytics" to "anon";

grant truncate on table "public"."user_journey_analytics" to "anon";

grant update on table "public"."user_journey_analytics" to "anon";

grant delete on table "public"."user_journey_analytics" to "authenticated";

grant insert on table "public"."user_journey_analytics" to "authenticated";

grant references on table "public"."user_journey_analytics" to "authenticated";

grant select on table "public"."user_journey_analytics" to "authenticated";

grant trigger on table "public"."user_journey_analytics" to "authenticated";

grant truncate on table "public"."user_journey_analytics" to "authenticated";

grant update on table "public"."user_journey_analytics" to "authenticated";

grant delete on table "public"."user_journey_analytics" to "service_role";

grant insert on table "public"."user_journey_analytics" to "service_role";

grant references on table "public"."user_journey_analytics" to "service_role";

grant select on table "public"."user_journey_analytics" to "service_role";

grant trigger on table "public"."user_journey_analytics" to "service_role";

grant truncate on table "public"."user_journey_analytics" to "service_role";

grant update on table "public"."user_journey_analytics" to "service_role";

create policy "Admins can manage analytics summaries"
on "public"."analytics_summaries"
as permissive
for all
to public
using (is_admin_or_hub_manager(auth.uid()));


create policy "Admins can view analytics summaries"
on "public"."analytics_summaries"
as permissive
for select
to public
using (is_admin_or_hub_manager(auth.uid()));


create policy "Super admins can manage app settings"
on "public"."app_settings"
as permissive
for all
to authenticated
using (has_role(auth.uid(), 'super_admin'::user_role))
with check (has_role(auth.uid(), 'super_admin'::user_role));


create policy "Super admins can view approval audit logs"
on "public"."approval_audit"
as permissive
for select
to authenticated
using (has_role(auth.uid(), 'super_admin'::user_role));


create policy "System can insert progress stages"
on "public"."business_progress_stages"
as permissive
for insert
to public
with check ((user_id = auth.uid()));


create policy "Users can update their own progress stages"
on "public"."business_progress_stages"
as permissive
for update
to public
using (((user_id = auth.uid()) OR is_admin_or_hub_manager(auth.uid())));


create policy "Users can view their own progress stages"
on "public"."business_progress_stages"
as permissive
for select
to public
using (((user_id = auth.uid()) OR is_admin_or_hub_manager(auth.uid())));


create policy "Users can manage survival records for their businesses or hub b"
on "public"."business_survival_records"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = business_survival_records.business_id) AND ((b.user_id = auth.uid()) OR is_admin_or_hub_manager(auth.uid()) OR ((b.hub_id = get_current_hub_context()) AND is_admin_or_hub_manager(auth.uid())))))));


create policy "Users can create their own businesses"
on "public"."businesses"
as permissive
for insert
to authenticated
with check ((user_id = auth.uid()));


create policy "Users can manage finance access records for their businesses or"
on "public"."finance_access_records"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = finance_access_records.business_id) AND ((b.user_id = auth.uid()) OR is_admin_or_hub_manager(auth.uid()) OR ((b.hub_id = get_current_hub_context()) AND is_admin_or_hub_manager(auth.uid())))))));


create policy "Users can create their own transactions"
on "public"."financial_transactions"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Admins can manage geographic analytics"
on "public"."geographic_analytics"
as permissive
for all
to public
using (is_admin_or_hub_manager(auth.uid()));


create policy "Admins can view geographic analytics"
on "public"."geographic_analytics"
as permissive
for select
to public
using (is_admin_or_hub_manager(auth.uid()));


create policy "Admins and hub managers can view hubs"
on "public"."hubs"
as permissive
for select
to authenticated
using (is_admin_or_hub_manager(auth.uid()));


create policy "Admins can manage hubs"
on "public"."hubs"
as permissive
for all
to authenticated
using ((has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role)));


create policy "Organizations and super admins can create invite codes"
on "public"."invite_codes"
as permissive
for insert
to authenticated
with check (((created_by = auth.uid()) AND (is_admin_or_hub_manager(auth.uid()) OR ((account_type = 'business'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.account_type = 'organization'::text))))))));


create policy "Users can update invite codes they created"
on "public"."invite_codes"
as permissive
for update
to authenticated
using (((created_by = auth.uid()) OR is_admin_or_hub_manager(auth.uid())));


create policy "Users can view invite codes they created or used"
on "public"."invite_codes"
as permissive
for select
to authenticated
using (((created_by = auth.uid()) OR (used_by = auth.uid()) OR is_admin_or_hub_manager(auth.uid())));


create policy "Users can manage job records for their businesses or hub busine"
on "public"."job_creation_records"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = job_creation_records.business_id) AND ((b.user_id = auth.uid()) OR is_admin_or_hub_manager(auth.uid()) OR ((b.hub_id = get_current_hub_context()) AND is_admin_or_hub_manager(auth.uid())))))));


create policy "Users can manage loan assessments for their businesses or hub b"
on "public"."loan_readiness_assessments"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = loan_readiness_assessments.business_id) AND ((b.user_id = auth.uid()) OR is_admin_or_hub_manager(auth.uid()) OR ((b.hub_id = get_current_hub_context()) AND is_admin_or_hub_manager(auth.uid())))))));


create policy "Users can manage their own milestone analytics"
on "public"."milestone_completion_analytics"
as permissive
for all
to public
using (((user_id = auth.uid()) OR is_admin_or_hub_manager(auth.uid())));


create policy "Users can manage their own milestones"
on "public"."milestones"
as permissive
for all
to public
using ((user_id = auth.uid()));


create policy "Super admins can update pending approvals"
on "public"."pending_approvals"
as permissive
for update
to authenticated
using (has_role(auth.uid(), 'super_admin'::user_role));


create policy "Super admins can view all pending approvals"
on "public"."pending_approvals"
as permissive
for select
to authenticated
using (has_role(auth.uid(), 'super_admin'::user_role));


create policy "System can create pending approvals"
on "public"."pending_approvals"
as permissive
for insert
to authenticated
with check ((user_id = auth.uid()));


create policy "Users can view their own pending approvals"
on "public"."pending_approvals"
as permissive
for select
to authenticated
using ((user_id = auth.uid()));


create policy "Admins can view all profiles"
on "public"."profiles"
as permissive
for select
to authenticated
using (is_admin_or_hub_manager(auth.uid()));


create policy "Users can create their own profile"
on "public"."profiles"
as permissive
for insert
to authenticated
with check ((auth.uid() = id));


create policy "Admins can view role change audit"
on "public"."role_change_audit"
as permissive
for select
to public
using (is_admin_or_hub_manager(auth.uid()));


create policy "System can insert audit records"
on "public"."role_change_audit"
as permissive
for insert
to public
with check (((changed_by_user_id = auth.uid()) AND is_admin_or_hub_manager(auth.uid())));


create policy "Super admins can view audit logs"
on "public"."settings_audit"
as permissive
for select
to authenticated
using (has_role(auth.uid(), 'super_admin'::user_role));


create policy "Users can manage their own strategies"
on "public"."strategies"
as permissive
for all
to public
using ((user_id = auth.uid()));


create policy "System can insert template analytics"
on "public"."template_usage_analytics"
as permissive
for insert
to public
with check ((user_id = auth.uid()));


create policy "Users can update their own template analytics"
on "public"."template_usage_analytics"
as permissive
for update
to public
using (((user_id = auth.uid()) OR is_admin_or_hub_manager(auth.uid())));


create policy "Users can view their own template analytics"
on "public"."template_usage_analytics"
as permissive
for select
to public
using (((user_id = auth.uid()) OR is_admin_or_hub_manager(auth.uid())));


create policy "System can insert activities"
on "public"."user_activities"
as permissive
for insert
to authenticated
with check ((user_id = auth.uid()));


create policy "Users can view their own activities"
on "public"."user_activities"
as permissive
for select
to authenticated
using (((user_id = auth.uid()) OR is_admin_or_hub_manager(auth.uid())));


create policy "System can insert journey analytics"
on "public"."user_journey_analytics"
as permissive
for insert
to authenticated
with check ((user_id = auth.uid()));


create policy "Users can view their own journey analytics"
on "public"."user_journey_analytics"
as permissive
for select
to authenticated
using (((user_id = auth.uid()) OR is_admin_or_hub_manager(auth.uid())));


create policy "Admins can manage user roles"
on "public"."user_roles"
as permissive
for all
to authenticated
using ((has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role)));


create policy "Users can manage their own businesses"
on "public"."businesses"
as permissive
for all
to public
using (((auth.uid() = user_id) OR ((EXISTS ( SELECT 1
   FROM information_schema.columns c
  WHERE (((c.table_schema)::name = 'public'::name) AND ((c.table_name)::name = 'strategies'::name) AND ((c.column_name)::name = 'business_id'::name)))) AND (EXISTS ( SELECT 1
   FROM strategies s
  WHERE ((s.business_id = businesses.id) AND (s.user_id = auth.uid()))))) OR is_admin_or_hub_manager(auth.uid())))
with check (((auth.uid() = user_id) OR ((EXISTS ( SELECT 1
   FROM information_schema.columns c
  WHERE (((c.table_schema)::name = 'public'::name) AND ((c.table_name)::name = 'strategies'::name) AND ((c.column_name)::name = 'business_id'::name)))) AND (EXISTS ( SELECT 1
   FROM strategies s
  WHERE ((s.business_id = businesses.id) AND (s.user_id = auth.uid()))))) OR is_admin_or_hub_manager(auth.uid())));


create policy "Users can view their own businesses"
on "public"."businesses"
as permissive
for select
to public
using (((auth.uid() = user_id) OR ((EXISTS ( SELECT 1
   FROM information_schema.columns c
  WHERE (((c.table_schema)::name = 'public'::name) AND ((c.table_name)::name = 'strategies'::name) AND ((c.column_name)::name = 'business_id'::name)))) AND (EXISTS ( SELECT 1
   FROM strategies s
  WHERE ((s.business_id = businesses.id) AND (s.user_id = auth.uid()))))) OR is_admin_or_hub_manager(auth.uid())));


create policy "Users can delete their own transactions"
on "public"."financial_transactions"
as permissive
for delete
to public
using ((auth.uid() = ( SELECT strategies.user_id
   FROM strategies
  WHERE (strategies.id = financial_transactions.strategy_id))));


create policy "Users can insert their own transactions"
on "public"."financial_transactions"
as permissive
for insert
to public
with check ((auth.uid() = ( SELECT strategies.user_id
   FROM strategies
  WHERE (strategies.id = financial_transactions.strategy_id))));


create policy "Users can update their own transactions"
on "public"."financial_transactions"
as permissive
for update
to public
using ((auth.uid() = ( SELECT strategies.user_id
   FROM strategies
  WHERE (strategies.id = financial_transactions.strategy_id))))
with check ((auth.uid() = ( SELECT strategies.user_id
   FROM strategies
  WHERE (strategies.id = financial_transactions.strategy_id))));


create policy "Users can view their own transactions"
on "public"."financial_transactions"
as permissive
for select
to public
using ((auth.uid() = ( SELECT strategies.user_id
   FROM strategies
  WHERE (strategies.id = financial_transactions.strategy_id))));


CREATE TRIGGER update_analytics_summaries_updated_at BEFORE UPDATE ON public.analytics_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_survival_records_updated_at BEFORE UPDATE ON public.business_survival_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finance_access_records_updated_at BEFORE UPDATE ON public.finance_access_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_creation_records_updated_at BEFORE UPDATE ON public.job_creation_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loan_readiness_assessments_updated_at BEFORE UPDATE ON public.loan_readiness_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_milestone_completion_analytics_updated_at BEFORE UPDATE ON public.milestone_completion_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pending_approvals_updated_at BEFORE UPDATE ON public.pending_approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON public.strategies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER prevent_direct_role_changes BEFORE INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION prevent_direct_role_manipulation();
ALTER TABLE "public"."user_roles" DISABLE TRIGGER "prevent_direct_role_changes";


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();


  create policy "Users can delete their own profile images"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'profile-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can update their own profile images"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'profile-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can upload their own profile images"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'profile-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can view profile images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'profile-images'::text));



