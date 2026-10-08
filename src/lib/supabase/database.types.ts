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
      game_pause_votes: {
        Row: {
          created_at: string
          game_id: string
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          game_id: string
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          game_id?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_pause_votes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          assistance_level: number
          controller_type: Database["public"]["Enums"]["controller_type"]
          display_name: string
          game_id: string
          join_status: Database["public"]["Enums"]["join_status"]
          last_activity_at: string
          player_key: string
          replaced_at: string | null
          seat: string
          timeout_count: number
          user_id: string | null
        }
        Insert: {
          assistance_level: number
          controller_type: Database["public"]["Enums"]["controller_type"]
          display_name?: string
          game_id: string
          join_status?: Database["public"]["Enums"]["join_status"]
          last_activity_at?: string
          player_key: string
          replaced_at?: string | null
          seat: string
          timeout_count?: number
          user_id?: string | null
        }
        Update: {
          assistance_level?: number
          controller_type?: Database["public"]["Enums"]["controller_type"]
          display_name?: string
          game_id?: string
          join_status?: Database["public"]["Enums"]["join_status"]
          last_activity_at?: string
          player_key?: string
          replaced_at?: string | null
          seat?: string
          timeout_count?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_public_events: {
        Row: {
          created_at: string
          event_type: string
          game_id: string
          id: number
          payload: Json
          sequence: number
        }
        Insert: {
          created_at?: string
          event_type: string
          game_id: string
          id?: never
          payload?: Json
          sequence: number
        }
        Update: {
          created_at?: string
          event_type?: string
          game_id?: string
          id?: never
          payload?: Json
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_public_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_reviews: {
        Row: {
          created_at: string
          game_id: string
          player_id: string
          review_json: Json
        }
        Insert: {
          created_at?: string
          game_id: string
          player_id: string
          review_json: Json
        }
        Update: {
          created_at?: string
          game_id?: string
          player_id?: string
          review_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "game_reviews_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline_at: string | null
          event_sequence: number
          id: string
          invite_code_digest: string | null
          invite_expires_at: string | null
          mode: Database["public"]["Enums"]["game_mode"]
          owner_id: string
          paused_remaining_seconds: number | null
          phase: string
          public_state: Json
          response_seconds: number
          secure_seed_ref: string | null
          started_at: string | null
          state_version: number
          status: Database["public"]["Enums"]["game_status"]
          timeout_claim_token: string | null
          timeout_claimed_until: string | null
          training_card_version: string
          turn_seconds: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          event_sequence?: number
          id?: string
          invite_code_digest?: string | null
          invite_expires_at?: string | null
          mode?: Database["public"]["Enums"]["game_mode"]
          owner_id: string
          paused_remaining_seconds?: number | null
          phase: string
          public_state?: Json
          response_seconds?: number
          secure_seed_ref?: string | null
          started_at?: string | null
          state_version?: number
          status?: Database["public"]["Enums"]["game_status"]
          timeout_claim_token?: string | null
          timeout_claimed_until?: string | null
          training_card_version: string
          turn_seconds?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          event_sequence?: number
          id?: string
          invite_code_digest?: string | null
          invite_expires_at?: string | null
          mode?: Database["public"]["Enums"]["game_mode"]
          owner_id?: string
          paused_remaining_seconds?: number | null
          phase?: string
          public_state?: Json
          response_seconds?: number
          secure_seed_ref?: string | null
          started_at?: string | null
          state_version?: number
          status?: Database["public"]["Enums"]["game_status"]
          timeout_claim_token?: string | null
          timeout_claimed_until?: string | null
          training_card_version?: string
          turn_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      learning_events: {
        Row: {
          created_at: string
          event_type: string
          game_id: string | null
          id: number
          metadata: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          game_id?: string | null
          id?: never
          metadata?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          game_id?: string | null
          id?: never
          metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active_game_limit: number
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active_game_limit: number
          created_at?: string
          id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active_game_limit?: number
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      player_notifications: {
        Row: {
          created_at: string
          email_attempted_at: string | null
          email_status: string
          game_id: string | null
          id: string
          kind: string
          payload: Json
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email_attempted_at?: string | null
          email_status?: string
          game_id?: string | null
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email_attempted_at?: string | null
          email_status?: string
          game_id?: string | null
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_notifications_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      player_progress: {
        Row: {
          current_assistance_level: number
          experience_points: number
          games_completed: number
          skills_json: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          current_assistance_level?: number
          experience_points?: number
          games_completed?: number
          skills_json?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          current_assistance_level?: number
          experience_points?: number
          games_completed?: number
          skills_json?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_entitlements: {
        Row: {
          created_at: string
          plan_id: string
          source: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          plan_id?: string
          source?: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          plan_id?: string
          source?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cast_pause_vote: {
        Args: {
          requested_game_id: string
          requested_vote: string
          voting_user_id: string
        }
        Returns: Json
      }
      claim_overdue_games: {
        Args: { batch_size?: number; worker_token: string }
        Returns: {
          game_id: string
          state_version: number
        }[]
      }
      claim_username_for_user: {
        Args: { requested_username: string; requesting_user_id: string }
        Returns: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      commit_game_action: {
        Args: {
          acting_player_key: string
          acting_user_id: string
          action_type_value: string
          emitted_events: Json
          expected_version: number
          next_deadline: string
          next_phase: string
          next_public_state: Json
          next_state: Json
          next_status: Database["public"]["Enums"]["game_status"]
          replacement_player_keys?: Json
          request_hash_value: string
          requested_action_id: string
          requested_game_id: string
          response_status_value?: number
          response_value: Json
          timeout_player_keys?: Json
        }
        Returns: Json
      }
      consume_rate_limit: {
        Args: {
          bucket_value: string
          limit_value: number
          subject_value: string
          window_seconds: number
        }
        Returns: boolean
      }
      create_game_room: {
        Args: {
          game_mode_value: Database["public"]["Enums"]["game_mode"]
          invite_code_value: string
          invite_expires_value: string
          owner_display_name: string
          owner_player_key: string
          owner_user_id: string
          response_seconds_value: number
          turn_seconds_value: number
        }
        Returns: Json
      }
      join_game_room: {
        Args: {
          invite_code_value: string
          joining_display_name: string
          joining_player_key: string
          joining_user_id: string
        }
        Returns: Json
      }
      load_canonical_game: {
        Args: { requested_game_id: string }
        Returns: Json
      }
      record_operational_event: {
        Args: {
          duration_ms_value?: number
          event_type_value: string
          game_id_value?: string
          metadata_value?: Json
          state_version_value?: number
          user_id_value?: string
        }
        Returns: undefined
      }
      resolve_login_identifier: {
        Args: { identifier_value: string }
        Returns: string
      }
      start_game_room: {
        Args: {
          initial_deadline: string
          initial_public_state: Json
          initial_state: Json
          requested_game_id: string
          requesting_user_id: string
          roster: Json
          seed_reference: string
        }
        Returns: Json
      }
    }
    Enums: {
      controller_type: "human" | "bot"
      game_mode: "live" | "async"
      game_status: "lobby" | "active" | "paused" | "completed" | "abandoned"
      join_status: "joined" | "disconnected" | "replaced"
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
      controller_type: ["human", "bot"],
      game_mode: ["live", "async"],
      game_status: ["lobby", "active", "paused", "completed", "abandoned"],
      join_status: ["joined", "disconnected", "replaced"],
    },
  },
} as const

