export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
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
      suppliers: {
        Row: {
          address: string | null;
          category: Database['public']['Enums']['supplier_category'];
          created_at: string;
          custom_keywords: string[];
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
      archive_old_order_items: { Args: Record<PropertyKey, never>; Returns: number };
      can_access_order: { Args: { order_id: string }; Returns: boolean };
      is_admin_of: { Args: { org_id: string }; Returns: boolean };
      is_admin_of_order: { Args: { order_id: string }; Returns: boolean };
      is_member_of: { Args: { org_id: string }; Returns: boolean };
    };
    Enums: {
      contact_method: 'email';
      item_unit: 'kg' | 'g' | 'units' | 'dozen' | 'liters' | 'ml' | 'packages' | 'boxes';
      membership_role: 'admin' | 'member';
      order_status: 'draft' | 'review' | 'sent' | 'archived';
      supplier_category:
        | 'fruits_vegetables'
        | 'meats'
        | 'fish_seafood'
        | 'dry_goods'
        | 'dairy'
        | 'beverages';
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
