import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSupabaseUser } from "./useSupabaseUser";

export type UserPlant = {
  id: string;
  user_id: string;
  plant_id: string | null;
  floorplan_id: string;
  nickname: string | null;
  notes: string | null;
  x_coord: number | null;
  y_coord: number | null;
  location_meta: any;
  started_at: string | null;
  watering_frequency_days: number | null;
  last_watered_at: string | null;
  next_water_at: string | null;
  photos: any[];
  created_at: string;
};

export function useUserPlants(floorplanId: string | null) {
  const { user, loading: userLoading } = useSupabaseUser();
  const [plants, setPlants] = useState<UserPlant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlants = useCallback(async () => {
    if (!user || !floorplanId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("user_plants")
      .select("*")
      .eq("floorplan_id", floorplanId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching user_plants:", error);
    } else {
      setPlants(data as UserPlant[]);
    }
    setLoading(false);
  }, [user, floorplanId]);

  useEffect(() => {
    if (!userLoading && user && floorplanId) {
      fetchPlants();
    }
  }, [userLoading, user, floorplanId, fetchPlants]);

  const addPlant = useCallback(
    async (input: {
      plant_id?: string | null;
      nickname?: string;
      notes?: string;
      x_coord?: number;
      y_coord?: number;
      location_meta?: any;
      started_at?: string;
      watering_frequency_days?: number;
    }) => {
      if (!user || !floorplanId) throw new Error("No user or floorplan");

      const payload = {
        user_id: user.id,
        floorplan_id: floorplanId,
        photos: [],
        ...input,
      };

      const { data, error } = await supabase
        .from("user_plants")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Error inserting user_plant:", error);
        throw error;
      }

      setPlants((prev) => [data as UserPlant, ...prev]);
      return data as UserPlant;
    },
    [user, floorplanId]
  );

  const updatePlant = useCallback(
    async (id: string, updates: Partial<UserPlant>) => {
      const { data, error } = await supabase
        .from("user_plants")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating user_plant:", error);
        throw error;
      }

      setPlants((prev) =>
        prev.map((p) => (p.id === id ? (data as UserPlant) : p))
      );
      return data as UserPlant;
    },
    []
  );

  const deletePlant = useCallback(async (id: string) => {
    const { error } = await supabase.from("user_plants").delete().eq("id", id);
    if (error) {
      console.error("Error deleting user_plant:", error);
      throw error;
    }
    setPlants((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    plants,
    loading: loading || userLoading,
    refetch: fetchPlants,
    addPlant,
    updatePlant,
    deletePlant,
  };
}
