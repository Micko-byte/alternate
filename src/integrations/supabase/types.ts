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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: number
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target_user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          accuracy_cm: number | null
          bust_cm: number | null
          hips_cm: number | null
          photo_estimate: Json | null
          sources: Json
          tape: Json | null
          updated_at: string
          user_id: string
          waist_cm: number | null
        }
        Insert: {
          accuracy_cm?: number | null
          bust_cm?: number | null
          hips_cm?: number | null
          photo_estimate?: Json | null
          sources?: Json
          tape?: Json | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
        }
        Update: {
          accuracy_cm?: number | null
          bust_cm?: number | null
          hips_cm?: number | null
          photo_estimate?: Json | null
          sources?: Json
          tape?: Json | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
        }
        Relationships: []
      }
      body_photos: {
        Row: {
          angle: Database["public"]["Enums"]["photo_angle"]
          confirmed_self: boolean
          created_at: string
          edit_mask_path: string | null
          face_mask_path: string | null
          height: number | null
          id: string
          is_active: boolean
          mask_eyes_path: string | null
          mask_feet_path: string | null
          mask_head_path: string | null
          mask_jewellery_path: string | null
          mask_lower_path: string | null
          mask_upper_path: string | null
          parts_map_path: string | null
          storage_path: string
          user_id: string
          width: number | null
        }
        Insert: {
          angle: Database["public"]["Enums"]["photo_angle"]
          confirmed_self?: boolean
          created_at?: string
          edit_mask_path?: string | null
          face_mask_path?: string | null
          height?: number | null
          id?: string
          is_active?: boolean
          mask_eyes_path?: string | null
          mask_feet_path?: string | null
          mask_head_path?: string | null
          mask_jewellery_path?: string | null
          mask_lower_path?: string | null
          mask_upper_path?: string | null
          parts_map_path?: string | null
          storage_path: string
          user_id: string
          width?: number | null
        }
        Update: {
          angle?: Database["public"]["Enums"]["photo_angle"]
          confirmed_self?: boolean
          created_at?: string
          edit_mask_path?: string | null
          face_mask_path?: string | null
          height?: number | null
          id?: string
          is_active?: boolean
          mask_eyes_path?: string | null
          mask_feet_path?: string | null
          mask_head_path?: string | null
          mask_jewellery_path?: string | null
          mask_lower_path?: string | null
          mask_upper_path?: string | null
          parts_map_path?: string | null
          storage_path?: string
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      body_profiles: {
        Row: {
          body: Json
          cost_usd: number | null
          photo_ids: string[]
          photos: Json
          summary: string | null
          tips: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: Json
          cost_usd?: number | null
          photo_ids?: string[]
          photos?: Json
          summary?: string | null
          tips?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: Json
          cost_usd?: number | null
          photo_ids?: string[]
          photos?: Json
          summary?: string | null
          tips?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          granted_at: string
          id: string
          policy_version: string
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          granted_at?: string
          id?: string
          policy_version: string
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          consent_type?: Database["public"]["Enums"]["consent_type"]
          granted_at?: string
          id?: string
          policy_version?: string
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          amount: number
          created_at: string
          entry_type: Database["public"]["Enums"]["credit_entry_type"]
          id: string
          note: string | null
          payment_id: string | null
          tryon_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          entry_type: Database["public"]["Enums"]["credit_entry_type"]
          id?: string
          note?: string | null
          payment_id?: string | null
          tryon_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          entry_type?: Database["public"]["Enums"]["credit_entry_type"]
          id?: string
          note?: string | null
          payment_id?: string | null
          tryon_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_tryon_id_fkey"
            columns: ["tryon_id"]
            isOneToOne: false
            referencedRelation: "tryons"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packs: {
        Row: {
          created_at: string
          credits: number
          id: string
          is_active: boolean
          name: string
          price_kes: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          credits: number
          id?: string
          is_active?: boolean
          name: string
          price_kes: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          is_active?: boolean
          name?: string
          price_kes?: number
          sort_order?: number
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          completed_at: string | null
          id: string
          requested_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          requested_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          requested_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_note: string | null
          category: Database["public"]["Enums"]["feedback_category"]
          created_at: string
          id: string
          message: string
          page: string | null
          rating: number | null
          status: Database["public"]["Enums"]["feedback_status"]
          tryon_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          id?: string
          message: string
          page?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["feedback_status"]
          tryon_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          id?: string
          message?: string
          page?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["feedback_status"]
          tryon_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_tryon_id_fkey"
            columns: ["tryon_id"]
            isOneToOne: false
            referencedRelation: "tryons"
            referencedColumns: ["id"]
          },
        ]
      }
      garment_inspections: {
        Row: {
          categories: Database["public"]["Enums"]["garment_category"][]
          cost_usd: number | null
          created_at: string
          garment_upload_id: string | null
          id: string
          is_wearable: boolean
          items: Json
          product_id: string | null
          source_path: string
        }
        Insert: {
          categories?: Database["public"]["Enums"]["garment_category"][]
          cost_usd?: number | null
          created_at?: string
          garment_upload_id?: string | null
          id?: string
          is_wearable?: boolean
          items?: Json
          product_id?: string | null
          source_path: string
        }
        Update: {
          categories?: Database["public"]["Enums"]["garment_category"][]
          cost_usd?: number | null
          created_at?: string
          garment_upload_id?: string | null
          id?: string
          is_wearable?: boolean
          items?: Json
          product_id?: string | null
          source_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "garment_inspections_garment_upload_id_fkey"
            columns: ["garment_upload_id"]
            isOneToOne: true
            referencedRelation: "garment_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garment_inspections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      garment_uploads: {
        Row: {
          category: Database["public"]["Enums"]["garment_category"] | null
          created_at: string
          cutout_path: string | null
          garment_type: string | null
          id: string
          length: string | null
          length_cm: number | null
          size_label: string | null
          source_note: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["garment_category"] | null
          created_at?: string
          cutout_path?: string | null
          garment_type?: string | null
          id?: string
          length?: string | null
          length_cm?: number | null
          size_label?: string | null
          source_note?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["garment_category"] | null
          created_at?: string
          cutout_path?: string | null
          garment_type?: string | null
          id?: string
          length?: string | null
          length_cm?: number | null
          size_label?: string | null
          source_note?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          commission_kes: number
          commission_rate: number
          created_at: string
          delivery_notes: string | null
          delivery_phone: string | null
          id: string
          product_id: string | null
          provider_reference: string | null
          quantity: number
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          total_kes: number
          tryon_id: string | null
          unit_price_kes: number
          updated_at: string
          user_id: string | null
          variant_id: string | null
        }
        Insert: {
          commission_kes: number
          commission_rate: number
          created_at?: string
          delivery_notes?: string | null
          delivery_phone?: string | null
          id?: string
          product_id?: string | null
          provider_reference?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          total_kes: number
          tryon_id?: string | null
          unit_price_kes: number
          updated_at?: string
          user_id?: string | null
          variant_id?: string | null
        }
        Update: {
          commission_kes?: number
          commission_rate?: number
          created_at?: string
          delivery_notes?: string | null
          delivery_phone?: string | null
          id?: string
          product_id?: string | null
          provider_reference?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          total_kes?: number
          tryon_id?: string | null
          unit_price_kes?: number
          updated_at?: string
          user_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tryon_id_fkey"
            columns: ["tryon_id"]
            isOneToOne: false
            referencedRelation: "tryons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_kes: number
          created_at: string
          credit_pack_id: string | null
          credits: number
          id: string
          metadata: Json
          paid_at: string | null
          provider: string
          provider_reference: string
          referral_store_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_plan_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          credit_pack_id?: string | null
          credits: number
          id?: string
          metadata?: Json
          paid_at?: string | null
          provider?: string
          provider_reference: string
          referral_store_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_plan_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          credit_pack_id?: string | null
          credits?: number
          id?: string
          metadata?: Json
          paid_at?: string | null
          provider?: string
          provider_reference?: string
          referral_store_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_plan_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_credit_pack_id_fkey"
            columns: ["credit_pack_id"]
            isOneToOne: false
            referencedRelation: "credit_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_referral_store_id_fkey"
            columns: ["referral_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          created_at: string
          duration_seconds: number | null
          extracted_from: string | null
          height: number | null
          id: string
          is_tryon_source: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          position: number
          product_id: string
          storage_path: string
          store_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          extracted_from?: string | null
          height?: number | null
          id?: string
          is_tryon_source?: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          position?: number
          product_id: string
          storage_path: string
          store_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          extracted_from?: string | null
          height?: number | null
          id?: string
          is_tryon_source?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          position?: number
          product_id?: string
          storage_path?: string
          store_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_extracted_from_fkey"
            columns: ["extracted_from"]
            isOneToOne: false
            referencedRelation: "product_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          product_id: string
          size_label: string
          size_max: number | null
          size_min: number | null
          size_system: Database["public"]["Enums"]["size_system"]
          stock_qty: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          size_label: string
          size_max?: number | null
          size_min?: number | null
          size_system?: Database["public"]["Enums"]["size_system"]
          stock_qty?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          size_label?: string
          size_max?: number | null
          size_min?: number | null
          size_system?: Database["public"]["Enums"]["size_system"]
          stock_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ai_cost_usd: number | null
          ai_draft: Json | null
          category: Database["public"]["Enums"]["garment_category"]
          created_at: string
          department: Database["public"]["Enums"]["department"]
          description: string | null
          garment_notes: string | null
          garment_type: string | null
          id: string
          import_source: string | null
          is_one_of_a_kind: boolean
          length: string | null
          length_cm: number | null
          name: string
          needs_review: boolean
          price_kes: number
          source_caption: string | null
          status: Database["public"]["Enums"]["product_status"]
          store_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          ai_cost_usd?: number | null
          ai_draft?: Json | null
          category: Database["public"]["Enums"]["garment_category"]
          created_at?: string
          department?: Database["public"]["Enums"]["department"]
          description?: string | null
          garment_notes?: string | null
          garment_type?: string | null
          id?: string
          import_source?: string | null
          is_one_of_a_kind?: boolean
          length?: string | null
          length_cm?: number | null
          name: string
          needs_review?: boolean
          price_kes: number
          source_caption?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          store_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          ai_cost_usd?: number | null
          ai_draft?: Json | null
          category?: Database["public"]["Enums"]["garment_category"]
          created_at?: string
          department?: Database["public"]["Enums"]["department"]
          description?: string | null
          garment_notes?: string | null
          garment_type?: string | null
          id?: string
          import_source?: string | null
          is_one_of_a_kind?: boolean
          length?: string | null
          length_cm?: number | null
          name?: string
          needs_review?: boolean
          price_kes?: number
          source_caption?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          store_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          height_cm: number | null
          id: string
          phone: string | null
          preferred_fit: Database["public"]["Enums"]["fit_style"]
          shops_for: Database["public"]["Enums"]["shops_for"] | null
          tryon_limit: number | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          height_cm?: number | null
          id: string
          phone?: string | null
          preferred_fit?: Database["public"]["Enums"]["fit_style"]
          shops_for?: Database["public"]["Enums"]["shops_for"] | null
          tryon_limit?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          height_cm?: number | null
          id?: string
          phone?: string | null
          preferred_fit?: Database["public"]["Enums"]["fit_style"]
          shops_for?: Database["public"]["Enums"]["shops_for"] | null
          tryon_limit?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      referral_earnings: {
        Row: {
          amount_kes: number
          created_at: string
          id: string
          payment_id: string
          payout_id: string | null
          rate: number
          store_id: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          id?: string
          payment_id: string
          payout_id?: string | null
          rate: number
          store_id: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          id?: string
          payment_id?: string
          payout_id?: string | null
          rate?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_earnings_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_earnings_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "store_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_earnings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          referred_user_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          referred_user_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          referred_user_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          product_id: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          store_id: string | null
          tryon_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          product_id?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          store_id?: string | null
          tryon_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          product_id?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          store_id?: string | null
          tryon_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_tryon_id_fkey"
            columns: ["tryon_id"]
            isOneToOne: false
            referencedRelation: "tryons"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_products: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      size_alerts: {
        Row: {
          created_at: string
          id: string
          notified_at: string | null
          product_id: string
          size_system: Database["public"]["Enums"]["size_system"]
          size_value: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notified_at?: string | null
          product_id: string
          size_system?: Database["public"]["Enums"]["size_system"]
          size_value: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notified_at?: string | null
          product_id?: string
          size_system?: Database["public"]["Enums"]["size_system"]
          size_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "size_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_finance: {
        Row: {
          commission_rate: number
          payout_phone: string | null
          paystack_subaccount_code: string | null
          referral_rate: number
          store_id: string
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          payout_phone?: string | null
          paystack_subaccount_code?: string | null
          referral_rate?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          payout_phone?: string | null
          paystack_subaccount_code?: string | null
          referral_rate?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_finance_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["store_member_role"]
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["store_member_role"]
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["store_member_role"]
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payouts: {
        Row: {
          amount_kes: number
          failure_reason: string | null
          id: string
          paid_at: string | null
          provider_reference: string | null
          requested_at: string
          status: Database["public"]["Enums"]["payout_status"]
          store_id: string
        }
        Insert: {
          amount_kes: number
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          provider_reference?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          store_id: string
        }
        Update: {
          amount_kes?: number
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          provider_reference?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscription_payments: {
        Row: {
          amount_kes: number
          created_at: string
          id: string
          period_end: string
          period_start: string
          plan: Database["public"]["Enums"]["store_plan"]
          provider_reference: string
          status: Database["public"]["Enums"]["payment_status"]
          store_id: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          plan: Database["public"]["Enums"]["store_plan"]
          provider_reference: string
          status?: Database["public"]["Enums"]["payment_status"]
          store_id: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          plan?: Database["public"]["Enums"]["store_plan"]
          provider_reference?: string
          status?: Database["public"]["Enums"]["payment_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscription_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          bio: string | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          id: string
          instagram_handle: string | null
          location: string | null
          logo_path: string | null
          name: string
          plan: Database["public"]["Enums"]["store_plan"]
          plan_renews_at: string | null
          referral_code: string
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          tiktok_handle: string | null
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          bio?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instagram_handle?: string | null
          location?: string | null
          logo_path?: string | null
          name: string
          plan?: Database["public"]["Enums"]["store_plan"]
          plan_renews_at?: string | null
          referral_code?: string
          slug: string
          status?: Database["public"]["Enums"]["store_status"]
          tiktok_handle?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          bio?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instagram_handle?: string | null
          location?: string | null
          logo_path?: string | null
          name?: string
          plan?: Database["public"]["Enums"]["store_plan"]
          plan_renews_at?: string | null
          referral_code?: string
          slug?: string
          status?: Database["public"]["Enums"]["store_status"]
          tiktok_handle?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          blurb: string | null
          code: string
          created_at: string
          daily_limit: number | null
          id: string
          is_active: boolean
          monthly_credits: number
          name: string
          period_days: number
          price_kes: number
          sort_order: number
        }
        Insert: {
          blurb?: string | null
          code: string
          created_at?: string
          daily_limit?: number | null
          id?: string
          is_active?: boolean
          monthly_credits: number
          name: string
          period_days?: number
          price_kes: number
          sort_order?: number
        }
        Update: {
          blurb?: string | null
          code?: string
          created_at?: string
          daily_limit?: number | null
          id?: string
          is_active?: boolean
          monthly_credits?: number
          name?: string
          period_days?: number
          price_kes?: number
          sort_order?: number
        }
        Relationships: []
      }
      tryon_prices: {
        Row: {
          credits: number
          quality: Database["public"]["Enums"]["tryon_quality"]
        }
        Insert: {
          credits: number
          quality: Database["public"]["Enums"]["tryon_quality"]
        }
        Update: {
          credits?: number
          quality?: Database["public"]["Enums"]["tryon_quality"]
        }
        Relationships: []
      }
      tryons: {
        Row: {
          attempts: number
          body_photo_id: string
          completed_at: string | null
          cost_usd: number | null
          created_at: string
          credits_charged: number
          edit_mask_path: string | null
          engine: string | null
          error_message: string | null
          feedback: string | null
          fit: Database["public"]["Enums"]["fit_style"]
          garment_instruction: string | null
          garment_type: string | null
          garment_upload_id: string | null
          id: string
          identity_score: number | null
          product_id: string | null
          qa: Json | null
          quality: Database["public"]["Enums"]["tryon_quality"]
          rating: number | null
          reference_photo_ids: string[]
          result_path: string | null
          shared_path: string | null
          size_label: string | null
          size_system: Database["public"]["Enums"]["size_system"] | null
          size_value: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["tryon_status"]
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          body_photo_id: string
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string
          credits_charged?: number
          edit_mask_path?: string | null
          engine?: string | null
          error_message?: string | null
          feedback?: string | null
          fit?: Database["public"]["Enums"]["fit_style"]
          garment_instruction?: string | null
          garment_type?: string | null
          garment_upload_id?: string | null
          id?: string
          identity_score?: number | null
          product_id?: string | null
          qa?: Json | null
          quality?: Database["public"]["Enums"]["tryon_quality"]
          rating?: number | null
          reference_photo_ids?: string[]
          result_path?: string | null
          shared_path?: string | null
          size_label?: string | null
          size_system?: Database["public"]["Enums"]["size_system"] | null
          size_value?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["tryon_status"]
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          body_photo_id?: string
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string
          credits_charged?: number
          edit_mask_path?: string | null
          engine?: string | null
          error_message?: string | null
          feedback?: string | null
          fit?: Database["public"]["Enums"]["fit_style"]
          garment_instruction?: string | null
          garment_type?: string | null
          garment_upload_id?: string | null
          id?: string
          identity_score?: number | null
          product_id?: string | null
          qa?: Json | null
          quality?: Database["public"]["Enums"]["tryon_quality"]
          rating?: number | null
          reference_photo_ids?: string[]
          result_path?: string | null
          shared_path?: string | null
          size_label?: string | null
          size_system?: Database["public"]["Enums"]["size_system"] | null
          size_value?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["tryon_status"]
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tryons_body_photo_id_fkey"
            columns: ["body_photo_id"]
            isOneToOne: false
            referencedRelation: "body_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tryons_garment_upload_id_fkey"
            columns: ["garment_upload_id"]
            isOneToOne: false
            referencedRelation: "garment_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tryons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tryons_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sizes: {
        Row: {
          category: Database["public"]["Enums"]["garment_category"]
          size_system: Database["public"]["Enums"]["size_system"]
          size_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["garment_category"]
          size_system?: Database["public"]["Enums"]["size_system"]
          size_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["garment_category"]
          size_system?: Database["public"]["Enums"]["size_system"]
          size_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          credits_total: number
          credits_used: number
          daily_limit: number | null
          ends_at: string
          id: string
          payment_id: string | null
          plan_id: string
          starts_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_total: number
          credits_used?: number
          daily_limit?: number | null
          ends_at: string
          id?: string
          payment_id?: string | null
          plan_id: string
          starts_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_total?: number
          credits_used?: number
          daily_limit?: number | null
          ends_at?: string
          id?: string
          payment_id?: string | null
          plan_id?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
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
      [_ in never]: never
    }
    Functions: {
      admin_feedback: {
        Args: never
        Returns: {
          admin_note: string
          category: string
          created_at: string
          id: string
          message: string
          page: string
          rating: number
          status: string
          tryon_id: string
          user_email: string
        }[]
      }
      admin_grant_credits: {
        Args: { _credits: number; _email: string; _note?: string }
        Returns: number
      }
      admin_list_admins: {
        Args: never
        Returns: {
          email: string
          roles: string[]
          user_id: string
        }[]
      }
      admin_overview: { Args: { _days?: number }; Returns: Json }
      admin_reports: {
        Args: never
        Returns: {
          created_at: string
          details: string
          id: string
          product_id: string
          reason: string
          reporter_email: string
          status: string
          store_id: string
          tryon_id: string
        }[]
      }
      admin_set_setting: {
        Args: { _key: string; _value: Json }
        Returns: undefined
      }
      admin_set_store_status: {
        Args: {
          _status: Database["public"]["Enums"]["store_status"]
          _store_id: string
        }
        Returns: undefined
      }
      admin_set_tryon_limit: {
        Args: { _limit: number; _user_id: string }
        Returns: undefined
      }
      admin_tryons: {
        Args: {
          _limit?: number
          _offset?: number
          _status?: Database["public"]["Enums"]["tryon_status"]
        }
        Returns: {
          cost_usd: number
          created_at: string
          credits_charged: number
          engine: string
          error_message: string
          fit: string
          garment_path: string
          id: string
          product_name: string
          quality: string
          rating: number
          result_path: string
          status: string
          store_name: string
          user_email: string
          user_id: string
        }[]
      }
      admin_users: {
        Args: { _search?: string }
        Returns: {
          banned_until: string
          cost_usd: number
          created_at: string
          credits: number
          display_name: string
          email: string
          feedback_count: number
          id: string
          last_sign_in_at: string
          roles: string[]
          shops_for: string
          store_name: string
          tryon_limit: number
          tryons: number
          tryons_succeeded: number
        }[]
      }
      complete_payment: {
        Args: { _provider_reference: string }
        Returns: {
          amount_kes: number
          created_at: string
          credit_pack_id: string | null
          credits: number
          id: string
          metadata: Json
          paid_at: string | null
          provider: string
          provider_reference: string
          referral_store_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_plan_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credit_balance: { Args: never; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      my_tryon_allowance: { Args: never; Returns: Json }
      my_wallet: { Args: never; Returns: Json }
      owner_set_admin: {
        Args: { _email: string; _grant: boolean }
        Returns: undefined
      }
      refund_tryon: {
        Args: { _reason: string; _tryon_id: string }
        Returns: undefined
      }
      request_tryon: {
        Args: {
          _body_photo_id: string
          _fit?: Database["public"]["Enums"]["fit_style"]
          _garment_upload_id?: string
          _product_id?: string
          _quality?: Database["public"]["Enums"]["tryon_quality"]
        }
        Returns: {
          attempts: number
          body_photo_id: string
          completed_at: string | null
          cost_usd: number | null
          created_at: string
          credits_charged: number
          edit_mask_path: string | null
          engine: string | null
          error_message: string | null
          feedback: string | null
          fit: Database["public"]["Enums"]["fit_style"]
          garment_instruction: string | null
          garment_type: string | null
          garment_upload_id: string | null
          id: string
          identity_score: number | null
          product_id: string | null
          qa: Json | null
          quality: Database["public"]["Enums"]["tryon_quality"]
          rating: number | null
          reference_photo_ids: string[]
          result_path: string | null
          shared_path: string | null
          size_label: string | null
          size_system: Database["public"]["Enums"]["size_system"] | null
          size_value: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["tryon_status"]
          subscription_id: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tryons"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      store_size_demand: {
        Args: { _store_id: string }
        Returns: {
          product_id: string
          product_name: string
          size_system: Database["public"]["Enums"]["size_system"]
          size_value: number
          waiting: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "owner"
      consent_type:
        | "terms"
        | "privacy_policy"
        | "body_photo_processing"
        | "cross_border_transfer"
        | "marketing"
      credit_entry_type:
        | "purchase"
        | "tryon_charge"
        | "tryon_refund"
        | "adjustment"
      department: "women" | "men" | "unisex"
      feedback_category:
        | "tryon_quality"
        | "idea"
        | "bug"
        | "stores"
        | "payments"
        | "other"
      feedback_status: "new" | "read" | "planned" | "done"
      fit_style: "fitted" | "regular" | "relaxed" | "oversized" | "baggy"
      garment_category:
        | "dress"
        | "top"
        | "bottom"
        | "skirt"
        | "jumpsuit"
        | "outerwear"
        | "set"
        | "other"
        | "shoes"
        | "eyewear"
        | "headwear"
        | "jewellery"
      media_kind: "image" | "video"
      order_status:
        | "pending_payment"
        | "paid"
        | "fulfilled"
        | "cancelled"
        | "refunded"
      payment_status: "pending" | "success" | "failed" | "refunded"
      payout_status: "pending" | "processing" | "paid" | "failed"
      photo_angle: "front" | "back" | "side"
      product_status: "draft" | "active" | "sold_out" | "archived"
      report_reason:
        | "not_me"
        | "inappropriate"
        | "offensive"
        | "copyright"
        | "other"
      report_status: "open" | "reviewing" | "actioned" | "dismissed"
      shops_for: "women" | "men" | "both"
      size_system: "uk_women" | "letter" | "waist_in"
      store_member_role: "owner" | "staff"
      store_plan: "free" | "pro"
      store_status: "pending" | "active" | "suspended"
      tryon_quality: "standard" | "hd" | "studio"
      tryon_status:
        | "queued"
        | "processing"
        | "succeeded"
        | "failed"
        | "rejected"
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
      app_role: ["admin", "moderator", "owner"],
      consent_type: [
        "terms",
        "privacy_policy",
        "body_photo_processing",
        "cross_border_transfer",
        "marketing",
      ],
      credit_entry_type: [
        "purchase",
        "tryon_charge",
        "tryon_refund",
        "adjustment",
      ],
      department: ["women", "men", "unisex"],
      feedback_category: [
        "tryon_quality",
        "idea",
        "bug",
        "stores",
        "payments",
        "other",
      ],
      feedback_status: ["new", "read", "planned", "done"],
      fit_style: ["fitted", "regular", "relaxed", "oversized", "baggy"],
      garment_category: [
        "dress",
        "top",
        "bottom",
        "skirt",
        "jumpsuit",
        "outerwear",
        "set",
        "other",
        "shoes",
        "eyewear",
        "headwear",
        "jewellery",
      ],
      media_kind: ["image", "video"],
      order_status: [
        "pending_payment",
        "paid",
        "fulfilled",
        "cancelled",
        "refunded",
      ],
      payment_status: ["pending", "success", "failed", "refunded"],
      payout_status: ["pending", "processing", "paid", "failed"],
      photo_angle: ["front", "back", "side"],
      product_status: ["draft", "active", "sold_out", "archived"],
      report_reason: [
        "not_me",
        "inappropriate",
        "offensive",
        "copyright",
        "other",
      ],
      report_status: ["open", "reviewing", "actioned", "dismissed"],
      shops_for: ["women", "men", "both"],
      size_system: ["uk_women", "letter", "waist_in"],
      store_member_role: ["owner", "staff"],
      store_plan: ["free", "pro"],
      store_status: ["pending", "active", "suspended"],
      tryon_quality: ["standard", "hd", "studio"],
      tryon_status: ["queued", "processing", "succeeded", "failed", "rejected"],
    },
  },
} as const
