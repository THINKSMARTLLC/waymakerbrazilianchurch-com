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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          page_accessed: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          page_accessed?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          page_accessed?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bible_notes: {
        Row: {
          book: string
          chapter: number
          created_at: string
          id: string
          member_id: string
          note_text: string
          share_with_pastor: boolean
          updated_at: string
          verse: number
        }
        Insert: {
          book: string
          chapter: number
          created_at?: string
          id?: string
          member_id: string
          note_text?: string
          share_with_pastor?: boolean
          updated_at?: string
          verse: number
        }
        Update: {
          book?: string
          chapter?: number
          created_at?: string
          id?: string
          member_id?: string
          note_text?: string
          share_with_pastor?: boolean
          updated_at?: string
          verse?: number
        }
        Relationships: []
      }
      bible_readings: {
        Row: {
          book: string
          chapter: number
          created_at: string
          id: string
          member_id: string
          read_date: string
        }
        Insert: {
          book: string
          chapter: number
          created_at?: string
          id?: string
          member_id: string
          read_date: string
        }
        Update: {
          book?: string
          chapter?: number
          created_at?: string
          id?: string
          member_id?: string
          read_date?: string
        }
        Relationships: []
      }
      church_settings: {
        Row: {
          address: string | null
          checkin_radius_meters: number
          church_name: string | null
          id: string
          inactivity_days: number
          latitude: number | null
          longitude: number | null
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          checkin_radius_meters?: number
          church_name?: string | null
          id?: string
          inactivity_days?: number
          latitude?: number | null
          longitude?: number | null
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          checkin_radius_meters?: number
          church_name?: string | null
          id?: string
          inactivity_days?: number
          latitude?: number | null
          longitude?: number | null
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      devotional_completions: {
        Row: {
          completed_date: string
          created_at: string
          devotional_id: string
          id: string
          member_id: string
        }
        Insert: {
          completed_date: string
          created_at?: string
          devotional_id: string
          id?: string
          member_id: string
        }
        Update: {
          completed_date?: string
          created_at?: string
          devotional_id?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devotional_completions_devotional_id_fkey"
            columns: ["devotional_id"]
            isOneToOne: false
            referencedRelation: "devotionals"
            referencedColumns: ["id"]
          },
        ]
      }
      devotional_notes: {
        Row: {
          created_at: string
          devotional_id: string
          god_spoke_text: string
          id: string
          keywords: string[]
          learned_text: string
          member_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          devotional_id: string
          god_spoke_text?: string
          id?: string
          keywords?: string[]
          learned_text?: string
          member_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          devotional_id?: string
          god_spoke_text?: string
          id?: string
          keywords?: string[]
          learned_text?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devotional_notes_devotional_id_fkey"
            columns: ["devotional_id"]
            isOneToOne: false
            referencedRelation: "devotionals"
            referencedColumns: ["id"]
          },
        ]
      }
      devotionals: {
        Row: {
          application: string
          bible_reference: string
          created_at: string
          devotional_date: string
          id: string
          language: string
          prayer: string
          reflection: string
          title: string
          verse_text: string | null
        }
        Insert: {
          application: string
          bible_reference: string
          created_at?: string
          devotional_date: string
          id?: string
          language?: string
          prayer: string
          reflection: string
          title: string
          verse_text?: string | null
        }
        Update: {
          application?: string
          bible_reference?: string
          created_at?: string
          devotional_date?: string
          id?: string
          language?: string
          prayer?: string
          reflection?: string
          title?: string
          verse_text?: string | null
        }
        Relationships: []
      }
      discipleship_notes: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          member_id: string
          message: string
          visibility: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          member_id: string
          message: string
          visibility?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          member_id?: string
          message?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipleship_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      dismissed_duplicate_groups: {
        Row: {
          dismissed_at: string
          dismissed_by: string | null
          group_key: string
          id: string
          reason: string
        }
        Insert: {
          dismissed_at?: string
          dismissed_by?: string | null
          group_key: string
          id?: string
          reason?: string
        }
        Update: {
          dismissed_at?: string
          dismissed_by?: string | null
          group_key?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_types: {
        Row: {
          active: boolean
          base_activity_type: Database["public"]["Enums"]["activity_type"]
          category: string
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          is_custom: boolean
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_activity_type: Database["public"]["Enums"]["activity_type"]
          category: string
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_custom?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_activity_type?: Database["public"]["Enums"]["activity_type"]
          category?: string
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_custom?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ledger_payment_applications: {
        Row: {
          amount_applied: number
          created_at: string
          id: string
          ledger_id: string
          payment_id: string
        }
        Insert: {
          amount_applied: number
          created_at?: string
          id?: string
          ledger_id: string
          payment_id: string
        }
        Update: {
          amount_applied?: number
          created_at?: string
          id?: string
          ledger_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_payment_applications_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "member_financial_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      member_activities: {
        Row: {
          activity_date: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          approved_at: string | null
          approved_by: string | null
          confidence_score: number
          created_at: string
          event_type_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          member_id: string
          notes: string | null
          photo_url: string | null
          recorded_by: string | null
          source: Database["public"]["Enums"]["activity_source"]
          status: Database["public"]["Enums"]["activity_status"]
          validation_type: string
        }
        Insert: {
          activity_date?: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number
          created_at?: string
          event_type_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          member_id: string
          notes?: string | null
          photo_url?: string | null
          recorded_by?: string | null
          source?: Database["public"]["Enums"]["activity_source"]
          status?: Database["public"]["Enums"]["activity_status"]
          validation_type?: string
        }
        Update: {
          activity_date?: string
          activity_type?: Database["public"]["Enums"]["activity_type"]
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number
          created_at?: string
          event_type_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          member_id?: string
          notes?: string | null
          photo_url?: string | null
          recorded_by?: string | null
          source?: Database["public"]["Enums"]["activity_source"]
          status?: Database["public"]["Enums"]["activity_status"]
          validation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_activities_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_activities_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_financial_ledger: {
        Row: {
          amount_due: number
          amount_paid: number
          balance: number | null
          created_at: string
          id: string
          member_id: string
          payment_status: Database["public"]["Enums"]["ledger_status"]
          stripe_payment_intent: string | null
          updated_at: string
          week_reference: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          balance?: number | null
          created_at?: string
          id?: string
          member_id: string
          payment_status?: Database["public"]["Enums"]["ledger_status"]
          stripe_payment_intent?: string | null
          updated_at?: string
          week_reference: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          balance?: number | null
          created_at?: string
          id?: string
          member_id?: string
          payment_status?: Database["public"]["Enums"]["ledger_status"]
          stripe_payment_intent?: string | null
          updated_at?: string
          week_reference?: string
        }
        Relationships: []
      }
      member_merge_history: {
        Row: {
          id: string
          merge_date: string
          merged_by: string | null
          merged_into_member_id: string
          original_member_id: string
          restored: boolean
          restored_at: string | null
          restored_by: string | null
          snapshot_data: Json
        }
        Insert: {
          id?: string
          merge_date?: string
          merged_by?: string | null
          merged_into_member_id: string
          original_member_id: string
          restored?: boolean
          restored_at?: string | null
          restored_by?: string | null
          snapshot_data: Json
        }
        Update: {
          id?: string
          merge_date?: string
          merged_by?: string | null
          merged_into_member_id?: string
          original_member_id?: string
          restored?: boolean
          restored_at?: string | null
          restored_by?: string | null
          snapshot_data?: Json
        }
        Relationships: []
      }
      member_visits: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          notes: string | null
          scheduled_date: string
          status: Database["public"]["Enums"]["visit_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          notes?: string | null
          scheduled_date: string
          status?: Database["public"]["Enums"]["visit_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          scheduled_date?: string
          status?: Database["public"]["Enums"]["visit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_visits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          accepted_jesus: boolean
          address: string | null
          archived: boolean
          archived_at: string | null
          archived_reason: string | null
          assigned_leader_id: string | null
          attending_regularly: boolean
          baptized: boolean
          completed_course: boolean
          contribution_frequency: Database["public"]["Enums"]["contribution_frequency"]
          created_at: string
          date_of_birth: string | null
          department: string | null
          discipleship_stage: Database["public"]["Enums"]["discipleship_stage"]
          email: string | null
          emergency_contact: string | null
          family_id: string | null
          family_role: Database["public"]["Enums"]["family_role"]
          id: string
          in_small_group: boolean
          inactivated_at: string | null
          inactivated_by: string | null
          inactivation_reason: string | null
          last_payment_date: string | null
          member_role: string | null
          name: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          phone: string | null
          profile_photo_url: string | null
          serving_ministry: boolean
          stage_updated_at: string
          status: Database["public"]["Enums"]["member_status"]
          status_payment: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_active: boolean
          updated_at: string
          user_id: string | null
          weekly_contribution_usd: number
        }
        Insert: {
          accepted_jesus?: boolean
          address?: string | null
          archived?: boolean
          archived_at?: string | null
          archived_reason?: string | null
          assigned_leader_id?: string | null
          attending_regularly?: boolean
          baptized?: boolean
          completed_course?: boolean
          contribution_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          discipleship_stage?: Database["public"]["Enums"]["discipleship_stage"]
          email?: string | null
          emergency_contact?: string | null
          family_id?: string | null
          family_role?: Database["public"]["Enums"]["family_role"]
          id?: string
          in_small_group?: boolean
          inactivated_at?: string | null
          inactivated_by?: string | null
          inactivation_reason?: string | null
          last_payment_date?: string | null
          member_role?: string | null
          name: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          phone?: string | null
          profile_photo_url?: string | null
          serving_ministry?: boolean
          stage_updated_at?: string
          status?: Database["public"]["Enums"]["member_status"]
          status_payment?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_active?: boolean
          updated_at?: string
          user_id?: string | null
          weekly_contribution_usd?: number
        }
        Update: {
          accepted_jesus?: boolean
          address?: string | null
          archived?: boolean
          archived_at?: string | null
          archived_reason?: string | null
          assigned_leader_id?: string | null
          attending_regularly?: boolean
          baptized?: boolean
          completed_course?: boolean
          contribution_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          discipleship_stage?: Database["public"]["Enums"]["discipleship_stage"]
          email?: string | null
          emergency_contact?: string | null
          family_id?: string | null
          family_role?: Database["public"]["Enums"]["family_role"]
          id?: string
          in_small_group?: boolean
          inactivated_at?: string | null
          inactivated_by?: string | null
          inactivation_reason?: string | null
          last_payment_date?: string | null
          member_role?: string | null
          name?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          phone?: string | null
          profile_photo_url?: string | null
          serving_ministry?: boolean
          stage_updated_at?: string
          status?: Database["public"]["Enums"]["member_status"]
          status_payment?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_active?: boolean
          updated_at?: string
          user_id?: string | null
          weekly_contribution_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "members_assigned_leader_id_fkey"
            columns: ["assigned_leader_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_contributions: {
        Row: {
          amount: number
          contribution_type: Database["public"]["Enums"]["contribution_type"]
          created_at: string
          destination: string | null
          id: string
          payment_id: string
        }
        Insert: {
          amount: number
          contribution_type: Database["public"]["Enums"]["contribution_type"]
          created_at?: string
          destination?: string | null
          id?: string
          payment_id: string
        }
        Update: {
          amount?: number
          contribution_type?: Database["public"]["Enums"]["contribution_type"]
          created_at?: string
          destination?: string | null
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_contributions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_relationships: {
        Row: {
          beneficiary_member_id: string
          contribution_type:
            | Database["public"]["Enums"]["contribution_type"]
            | null
          created_at: string
          id: string
          payer_member_id: string
          relationship_label: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          beneficiary_member_id: string
          contribution_type?:
            | Database["public"]["Enums"]["contribution_type"]
            | null
          created_at?: string
          id?: string
          payer_member_id: string
          relationship_label?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          beneficiary_member_id?: string
          contribution_type?:
            | Database["public"]["Enums"]["contribution_type"]
            | null
          created_at?: string
          id?: string
          payer_member_id?: string
          relationship_label?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          base_amount: number | null
          beneficiary_member_id: string | null
          card_brand: string | null
          card_last4: string | null
          contribution_type: Database["public"]["Enums"]["contribution_type"]
          created_at: string
          extra_amount: number
          id: string
          member_id: string
          notes: string | null
          payer_member_id: string | null
          payment_date: string
          payment_frequency: Database["public"]["Enums"]["payment_frequency"]
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_method_type: string | null
          receipt_url: string | null
          recorded_by: string | null
          reference_month: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          amount: number
          base_amount?: number | null
          beneficiary_member_id?: string | null
          card_brand?: string | null
          card_last4?: string | null
          contribution_type?: Database["public"]["Enums"]["contribution_type"]
          created_at?: string
          extra_amount?: number
          id?: string
          member_id: string
          notes?: string | null
          payer_member_id?: string | null
          payment_date?: string
          payment_frequency?: Database["public"]["Enums"]["payment_frequency"]
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_method_type?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          reference_month?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          amount?: number
          base_amount?: number | null
          beneficiary_member_id?: string | null
          card_brand?: string | null
          card_last4?: string | null
          contribution_type?: Database["public"]["Enums"]["contribution_type"]
          created_at?: string
          extra_amount?: number
          id?: string
          member_id?: string
          notes?: string | null
          payer_member_id?: string | null
          payment_date?: string
          payment_frequency?: Database["public"]["Enums"]["payment_frequency"]
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_method_type?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          reference_month?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      social_engagements: {
        Row: {
          action_type: Database["public"]["Enums"]["social_action_type"]
          created_at: string
          id: string
          member_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          points: number
          proof_link: string | null
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["engagement_status"]
          updated_at: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["social_action_type"]
          created_at?: string
          id?: string
          member_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          points?: number
          proof_link?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["engagement_status"]
          updated_at?: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["social_action_type"]
          created_at?: string
          id?: string
          member_id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          points?: number
          proof_link?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["engagement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_engagements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_processed_events: {
        Row: {
          event_type: string | null
          id: string
          processed_at: string
          stripe_event_id: string
        }
        Insert: {
          event_type?: string | null
          id?: string
          processed_at?: string
          stripe_event_id: string
        }
        Update: {
          event_type?: string | null
          id?: string
          processed_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          member_id: string
          stripe_customer_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          stripe_customer_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          stripe_customer_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          church_name: string | null
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          last_login_at: string | null
          must_change_password: boolean
          phone: string | null
          preferred_language: string
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          church_name?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          last_login_at?: string | null
          must_change_password?: boolean
          phone?: string | null
          preferred_language?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          church_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          must_change_password?: boolean
          phone?: string | null
          preferred_language?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_payment_to_ledger: {
        Args: { _payment_id: string }
        Returns: undefined
      }
      backfill_member_ledger: { Args: { _member_id: string }; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_weekly_ledger_entries: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_staff: { Args: { _user_id: string }; Returns: boolean }
      is_non_super_staff: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      merge_members_by_email: { Args: { _email: string }; Returns: string }
      merge_members_by_id: {
        Args: { _loser: string; _winner: string }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      refresh_ledger_row_status: {
        Args: { _ledger_id: string }
        Returns: undefined
      }
      restore_archived_member: { Args: { _member_id: string }; Returns: string }
      reverse_payment_from_ledger: {
        Args: { _payment_id: string }
        Returns: undefined
      }
      undo_merge: { Args: { _history_id: string }; Returns: string }
      week_monday: { Args: { _d: string }; Returns: string }
    }
    Enums: {
      account_status: "pending" | "active" | "suspended"
      activity_source: "self_checkin" | "admin_manual"
      activity_status: "pending" | "approved" | "rejected"
      activity_type:
        | "attendance"
        | "cell_group"
        | "visit_scheduled"
        | "leadership_contact"
      app_role:
        | "admin"
        | "finance_manager"
        | "super_admin"
        | "church_admin"
        | "member"
      contribution_frequency: "weekly" | "monthly" | "one_time" | "flexible"
      contribution_type:
        | "tithe"
        | "offering"
        | "pastor_salary"
        | "special_donation"
        | "event_contribution"
        | "other"
      discipleship_stage:
        | "visitor"
        | "new_believer"
        | "in_discipleship"
        | "committed"
        | "serving"
        | "leader"
      engagement_status: "pending" | "approved" | "rejected"
      family_role: "individual" | "family_owner" | "family_member" | "sponsored"
      ledger_status: "paid" | "partial" | "pending" | "overdue" | "failed"
      member_status: "active" | "inactive"
      payment_frequency: "weekly" | "monthly"
      payment_method:
        | "stripe"
        | "cash"
        | "zelle"
        | "venmo"
        | "card"
        | "paypal"
        | "other"
      payment_status: "paid" | "pending" | "past_due"
      payment_type: "card" | "cash"
      social_action_type:
        | "visit"
        | "follow"
        | "like"
        | "comment"
        | "subscribe"
        | "watch"
        | "review"
      social_platform:
        | "website"
        | "instagram"
        | "facebook"
        | "youtube"
        | "google_review"
      subscription_status: "active" | "canceled" | "past_due"
      visit_status: "scheduled" | "completed" | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_status: ["pending", "active", "suspended"],
      activity_source: ["self_checkin", "admin_manual"],
      activity_status: ["pending", "approved", "rejected"],
      activity_type: [
        "attendance",
        "cell_group",
        "visit_scheduled",
        "leadership_contact",
      ],
      app_role: [
        "admin",
        "finance_manager",
        "super_admin",
        "church_admin",
        "member",
      ],
      contribution_frequency: ["weekly", "monthly", "one_time", "flexible"],
      contribution_type: [
        "tithe",
        "offering",
        "pastor_salary",
        "special_donation",
        "event_contribution",
        "other",
      ],
      discipleship_stage: [
        "visitor",
        "new_believer",
        "in_discipleship",
        "committed",
        "serving",
        "leader",
      ],
      engagement_status: ["pending", "approved", "rejected"],
      family_role: ["individual", "family_owner", "family_member", "sponsored"],
      ledger_status: ["paid", "partial", "pending", "overdue", "failed"],
      member_status: ["active", "inactive"],
      payment_frequency: ["weekly", "monthly"],
      payment_method: [
        "stripe",
        "cash",
        "zelle",
        "venmo",
        "card",
        "paypal",
        "other",
      ],
      payment_status: ["paid", "pending", "past_due"],
      payment_type: ["card", "cash"],
      social_action_type: [
        "visit",
        "follow",
        "like",
        "comment",
        "subscribe",
        "watch",
        "review",
      ],
      social_platform: [
        "website",
        "instagram",
        "facebook",
        "youtube",
        "google_review",
      ],
      subscription_status: ["active", "canceled", "past_due"],
      visit_status: ["scheduled", "completed", "cancelled"],
    },
  },
} as const
