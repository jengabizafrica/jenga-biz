export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      analytics_summaries: {
        Row: {
          additional_data: Json | null
          created_at: string
          id: string
          metric_date: string
          metric_type: string
          metric_value: number
          updated_at: string
        }
        Insert: {
          additional_data?: Json | null
          created_at?: string
          id?: string
          metric_date: string
          metric_type: string
          metric_value?: number
          updated_at?: string
        }
        Update: {
          additional_data?: Json | null
          created_at?: string
          id?: string
          metric_date?: string
          metric_type?: string
          metric_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string | null
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      approval_audit: {
        Row: {
          action: string
          approval_id: string
          created_at: string | null
          id: string
          performed_by: string | null
          reason: string | null
          requester_ip: unknown | null
          requester_user_agent: string | null
        }
        Insert: {
          action: string
          approval_id: string
          created_at?: string | null
          id?: string
          performed_by?: string | null
          reason?: string | null
          requester_ip?: unknown | null
          requester_user_agent?: string | null
        }
        Update: {
          action?: string
          approval_id?: string
          created_at?: string | null
          id?: string
          performed_by?: string | null
          reason?: string | null
          requester_ip?: unknown | null
          requester_user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_audit_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "pending_approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      business_progress_stages: {
        Row: {
          completed_at: string | null
          created_at: string
          form_fields_completed: number | null
          id: string
          stage_name: string
          started_at: string
          strategy_id: string | null
          time_spent_seconds: number | null
          total_form_fields: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          form_fields_completed?: number | null
          id?: string
          stage_name: string
          started_at?: string
          strategy_id?: string | null
          time_spent_seconds?: number | null
          total_form_fields?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          form_fields_completed?: number | null
          id?: string
          stage_name?: string
          started_at?: string
          strategy_id?: string | null
          time_spent_seconds?: number | null
          total_form_fields?: number | null
          user_id?: string
        }
        Relationships: []
      }
      business_survival_records: {
        Row: {
          assessment_date: string
          business_id: string
          closure_date: string | null
          closure_reason: string | null
          created_at: string
          employee_count: number | null
          id: string
          is_active: boolean
          months_in_operation: number
          revenue_trend: string | null
          risk_factors: string[] | null
          support_interventions: string[] | null
          survival_risk_score: number | null
          updated_at: string
        }
        Insert: {
          assessment_date?: string
          business_id: string
          closure_date?: string | null
          closure_reason?: string | null
          created_at?: string
          employee_count?: number | null
          id?: string
          is_active?: boolean
          months_in_operation?: number
          revenue_trend?: string | null
          risk_factors?: string[] | null
          support_interventions?: string[] | null
          survival_risk_score?: number | null
          updated_at?: string
        }
        Update: {
          assessment_date?: string
          business_id?: string
          closure_date?: string | null
          closure_reason?: string | null
          created_at?: string
          employee_count?: number | null
          id?: string
          is_active?: boolean
          months_in_operation?: number
          revenue_trend?: string | null
          risk_factors?: string[] | null
          support_interventions?: string[] | null
          survival_risk_score?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      business_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          template_config: Json
          updated_at: string
          version: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          template_config: Json
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          template_config?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      businesses: {
        Row: {
          business_type: string | null
          created_at: string
          description: string | null
          hub_id: string | null
          id: string
          is_active: boolean | null
          name: string
          registration_certificate_url: string | null
          registration_number: string | null
          stage: Database["public"]["Enums"]["business_stage"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_type?: string | null
          created_at?: string
          description?: string | null
          hub_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          registration_certificate_url?: string | null
          registration_number?: string | null
          stage?: Database["public"]["Enums"]["business_stage"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_type?: string | null
          created_at?: string
          description?: string | null
          hub_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          registration_certificate_url?: string | null
          registration_number?: string | null
          stage?: Database["public"]["Enums"]["business_stage"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_access_records: {
        Row: {
          amount_approved: number | null
          amount_disbursed: number | null
          amount_requested: number | null
          application_status: string | null
          business_id: string
          created_at: string
          funding_source: string
          funding_type: string
          id: string
          interest_rate: number | null
          loan_term_months: number | null
          notes: string | null
          purpose: string | null
          record_date: string
          rejection_reason: string | null
          updated_at: string
        }
        Insert: {
          amount_approved?: number | null
          amount_disbursed?: number | null
          amount_requested?: number | null
          application_status?: string | null
          business_id: string
          created_at?: string
          funding_source: string
          funding_type: string
          id?: string
          interest_rate?: number | null
          loan_term_months?: number | null
          notes?: string | null
          purpose?: string | null
          record_date?: string
          rejection_reason?: string | null
          updated_at?: string
        }
        Update: {
          amount_approved?: number | null
          amount_disbursed?: number | null
          amount_requested?: number | null
          application_status?: string | null
          business_id?: string
          created_at?: string
          funding_source?: string
          funding_type?: string
          id?: string
          interest_rate?: number | null
          loan_term_months?: number | null
          notes?: string | null
          purpose?: string | null
          record_date?: string
          rejection_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financial_records: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          hub_id: string | null
          id: string
          metric_type: string
          notes: string | null
          record_date: string
          updated_at: string
        }
        Insert: {
          amount?: number
          business_id: string
          created_at?: string
          hub_id?: string | null
          id?: string
          metric_type?: string
          notes?: string | null
          record_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          hub_id?: string | null
          id?: string
          metric_type?: string
          notes?: string | null
          record_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_financial_records_hub"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          description: string
          id: string
          strategy_id: string
          transaction_date: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          currency?: string
          description: string
          id?: string
          strategy_id: string
          transaction_date?: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          strategy_id?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      geographic_analytics: {
        Row: {
          active_businesses: number
          country_code: string
          country_name: string
          id: string
          last_updated: string
          region: string | null
          total_revenue: number | null
          user_count: number
        }
        Insert: {
          active_businesses?: number
          country_code: string
          country_name: string
          id?: string
          last_updated?: string
          region?: string | null
          total_revenue?: number | null
          user_count?: number
        }
        Update: {
          active_businesses?: number
          country_code?: string
          country_name?: string
          id?: string
          last_updated?: string
          region?: string | null
          total_revenue?: number | null
          user_count?: number
        }
        Relationships: []
      }
      hubs: {
        Row: {
          admin_user_id: string | null
          contact_email: string | null
          country: string
          created_at: string
          id: string
          metadata: Json | null
          name: string
          region: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          admin_user_id?: string | null
          contact_email?: string | null
          country: string
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          region?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          admin_user_id?: string | null
          contact_email?: string | null
          country?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          region?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      impersonation_sessions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          session_token: string
          super_admin_id: string
          target_hub_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          session_token: string
          super_admin_id: string
          target_hub_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          session_token?: string
          super_admin_id?: string
          target_hub_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_target_hub_id_fkey"
            columns: ["target_hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          account_type: string
          code: string
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          expires_at: string
          hub_id: string | null
          id: string
          invited_email: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          account_type: string
          code: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          expires_at?: string
          hub_id?: string | null
          id?: string
          invited_email: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          expires_at?: string
          hub_id?: string | null
          id?: string
          invited_email?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_creation_records: {
        Row: {
          age_breakdown: Json | null
          average_wage: number | null
          benefits_provided: boolean | null
          business_id: string
          created_at: string
          employment_type: string | null
          gender_breakdown: Json | null
          id: string
          job_type: string | null
          jobs_created: number
          recorded_date: string
          retention_rate: number | null
          skill_level: string | null
          updated_at: string | null
        }
        Insert: {
          age_breakdown?: Json | null
          average_wage?: number | null
          benefits_provided?: boolean | null
          business_id: string
          created_at?: string
          employment_type?: string | null
          gender_breakdown?: Json | null
          id?: string
          job_type?: string | null
          jobs_created?: number
          recorded_date?: string
          retention_rate?: number | null
          skill_level?: string | null
          updated_at?: string | null
        }
        Update: {
          age_breakdown?: Json | null
          average_wage?: number | null
          benefits_provided?: boolean | null
          business_id?: string
          created_at?: string
          employment_type?: string | null
          gender_breakdown?: Json | null
          id?: string
          job_type?: string | null
          jobs_created?: number
          recorded_date?: string
          retention_rate?: number | null
          skill_level?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_creation_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_readiness_assessments: {
        Row: {
          assessed_by: string | null
          assessment_date: string
          business_id: string
          business_plan_score: number | null
          cash_flow_score: number | null
          collateral_value: number | null
          created_at: string
          credit_score: number | null
          debt_to_income_ratio: number | null
          financial_documentation_score: number | null
          id: string
          overall_readiness_score: number | null
          readiness_level: string | null
          recommendations: string[] | null
          revenue_stability_score: number | null
          updated_at: string
        }
        Insert: {
          assessed_by?: string | null
          assessment_date?: string
          business_id: string
          business_plan_score?: number | null
          cash_flow_score?: number | null
          collateral_value?: number | null
          created_at?: string
          credit_score?: number | null
          debt_to_income_ratio?: number | null
          financial_documentation_score?: number | null
          id?: string
          overall_readiness_score?: number | null
          readiness_level?: string | null
          recommendations?: string[] | null
          revenue_stability_score?: number | null
          updated_at?: string
        }
        Update: {
          assessed_by?: string | null
          assessment_date?: string
          business_id?: string
          business_plan_score?: number | null
          cash_flow_score?: number | null
          collateral_value?: number | null
          created_at?: string
          credit_score?: number | null
          debt_to_income_ratio?: number | null
          financial_documentation_score?: number | null
          id?: string
          overall_readiness_score?: number | null
          readiness_level?: string | null
          recommendations?: string[] | null
          revenue_stability_score?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      milestone_completion_analytics: {
        Row: {
          business_id: string | null
          business_stage: string | null
          completed_at: string | null
          created_at: string
          days_to_complete: number | null
          id: string
          milestone_category: string | null
          milestone_title: string
          status: string
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          business_stage?: string | null
          completed_at?: string | null
          created_at?: string
          days_to_complete?: number | null
          id?: string
          milestone_category?: string | null
          milestone_title: string
          status?: string
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          business_stage?: string | null
          completed_at?: string | null
          created_at?: string
          days_to_complete?: number | null
          id?: string
          milestone_category?: string | null
          milestone_title?: string
          status?: string
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          business_stage: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          milestone_type: string | null
          status: string | null
          strategy_id: string | null
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_stage?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          milestone_type?: string | null
          status?: string | null
          strategy_id?: string | null
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_stage?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          milestone_type?: string | null
          status?: string | null
          strategy_id?: string | null
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_milestones_strategy_id_strategy_id_cascade"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          full_name: string | null
          id: string
          invite_code: string | null
          payload: Json | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["approval_status"] | null
          updated_at: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          invite_code?: string | null
          payload?: Json | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          updated_at?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          invite_code?: string | null
          payload?: Json | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          updated_at?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          business_type: string | null
          contact_person_name: string | null
          contact_person_title: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          email: string | null
          email_confirmed: boolean | null
          email_confirmed_at: string | null
          first_name: string | null
          full_name: string | null
          hub_id: string | null
          id: string
          industry: string | null
          is_profile_complete: boolean | null
          last_name: string | null
          logo_url: string | null
          organization_id: string | null
          organization_name: string | null
          profile_picture_url: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_type?: string | null
          business_type?: string | null
          contact_person_name?: string | null
          contact_person_title?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          email_confirmed?: boolean | null
          email_confirmed_at?: string | null
          first_name?: string | null
          full_name?: string | null
          hub_id?: string | null
          id: string
          industry?: string | null
          is_profile_complete?: boolean | null
          last_name?: string | null
          logo_url?: string | null
          organization_id?: string | null
          organization_name?: string | null
          profile_picture_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_type?: string | null
          business_type?: string | null
          contact_person_name?: string | null
          contact_person_title?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          email_confirmed?: boolean | null
          email_confirmed_at?: string | null
          first_name?: string | null
          full_name?: string | null
          hub_id?: string | null
          id?: string
          industry?: string | null
          is_profile_complete?: boolean | null
          last_name?: string | null
          logo_url?: string | null
          organization_id?: string | null
          organization_name?: string | null
          profile_picture_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      role_change_audit: {
        Row: {
          action_type: string
          changed_by_user_id: string
          id: string
          ip_address: unknown | null
          new_role: Database["public"]["Enums"]["user_role"] | null
          old_role: Database["public"]["Enums"]["user_role"] | null
          target_user_id: string
          timestamp: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          changed_by_user_id: string
          id?: string
          ip_address?: unknown | null
          new_role?: Database["public"]["Enums"]["user_role"] | null
          old_role?: Database["public"]["Enums"]["user_role"] | null
          target_user_id: string
          timestamp?: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          changed_by_user_id?: string
          id?: string
          ip_address?: unknown | null
          new_role?: Database["public"]["Enums"]["user_role"] | null
          old_role?: Database["public"]["Enums"]["user_role"] | null
          target_user_id?: string
          timestamp?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      settings_audit: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          new_value: string | null
          old_value: string | null
          requester_ip: unknown | null
          requester_user_agent: string | null
          setting_key: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          requester_ip?: unknown | null
          requester_user_agent?: string | null
          setting_key: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          requester_ip?: unknown | null
          requester_user_agent?: string | null
          setting_key?: string
        }
        Relationships: []
      }
      strategies: {
        Row: {
          business_id: string | null
          business_name: string | null
          country: string | null
          created_at: string
          currency: string | null
          growth_goals: string | null
          id: string
          is_active: boolean | null
          key_partners: string | null
          language: string | null
          marketing_approach: string | null
          mission: string | null
          operational_needs: string | null
          revenue_model: string | null
          target_market: string | null
          template_id: string | null
          template_name: string | null
          updated_at: string
          user_id: string
          value_proposition: string | null
          vision: string | null
        }
        Insert: {
          business_id?: string | null
          business_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          growth_goals?: string | null
          id?: string
          is_active?: boolean | null
          key_partners?: string | null
          language?: string | null
          marketing_approach?: string | null
          mission?: string | null
          operational_needs?: string | null
          revenue_model?: string | null
          target_market?: string | null
          template_id?: string | null
          template_name?: string | null
          updated_at?: string
          user_id: string
          value_proposition?: string | null
          vision?: string | null
        }
        Update: {
          business_id?: string | null
          business_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          growth_goals?: string | null
          id?: string
          is_active?: boolean | null
          key_partners?: string | null
          language?: string | null
          marketing_approach?: string | null
          mission?: string | null
          operational_needs?: string | null
          revenue_model?: string | null
          target_market?: string | null
          template_id?: string | null
          template_name?: string | null
          updated_at?: string
          user_id?: string
          value_proposition?: string | null
          vision?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategies_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          available_cycles: string[] | null
          billing_cycle: string
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          name: string
          price: number
          prices: Json | null
          updated_at: string
        }
        Insert: {
          available_cycles?: string[] | null
          billing_cycle?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price: number
          prices?: Json | null
          updated_at?: string
        }
        Update: {
          available_cycles?: string[] | null
          billing_cycle?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          prices?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      template_permissions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          permissions: Json
          subscription_tier: string
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          permissions?: Json
          subscription_tier: string
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          permissions?: Json
          subscription_tier?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_permissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "business_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_usage_analytics: {
        Row: {
          abandoned_at_stage: string | null
          completed_at: string | null
          completion_percentage: number | null
          conversion_type: string | null
          created_at: string
          id: string
          selected_at: string
          template_id: string
          template_name: string
          time_to_complete_minutes: number | null
          user_id: string
        }
        Insert: {
          abandoned_at_stage?: string | null
          completed_at?: string | null
          completion_percentage?: number | null
          conversion_type?: string | null
          created_at?: string
          id?: string
          selected_at?: string
          template_id: string
          template_name: string
          time_to_complete_minutes?: number | null
          user_id: string
        }
        Update: {
          abandoned_at_stage?: string | null
          completed_at?: string | null
          completion_percentage?: number | null
          conversion_type?: string | null
          created_at?: string
          id?: string
          selected_at?: string
          template_id?: string
          template_name?: string
          time_to_complete_minutes?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_activities: {
        Row: {
          activity_data: Json | null
          activity_type: string
          city: string | null
          country_code: string | null
          created_at: string
          id: string
          ip_address: unknown | null
          region: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          activity_data?: Json | null
          activity_type: string
          city?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown | null
          region?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          activity_data?: Json | null
          activity_type?: string
          city?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown | null
          region?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_journey_analytics: {
        Row: {
          action_data: Json | null
          action_type: string
          created_at: string
          id: string
          page_path: string
          referrer: string | null
          session_id: string
          timestamp: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_data?: Json | null
          action_type: string
          created_at?: string
          id?: string
          page_path: string
          referrer?: string | null
          session_id: string
          timestamp?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_data?: Json | null
          action_type?: string
          created_at?: string
          id?: string
          page_path?: string
          referrer?: string | null
          session_id?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          hub_id: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          hub_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          hub_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          billing_cycle: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          paystack_subscription_id: string | null
          plan_id: string
          price_paid: number | null
          status: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          paystack_subscription_id?: string | null
          plan_id: string
          price_paid?: number | null
          status?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          paystack_subscription_id?: string | null
          plan_id?: string
          price_paid?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      financial_records_with_hub: {
        Row: {
          amount: number | null
          business_id: string | null
          created_at: string | null
          hub_id: string | null
          id: string | null
          metric_type: string | null
          notes: string | null
          record_date: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_user_role_with_audit: {
        Args:
          | {
              hub_id?: string
              new_role: Database["public"]["Enums"]["user_role"]
              requester_ip?: unknown
              requester_user_agent?: string
              target_user_id: string
            }
          | {
              new_role: Database["public"]["Enums"]["user_role"]
              requester_ip?: unknown
              requester_user_agent?: string
              target_user_id: string
            }
        Returns: boolean
      }
      analyze_drop_off_points: {
        Args: Record<PropertyKey, never>
        Returns: {
          avg_time_on_page: number
          drop_off_rate: number
          page_path: string
          total_entries: number
          total_exits: number
        }[]
      }
      approve_pending_org: {
        Args: {
          approval_id: string
          requester_ip?: unknown
          requester_user_agent?: string
        }
        Returns: boolean
      }
      batch_process_financial_aggregation: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          business_id: string
          record_date: string
          records_processed: number
        }[]
      }
      calculate_stage_completion_rates: {
        Args: Record<PropertyKey, never>
        Returns: {
          avg_time_to_complete: number
          completion_rate: number
          stage_name: string
          total_completions: number
          total_starts: number
        }[]
      }
      cleanup_old_financial_aggregations: {
        Args: { p_retention_days?: number }
        Returns: number
      }
      create_or_update_strategy_with_business: {
        Args: {
          p_business_data?: Json
          p_milestones_data?: Json[]
          p_strategy_data: Json
        }
        Returns: Json
      }
      create_strategy_with_business: {
        Args: { p_business_data: Json; p_strategy_data: Json }
        Returns: Json
      }
      get_current_hub_context: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_hub_analytics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_strategy_financials: {
        Args: { p_strategy_id: string }
        Returns: {
          amount: number
          created_at: string
          id: string
          record_date: string
          strategy_id: string
          updated_at: string
        }[]
      }
      handle_org_signup: {
        Args: {
          full_name: string
          invite_code?: string
          user_email: string
          user_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_hub_manager: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_org_approved: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      reject_pending_org: {
        Args: {
          approval_id: string
          rejection_reason?: string
          requester_ip?: unknown
          requester_user_agent?: string
        }
        Returns: boolean
      }
      remove_user_role_with_audit: {
        Args:
          | {
              hub_id?: string
              old_role: Database["public"]["Enums"]["user_role"]
              requester_ip?: unknown
              requester_user_agent?: string
              target_user_id: string
            }
          | {
              old_role: Database["public"]["Enums"]["user_role"]
              requester_ip?: unknown
              requester_user_agent?: string
              target_user_id: string
            }
        Returns: boolean
      }
      service_add_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["user_role"]
          requester_ip?: unknown
          requester_user_agent?: string
          requester_user_id?: string
          target_user_id: string
        }
        Returns: boolean
      }
      set_app_setting_with_audit: {
        Args: {
          requester_ip?: unknown
          requester_user_agent?: string
          setting_key: string
          setting_value: string
        }
        Returns: boolean
      }
      set_system_setting: {
        Args: { p_key: string; p_reason?: string; p_value: string }
        Returns: boolean
      }
      set_user_role: {
        Args: {
          hub_id?: string
          requester_user_id?: string
          role: string
          target_user_id: string
        }
        Returns: undefined
      }
      setup_super_admin: {
        Args: { admin_email: string }
        Returns: string
      }
      start_impersonation: {
        Args: { target_hub_id: string }
        Returns: Json
      }
      stop_impersonation: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      update_geographic_analytics: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      user_can_interact: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "expired"
        | "cancelled"
      business_stage: "idea" | "launch" | "growth" | "scale"
      milestone_type:
        | "business_registration"
        | "first_customer"
        | "first_hire"
        | "break_even"
        | "loan_application"
        | "investment_ready"
      user_role: "entrepreneur" | "hub_manager" | "admin" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "expired",
        "cancelled",
      ],
      business_stage: ["idea", "launch", "growth", "scale"],
      milestone_type: [
        "business_registration",
        "first_customer",
        "first_hire",
        "break_even",
        "loan_application",
        "investment_ready",
      ],
      user_role: ["entrepreneur", "hub_manager", "admin", "super_admin"],
    },
  },
} as const
