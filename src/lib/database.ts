import type { Database } from "@/integrations/supabase/types";

// These tables are defined in migrations 0002 and 0003. Keep their types
// separate until the managed schema generator includes those migrations.
type SiteCopy = { key: string; value: string; updated_at: string };
type SongRequest = {
  id: string;
  guest_id: string;
  spotify_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  created_at: string;
};

type DiscountCode = {
  id: string;
  code: string;
  kind: "free" | "percent";
  value: number;
  max_uses: number;
  uses: number;
  active: boolean;
  note: string | null;
  created_at: string;
};

type GuestExtra = { discount_code_id: string | null; discount_applied_at: string | null; notes: string | null; manual_bar: boolean; added_by_admin: boolean; share_code: string | null; hosts: string[]; extras: number; extra_names: string[]; confirmed_at: string | null; referrer_name: string | null };
type GuestsTable = Database["public"]["Tables"]["guests"];

export type AppDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "guests"> & {
      guests: Omit<GuestsTable, "Row" | "Insert" | "Update"> & {
        Row: GuestsTable["Row"] & GuestExtra;
        Insert: GuestsTable["Insert"] & Partial<GuestExtra>;
        Update: GuestsTable["Update"] & Partial<GuestExtra>;
      };
      discount_codes: {
        Row: DiscountCode;
        Insert: Pick<DiscountCode, "code" | "kind"> & Partial<Omit<DiscountCode, "code" | "kind">>;
        Update: Partial<DiscountCode>;
        Relationships: [];
      };
      site_copy: {
        Row: SiteCopy;
        Insert: Pick<SiteCopy, "key" | "value"> & Partial<Pick<SiteCopy, "updated_at">>;
        Update: Partial<SiteCopy>;
        Relationships: [];
      };
      song_requests: {
        Row: SongRequest;
        Insert: Omit<SongRequest, "id" | "created_at" | "cover_url"> & Partial<Pick<SongRequest, "id" | "created_at" | "cover_url">>;
        Update: Partial<SongRequest>;
        Relationships: [{
          foreignKeyName: "song_requests_guest_id_fkey";
          columns: ["guest_id"];
          isOneToOne: false;
          referencedRelation: "guests";
          referencedColumns: ["id"];
        }];
      };
    };
  };
};