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
      check_ins: {
        Row: {
          emergency_contact: string | null
          ended_at: string | null
          id: string
          started_at: string
          status: string
          user_id: string
          venue_id: string
        }
        Insert: {
          emergency_contact?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id: string
          venue_id: string
        }
        Update: {
          emergency_contact?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_swipes: {
        Row: {
          count: number
          day: string
          user_id: string
        }
        Insert: {
          count?: number
          day?: string
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      meetup_slots: {
        Row: {
          confirmed_by: string | null
          created_at: string
          id: string
          match_id: string
          scheduled_at: string
          status: string
          suggested_by: string
          venue_address: string | null
          venue_lat: number | null
          venue_lng: number | null
          venue_name: string
        }
        Insert: {
          confirmed_by?: string | null
          created_at?: string
          id?: string
          match_id: string
          scheduled_at: string
          status?: string
          suggested_by: string
          venue_address?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name: string
        }
        Update: {
          confirmed_by?: string | null
          created_at?: string
          id?: string
          match_id?: string
          scheduled_at?: string
          status?: string
          suggested_by?: string
          venue_address?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetup_slots_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          match_id: string
          meta: Json | null
          msg_type: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          match_id: string
          meta?: Json | null
          msg_type?: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          match_id?: string
          meta?: Json | null
          msg_type?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string
          emergency_contact: string | null
          id: string
          is_pro: boolean
          lat: number | null
          lng: number | null
          updated_at: string
          username: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name?: string
          emergency_contact?: string | null
          id: string
          is_pro?: boolean
          lat?: number | null
          lng?: number | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string
          emergency_contact?: string | null
          id?: string
          is_pro?: boolean
          lat?: number | null
          lng?: number | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      stickers: {
        Row: {
          code: string
          id: number
          nation: string
          seq: number | null
          slot_num: number
          slot_type: string
        }
        Insert: {
          code: string
          id: number
          nation: string
          seq?: number | null
          slot_num: number
          slot_type: string
        }
        Update: {
          code?: string
          id?: number
          nation?: string
          seq?: number | null
          slot_num?: number
          slot_type?: string
        }
        Relationships: []
      }
      swap_sessions: {
        Row: {
          arrived_a: boolean
          arrived_b: boolean
          complete_a: boolean
          complete_b: boolean
          completed: boolean
          created_at: string
          heading_a: boolean
          heading_b: boolean
          id: string
          match_id: string | null
          pin: string
          trade_id: string | null
        }
        Insert: {
          arrived_a?: boolean
          arrived_b?: boolean
          complete_a?: boolean
          complete_b?: boolean
          completed?: boolean
          created_at?: string
          heading_a?: boolean
          heading_b?: boolean
          id?: string
          match_id?: string | null
          pin?: string
          trade_id?: string | null
        }
        Update: {
          arrived_a?: boolean
          arrived_b?: boolean
          complete_a?: boolean
          complete_b?: boolean
          completed?: boolean
          created_at?: string
          heading_a?: boolean
          heading_b?: boolean
          id?: string
          match_id?: string | null
          pin?: string
          trade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swap_sessions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      swipes: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["swipe_dir"]
          id: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["swipe_dir"]
          id?: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["swipe_dir"]
          id?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      trade_proposals: {
        Row: {
          created_at: string
          give_ids: number[]
          id: string
          match_id: string
          proposer_id: string
          receive_ids: number[]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          give_ids?: number[]
          id?: string
          match_id: string
          proposer_id: string
          receive_ids?: number[]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          give_ids?: number[]
          id?: string
          match_id?: string
          proposer_id?: string
          receive_ids?: number[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_proposals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_inventory: {
        Row: {
          status: string
          sticker_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          status: string
          sticker_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          status?: string
          sticker_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venue_nominations: {
        Row: {
          created_at: string
          id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_nominations_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_verified: boolean
          lat: number
          lng: number
          name: string
          nominations: number
          osm_id: string | null
          swap_count: number
          type: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          lat: number
          lng: number
          name: string
          nominations?: number
          osm_id?: string | null
          swap_count?: number
          type: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          lat?: number
          lng?: number
          name?: string
          nominations?: number
          osm_id?: string | null
          swap_count?: number
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_swap: {
        Args: { _is_user_a: boolean; _match_id: string }
        Returns: {
          completed: boolean
        }[]
      }
      get_likes_received: {
        Args: never
        Returns: {
          anon_id: string
          distance_km: number
          give_count: number
          give_ids: number[]
          is_pro: boolean
          receive_count: number
          receive_ids: number[]
        }[]
      }
      get_match_compatibility: {
        Args: { _match_id: string }
        Returns: {
          give_count: number
          receive_count: number
        }[]
      }
      get_potential_matches:
        | {
            Args: { _limit?: number }
            Returns: {
              bio: string
              display_name: string
              give_count: number
              give_ids: number[]
              is_pro: boolean
              lat: number
              lng: number
              receive_count: number
              receive_ids: number[]
              user_id: string
            }[]
          }
        | {
            Args: { _limit?: number; _max_km?: number }
            Returns: {
              bio: string
              display_name: string
              give_count: number
              give_ids: number[]
              is_pro: boolean
              lat: number
              lng: number
              receive_count: number
              receive_ids: number[]
              user_id: string
            }[]
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_swipe: {
        Args: {
          _direction: Database["public"]["Enums"]["swipe_dir"]
          _receiver: string
        }
        Returns: {
          match_id: string
          matched: boolean
          remaining: number
        }[]
      }
      upsert_osm_venue: {
        Args: {
          _address: string
          _lat: number
          _lng: number
          _name: string
          _osm_id: string
          _type: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      sticker_status: "need" | "duplicate"
      swipe_dir: "like" | "dislike"
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
      app_role: ["admin", "user"],
      sticker_status: ["need", "duplicate"],
      swipe_dir: ["like", "dislike"],
    },
  },
} as const
