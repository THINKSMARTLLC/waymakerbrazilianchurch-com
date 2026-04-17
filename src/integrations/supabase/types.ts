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
      members: {
        Row: {
          address: string | null
          contribution_frequency: Database["public"]["Enums"]["contribution_frequency"]
          created_at: string
          email: string | null
          emergency_contact: string | null
          id: string
          name: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          phone: string | null
          profile_photo_url: string | null
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string | null
          weekly_contribution_usd: number
        }
        Insert: {
          address?: string | null
          contribution_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          id?: string
          name: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          phone?: string | null
          profile_photo_url?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
          weekly_contribution_usd?: number
        }
        Update: {
          address?: string | null
          contribution_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          id?: string
          name?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          phone?: string | null
          profile_photo_url?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
          weekly_contribution_usd?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          base_amount: number | null
          contribution_type: Database["public"]["Enums"]["contribution_type"]
          created_at: string
          extra_amount: number
          id: string
          member_id: string
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_subscription_id: string | null
        }
        Insert: {
          amount: number
          base_amount?: number | null
          contribution_type?: Database["public"]["Enums"]["contribution_type"]
          created_at?: string
          extra_amount?: number
          id?: string
          member_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_subscription_id?: string | null
        }
        Update: {
          amount?: number
          base_amount?: number | null
          contribution_type?: Database["public"]["Enums"]["contribution_type"]
          created_at?: string
          extra_amount?: number
          id?: string
          member_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
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
      user_profiles: {
        Row: {
          church_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          last_login_at: string | null
          phone: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          church_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          last_login_at?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          church_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          phone?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_staff: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      account_status: "pending" | "active" | "suspended"
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
      member_status: "active" | "inactive"
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
      subscription_status: "active" | "canceled" | "past_due"
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
      account_status: ["pending", "active", "suspended"],
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
      member_status: ["active", "inactive"],
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
      subscription_status: ["active", "canceled", "past_due"],
    },
  },
} as const
