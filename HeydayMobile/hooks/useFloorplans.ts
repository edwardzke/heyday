import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSupabaseUser } from "./useSupabaseUser";

export type Floorplan = {
  id: string;
  user_id: string;
  name: string | null;
  roomplan_json: any;
  created_at: string;
};

export function useFloorplans() {
  const { user, loading: userLoading } = useSupabaseUser();
  const [floorplans, setFloorplans] = useState<Floorplan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFloorplans = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("floorplans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching floorplans:", error);
    } else {
      setFloorplans(data as Floorplan[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!userLoading && user) {
      fetchFloorplans();
    }
  }, [userLoading, user, fetchFloorplans]);

  const createFloorplan = useCallback(
    async (name: string, roomplanJson: any) => {
      if (!user) throw new Error("No user");
      const { data, error } = await supabase
        .from("floorplans")
        .insert({
          user_id: user.id,
          name,
          roomplan_json: roomplanJson,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating floorplan:", error);
        throw error;
      }

      setFloorplans((prev) => [data as Floorplan, ...prev]);
      return data as Floorplan;
    },
    [user]
  );

  const updateFloorplan = useCallback(
    async (id: string, updates: Partial<Pick<Floorplan, "name" | "roomplan_json">>) => {
      const { data, error } = await supabase
        .from("floorplans")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating floorplan:", error);
        throw error;
      }

      setFloorplans((prev) =>
        prev.map((fp) => (fp.id === id ? (data as Floorplan) : fp))
      );
      return data as Floorplan;
    },
    []
  );

  const deleteFloorplan = useCallback(async (id: string) => {
    const { error } = await supabase.from("floorplans").delete().eq("id", id);
    if (error) {
      console.error("Error deleting floorplan:", error);
      throw error;
    }
    setFloorplans((prev) => prev.filter((fp) => fp.id !== id));
  }, []);

  return {
    floorplans,
    loading: loading || userLoading,
    refetch: fetchFloorplans,
    createFloorplan,
    updateFloorplan,
    deleteFloorplan,
  };
}
