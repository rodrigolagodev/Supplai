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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["membership_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["membership_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          id: string
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          organization_id: string
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_audio_files: {
        Row: {
          confidence_score: number | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          order_id: string
          original_filename: string
          processed_at: string | null
          status: string
          processing_status: Database["public"]["Enums"]["processing_status"]
          storage_path: string
          transcription_text: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          order_id: string
          original_filename: string
          processed_at?: string | null
          status?: string
          processing_status?: Database["public"]["Enums"]["processing_status"]
          storage_path: string
          transcription_text?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          order_id?: string
          original_filename?: string
          processed_at?: string | null
          status?: string
          processing_status?: Database["public"]["Enums"]["processing_status"]
          storage_path?: string
          transcription_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_audio_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_conversations: {
        Row: {
          id: string
          order_id: string
          role: string
          content: string
          created_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          order_id: string
          role: string
          content: string
          created_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          order_id?: string
          role?: string
          content?: string
          created_at?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "order_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          }
        ]
      }
      order_items: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          order_id: string
          original_text: string | null
          product: string
          quantity: number
          supplier_id: string | null
          unit: Database["public"]["Enums"]["item_unit"]
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          order_id: string
          original_text?: string | null
          product: string
          quantity: number
          supplier_id?: string | null
          unit: Database["public"]["Enums"]["item_unit"]
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          order_id?: string
          original_text?: string | null
          product?: string
          quantity?: number
          supplier_id?: string | null
          unit?: Database["public"]["Enums"]["item_unit"]
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          category: Database["public"]["Enums"]["supplier_category"]
          created_at: string
          email: string | null
          id: string
          name: string
          organization_id: string
          phone: string | null
          updated_at: string
          custom_keywords: string[] | null
          preferred_contact_method: Database["public"]["Enums"]["contact_method"] | null
          address: string | null
          notes: string | null
          deleted_at: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["supplier_category"]
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
          custom_keywords?: string[] | null
          preferred_contact_method?: Database["public"]["Enums"]["contact_method"] | null
          address?: string | null
          notes?: string | null
          deleted_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["supplier_category"]
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
          custom_keywords?: string[] | null
          preferred_contact_method?: Database["public"]["Enums"]["contact_method"] | null
          address?: string | null
          notes?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: {
          token: string
        }
        Returns: boolean
      }
      create_organization_with_membership: {
        Args: {
          org_name: string
          org_slug: string
          user_email: string
        }
        Returns: string
      }
      get_user_organizations: {
        Args: {
          user_id: string
        }
        Returns: {
          organization_id: string
          organization_name: string
          organization_slug: string
          user_role: Database["public"]["Enums"]["membership_role"]
        }[]
      }
      get_user_role: {
        Args: {
          organization_id: string
        }
        Returns: Database["public"]["Enums"]["membership_role"]
      }
    }
    Enums: {
      contact_method: "email" | "phone" | "whatsapp"
      item_unit:
      | "kg"
      | "g"
      | "units"
      | "dozen"
      | "liters"
      | "ml"
      | "packages"
      | "boxes"
      membership_role: "admin" | "member"
      processing_status: "pending" | "processing" | "completed" | "failed"
      order_status: "draft" | "review" | "sent" | "archived" | "cancelled"
      supplier_category:
      | "fruits_vegetables"
      | "meats"
      | "fish_seafood"
      | "dry_goods"
      | "dairy"
      | "beverages"
      | "cleaning"
      | "packaging"
      | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
  | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
    Database[PublicTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
    Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
    PublicSchema["Views"])
  ? (PublicSchema["Tables"] &
    PublicSchema["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
  | keyof PublicSchema["Tables"]
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
  | keyof PublicSchema["Tables"]
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
  | keyof PublicSchema["Enums"]
  | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
  ? PublicSchema["Enums"][PublicEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof PublicSchema["CompositeTypes"]
  | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
  ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      contact_method: ["email"],
      item_unit: [
        "kg",
        "g",
        "units",
        "dozen",
        "liters",
        "ml",
        "packages",
        "boxes",
      ],
      membership_role: ["admin", "member"],
      order_status: ["draft", "review", "sent", "archived", "cancelled"],
      supplier_category: [
        "fruits_vegetables",
        "meats",
        "fish_seafood",
        "dry_goods",
        "dairy",
        "beverages",
      ],
    },
  },
} as const
