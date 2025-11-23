export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.5';
  };
  public: {
    Tables: {
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          organization_id: string;
          role: Database['public']['Enums']['membership_role'];
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          organization_id: string;
          role?: Database['public']['Enums']['membership_role'];
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          organization_id?: string;
          role?: Database['public']['Enums']['membership_role'];
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      jobs: {
        Row: {
          attempts: number;
          created_at: string;
          id: string;
          last_error: string | null;
          max_attempts: number;
          payload: Json;
          status: string;
          type: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          payload?: Json;
          status?: string;
          type: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          payload?: Json;
          status?: string;
          type?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'jobs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      memberships: {
        Row: {
          id: string;
          joined_at: string;
          organization_id: string;
          role: Database['public']['Enums']['membership_role'];
          user_id: string;
        };
        Insert: {
          id?: string;
          joined_at?: string;
          organization_id: string;
          role?: Database['public']['Enums']['membership_role'];
          user_id: string;
        };
        Update: {
          id?: string;
          joined_at?: string;
          organization_id?: string;
          role?: Database['public']['Enums']['membership_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'memberships_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      order_audio_files: {
        Row: {
          confidence_score: number | null;
          created_at: string;
          duration_seconds: number | null;
          error_message: string | null;
          file_size_bytes: number | null;
          id: string;
          order_id: string;
          processing_status: string;
          storage_path: string;
          transcribed_at: string | null;
          transcription: string | null;
        };
        Insert: {
          confidence_score?: number | null;
          created_at?: string;
          duration_seconds?: number | null;
          error_message?: string | null;
          file_size_bytes?: number | null;
          id?: string;
          order_id: string;
          processing_status?: string;
          storage_path: string;
          transcribed_at?: string | null;
          transcription?: string | null;
        };
        Update: {
          confidence_score?: number | null;
          created_at?: string;
          duration_seconds?: number | null;
          error_message?: string | null;
          file_size_bytes?: number | null;
          id?: string;
          order_id?: string;
          processing_status?: string;
          storage_path?: string;
          transcribed_at?: string | null;
          transcription?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_audio_files_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_conversations: {
        Row: {
          audio_file_id: string | null;
          content: string;
          created_at: string;
          id: string;
          order_id: string;
          role: string;
        };
        Insert: {
          audio_file_id?: string | null;
          content: string;
          created_at?: string;
          id?: string;
          order_id: string;
          role: string;
        };
        Update: {
          audio_file_id?: string | null;
          content?: string;
          created_at?: string;
          id?: string;
          order_id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_conversations_audio_file_id_fkey';
            columns: ['audio_file_id'];
            isOneToOne: false;
            referencedRelation: 'order_audio_files';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_conversations_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          confidence_score: number | null;
          created_at: string;
          id: string;
          order_id: string;
          original_text: string | null;
          product: string;
          quantity: number;
          supplier_id: string | null;
          unit: Database['public']['Enums']['item_unit'];
        };
        Insert: {
          confidence_score?: number | null;
          created_at?: string;
          id?: string;
          order_id: string;
          original_text?: string | null;
          product: string;
          quantity: number;
          supplier_id?: string | null;
          unit: Database['public']['Enums']['item_unit'];
        };
        Update: {
          confidence_score?: number | null;
          created_at?: string;
          id?: string;
          order_id?: string;
          original_text?: string | null;
          product?: string;
          quantity?: number;
          supplier_id?: string | null;
          unit?: Database['public']['Enums']['item_unit'];
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_supplier_id_fkey';
            columns: ['supplier_id'];
            isOneToOne: false;
            referencedRelation: 'suppliers';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items_archive: {
        Row: {
          archived_at: string;
          confidence_score: number | null;
          created_at: string;
          id: string;
          order_id: string;
          original_text: string | null;
          product: string;
          quantity: number;
          supplier_id: string | null;
          unit: Database['public']['Enums']['item_unit'];
        };
        Insert: {
          archived_at?: string;
          confidence_score?: number | null;
          created_at: string;
          id: string;
          order_id: string;
          original_text?: string | null;
          product: string;
          quantity: number;
          supplier_id?: string | null;
          unit: Database['public']['Enums']['item_unit'];
        };
        Update: {
          archived_at?: string;
          confidence_score?: number | null;
          created_at?: string;
          id?: string;
          order_id?: string;
          original_text?: string | null;
          product?: string;
          quantity?: number;
          supplier_id?: string | null;
          unit?: Database['public']['Enums']['item_unit'];
        };
        Relationships: [];
      };
      orders: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          organization_id: string;
          sent_at: string | null;
          status: Database['public']['Enums']['order_status'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          organization_id: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['order_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          organization_id?: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['order_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          address: string | null;
          category: Database['public']['Enums']['supplier_category'];
          created_at: string;
          custom_keywords: string[];
          deleted_at: string | null;
          email: string;
          id: string;
          name: string;
          notes: string | null;
          organization_id: string;
          phone: string | null;
          preferred_contact_method: Database['public']['Enums']['contact_method'];
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          category: Database['public']['Enums']['supplier_category'];
          created_at?: string;
          custom_keywords?: string[];
          deleted_at?: string | null;
          email: string;
          id?: string;
          name: string;
          notes?: string | null;
          organization_id: string;
          phone?: string | null;
          preferred_contact_method?: Database['public']['Enums']['contact_method'];
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          category?: Database['public']['Enums']['supplier_category'];
          created_at?: string;
          custom_keywords?: string[];
          deleted_at?: string | null;
          email?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          preferred_contact_method?: Database['public']['Enums']['contact_method'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'suppliers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      supplier_orders: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          order_id: string;
          sent_at: string | null;
          status: Database['public']['Enums']['supplier_order_status'];
          supplier_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          order_id: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['supplier_order_status'];
          supplier_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          order_id?: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['supplier_order_status'];
          supplier_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'supplier_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'supplier_orders_supplier_id_fkey';
            columns: ['supplier_id'];
            isOneToOne: false;
            referencedRelation: 'suppliers';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      order_items_all: {
        Row: {
          archived_at: string | null;
          confidence_score: number | null;
          created_at: string | null;
          id: string | null;
          is_archived: boolean | null;
          order_id: string | null;
          original_text: string | null;
          product: string | null;
          quantity: number | null;
          supplier_id: string | null;
          unit: Database['public']['Enums']['item_unit'] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_invitation:
        | { Args: { token: string }; Returns: boolean }
        | { Args: { invitation_token: string }; Returns: string };
      archive_old_order_items: { Args: never; Returns: number };
      can_access_order: { Args: { order_id: string }; Returns: boolean };
      create_organization_with_membership:
        | {
            Args: { org_name: string; org_slug: string; user_email: string };
            Returns: string;
          }
        | { Args: { org_name: string; org_slug?: string }; Returns: string };
      generate_unique_slug: { Args: { org_name: string }; Returns: string };
      get_invitation_by_token: {
        Args: { invitation_token: string };
        Returns: {
          email: string;
          expires_at: string;
          invitation_id: string;
          invited_by_name: string;
          is_valid: boolean;
          organization_name: string;
          organization_slug: string;
          role: Database['public']['Enums']['membership_role'];
        }[];
      };
      get_user_organizations:
        | {
            Args: { user_id: string };
            Returns: {
              organization_id: string;
              organization_name: string;
              organization_slug: string;
              user_role: Database['public']['Enums']['membership_role'];
            }[];
          }
        | {
            Args: never;
            Returns: {
              joined_at: string;
              organization_id: string;
              organization_name: string;
              organization_slug: string;
              user_role: Database['public']['Enums']['membership_role'];
            }[];
          };
      get_user_role: {
        Args: { organization_id: string };
        Returns: Database['public']['Enums']['membership_role'];
      };
      is_admin_of: { Args: { org_id: string }; Returns: boolean };
      is_admin_of_order: { Args: { order_id: string }; Returns: boolean };
      is_member_of: { Args: { org_id: string }; Returns: boolean };
    };
    Enums: {
      contact_method: 'email' | 'phone' | 'whatsapp';
      item_unit: 'kg' | 'g' | 'units' | 'dozen' | 'liters' | 'ml' | 'packages' | 'boxes';
      membership_role: 'admin' | 'member';
      order_status: 'draft' | 'review' | 'sending' | 'sent' | 'archived' | 'cancelled';
      processing_status: 'pending' | 'processing' | 'completed' | 'failed';
      supplier_category:
        | 'fruits_vegetables'
        | 'meats'
        | 'fish_seafood'
        | 'dry_goods'
        | 'dairy'
        | 'beverages'
        | 'cleaning'
        | 'packaging'
        | 'other';
      supplier_order_status: 'pending' | 'sending' | 'sent' | 'failed' | 'delivered';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      contact_method: ['email', 'phone', 'whatsapp'],
      item_unit: ['kg', 'g', 'units', 'dozen', 'liters', 'ml', 'packages', 'boxes'],
      membership_role: ['admin', 'member'],
      order_status: ['draft', 'review', 'sending', 'sent', 'archived', 'cancelled'],
      processing_status: ['pending', 'processing', 'completed', 'failed'],
      supplier_category: [
        'fruits_vegetables',
        'meats',
        'fish_seafood',
        'dry_goods',
        'dairy',
        'beverages',
        'cleaning',
        'packaging',
        'other',
      ],
      supplier_order_status: ['pending', 'sending', 'sent', 'failed', 'delivered'],
    },
  },
} as const;
