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
      website_feedback: {
        Row: {
          id: string
          user_id: string
          category: string
          body: string
          created_at: string
        }
        Insert: {
          id: string
          user_id: string
          category: string
          body: string
        }
        Update: never
        Relationships: []
      }
      diver_certificates: {
        Row: {
          id: string
          user_id: string
          agency: string
          level: string
          certificate_number: string | null
          issued_on: string | null
          issued_at: string | null
          is_public: boolean
          front_photo_path: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          agency: string
          level: string
          certificate_number?: string | null
          issued_on?: string | null
          issued_at?: string | null
          is_public?: boolean
          front_photo_path?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["diver_certificates"]["Insert"]>
        Relationships: []
      }
      dives: {
        Row: {
          buddy_name: string | null
          buddy_role: Database["public"]["Enums"]["buddy_role"] | null
          country: string
          region: string | null
          created_at: string
          dive_date: string
          entry_time: string | null
          dive_type: Database["public"]["Enums"]["dive_type"]
          duration_min: number | null
          id: string
          max_depth: number | null
          notes: string | null
          photo_thumbnail_urls: string[]
          photo_urls: string[]
          site_name: string
          surface_temp: number | null
          updated_at: string
          user_id: string
          water_temp: number | null
          weather: string | null
        }
        Insert: {
          buddy_name?: string | null
          buddy_role?: Database["public"]["Enums"]["buddy_role"] | null
          country: string
          region?: string | null
          created_at?: string
          dive_date: string
          entry_time?: string | null
          dive_type?: Database["public"]["Enums"]["dive_type"]
          duration_min?: number | null
          id?: string
          max_depth?: number | null
          notes?: string | null
          photo_thumbnail_urls?: string[]
          photo_urls?: string[]
          site_name: string
          surface_temp?: number | null
          updated_at?: string
          user_id: string
          water_temp?: number | null
          weather?: string | null
        }
        Update: {
          buddy_name?: string | null
          buddy_role?: Database["public"]["Enums"]["buddy_role"] | null
          country?: string
          region?: string | null
          created_at?: string
          dive_date?: string
          entry_time?: string | null
          dive_type?: Database["public"]["Enums"]["dive_type"]
          duration_min?: number | null
          id?: string
          max_depth?: number | null
          notes?: string | null
          photo_thumbnail_urls?: string[]
          photo_urls?: string[]
          site_name?: string
          surface_temp?: number | null
          updated_at?: string
          user_id?: string
          water_temp?: number | null
          weather?: string | null
        }
        Relationships: []
      }
      gear_items: {
        Row: {
          brand: string
          category: "bcd" | "regulator" | "computer" | "mask" | "fins" | "wetsuit" | "camera" | "other"
          created_at: string
          dive_count: number
          id: string
          model: string
          next_service_on: string | null
          notes: string | null
          photo_path: string | null
          purchased_on: string | null
          serial_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string
          category: "bcd" | "regulator" | "computer" | "mask" | "fins" | "wetsuit" | "camera" | "other"
          created_at?: string
          dive_count?: number
          id?: string
          model?: string
          next_service_on?: string | null
          notes?: string | null
          photo_path?: string | null
          purchased_on?: string | null
          serial_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string
          category?: "bcd" | "regulator" | "computer" | "mask" | "fins" | "wetsuit" | "camera" | "other"
          created_at?: string
          dive_count?: number
          id?: string
          model?: string
          next_service_on?: string | null
          notes?: string | null
          photo_path?: string | null
          purchased_on?: string | null
          serial_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_date: string | null
          region: string | null
          age_public: boolean
          region_public: boolean
          avatar_url: string | null
          background_url: string | null
          bio: string | null
          cert_level: string | null
          created_at: string
          display_name: string | null
          id: string
          tank_count: number
        }
        Insert: {
          birth_date?: string | null
          region?: string | null
          age_public?: boolean
          region_public?: boolean
          avatar_url?: string | null
          background_url?: string | null
          bio?: string | null
          cert_level?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          tank_count?: number
        }
        Update: {
          birth_date?: string | null
          region?: string | null
          age_public?: boolean
          region_public?: boolean
          avatar_url?: string | null
          background_url?: string | null
          bio?: string | null
          cert_level?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          tank_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_diver_certificates: {
        Args: { target_user_id: string }
        Returns: {
          id: string
          agency: string
          level: string
          issued_on: string | null
          issued_at: string | null
        }[]
      }
      get_public_diver_profile: {
        Args: { target_user_id: string }
        Returns: {
          age: number | null
          region: string | null
          avatar_url: string | null
          bio: string | null
          cert_level: string | null
          created_at: string
          display_name: string | null
          id: string
          tank_count: number
        }[]
      }
    }
    Enums: {
      buddy_role: "instructor" | "buddy"
      dive_type: "recreational" | "freediving" | "technical"
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
      buddy_role: ["instructor", "buddy"],
      dive_type: ["recreational", "freediving", "technical"],
    },
  },
} as const
