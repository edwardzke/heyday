import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";


export type PlantCatalogItem = {
  id: string;
  perenual_id: number | null;
  common_name: string | null;
  scientific_name: string | null;
  description: string | null;
  watering_general_benchmark: string | null;
  watering_interval_days: number | null;
  sunlight: string | null;
  maintenance_category: string | null;
  soil_type: string | null;
  poison_human: boolean | null;
  poison_pets: boolean | null;
  default_image_url: string | null;
  care_notes: string | null;
  created_at: string;
};

export function usePlantsCatalog() {
  const [plants, setPlants] = useState<PlantCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlants = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("plants")
      .select("*")
      .order("common_name", { ascending: true });

    if (error) {
      console.error("Error fetching plants catalog:", error);
    } else {
      setPlants(data as PlantCatalogItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  return { plants, loading, refetch: fetchPlants };
}
