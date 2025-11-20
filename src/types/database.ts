export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
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
      orders: {
        Row: {
          audio_url: string | null;
          created_at: string;
          created_by: string;
          id: string;
          organization_id: string;
          status: Database['public']['Enums']['order_status'];
          transcription: string | null;
          updated_at: string;
        };
        Insert: {
          audio_url?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          organization_id: string;
          status?: Database['public']['Enums']['order_status'];
          transcription?: string | null;
          updated_at?: string;
        };
        Update: {
          audio_url?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          organization_id?: string;
          status?: Database['public']['Enums']['order_status'];
          transcription?: string | null;
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
          preferred_contact_method: Database['public']['Enums']['contact_method'];
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: {
        Args: {
          token_uuid: string;
        };
        Returns: string;
      };
      archive_old_order_items: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      can_access_order: {
        Args: {
          order_uuid: string;
        };
        Returns: boolean;
      };
      create_organization_with_membership: {
        Args: {
          org_name: string;
          org_slug: string;
        };
        Returns: string;
      };
      generate_unique_slug: {
        Args: {
          base_name: string;
        };
        Returns: string;
      };
      get_invitation_by_token: {
        Args: {
          token_uuid: string;
        };
        Returns: {
          id: string;
          email: string;
          role: Database['public']['Enums']['membership_role'];
          organization_id: string;
          organization_name: string;
          invited_by_name: string;
        }[];
      };
      get_user_organizations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          organization_id: string;
          organization_name: string;
          organization_slug: string;
          user_role: Database['public']['Enums']['membership_role'];
          joined_at: string;
        }[];
      };
      get_user_role: {
        Args: {
          org_id: string;
        };
        Returns: Database['public']['Enums']['membership_role'];
      };
      handle_invitation_after_profile: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      handle_new_user_invitations: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      is_admin_of: {
        Args: {
          org_id: string;
        };
        Returns: boolean;
      };
      is_admin_of_order: {
        Args: {
          order_uuid: string;
        };
        Returns: boolean;
      };
      is_member_of: {
        Args: {
          org_id: string;
        };
        Returns: boolean;
      };
      update_updated_at_column: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      contact_method: 'email' | 'whatsapp' | 'phone';
      item_unit: 'kg' | 'g' | 'units' | 'dozen' | 'liters' | 'ml' | 'packages' | 'boxes';
      membership_role: 'admin' | 'member';
      order_status: 'draft' | 'review' | 'sent' | 'archived';
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
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
