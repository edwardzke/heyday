import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useSupabaseUser } from "./useSupabaseUser";

export type PlantRecommendation = {
  id: string;
  user_id: string;
  plant_id: string | null;
  floorplan_id: string;
  source: string | null;
  score: number | null;
  reason: string | null;
  recommended_location: any;
  status: "pending" | "accepted" | "dismissed";
  created_at: string;
  accepted_at: string | null;
  dismissed_at: string | null;
};

export function usePlantRecommendations(floorplanId: string | null) {
  const { user, loading: userLoading } = useSupabaseUser();
  const [recs, setRecs] = useState<PlantRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecs = useCallback(async () => {
    if (!user || !floorplanId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("plant_recommendations")
      .select("*")
      .eq("floorplan_id", floorplanId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching plant_recommendations:", error);
    } else {
      setRecs(data as PlantRecommendation[]);
    }
    setLoading(false);
  }, [user, floorplanId]);

  useEffect(() => {
    if (!userLoading && user && floorplanId) {
      fetchRecs();
    }
  }, [userLoading, user, floorplanId, fetchRecs]);

  const addRecommendation = useCallback(
    async (input: {
      plant_id?: string | null;
      source?: string;
      score?: number;
      reason?: string;
      recommended_location?: any;
    }) => {
      if (!user || !floorplanId) throw new Error("No user or floorplan");

      const payload = {
        user_id: user.id,
        floorplan_id: floorplanId,
        status: "pending",
        ...input,
      };

      const { data, error } = await supabase
        .from("plant_recommendations")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Error inserting recommendation:", error);
        throw error;
      }

      setRecs((prev) => [data as PlantRecommendation, ...prev]);
      return data as PlantRecommendation;
    },
    [user, floorplanId]
  );

  const updateRecommendation = useCallback(
    async (id: string, updates: Partial<PlantRecommendation>) => {
      const { data, error } = await supabase
        .from("plant_recommendations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating recommendation:", error);
        throw error;
      }

      setRecs((prev) =>
        prev.map((r) => (r.id === id ? (data as PlantRecommendation) : r))
      );
      return data as PlantRecommendation;
    },
    []
  );

  const deleteRecommendation = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("plant_recommendations")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("Error deleting recommendation:", error);
      throw error;
    }
    setRecs((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return {
    recs,
    loading: loading || userLoading,
    refetch: fetchRecs,
    addRecommendation,
    updateRecommendation,
    deleteRecommendation,
  };
}
