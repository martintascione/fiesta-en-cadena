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

export type AppDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
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