"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

// Shows whether the browser can reach the API (CORS, ports, database). Temporary: the
// foundation's smoke test reads it until real pages exist.
export function ApiStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/health");
      if (error || !data) throw new Error("API unreachable");
      return data;
    },
    retry: false,
  });

  let label = "Checking API…";
  if (isError) label = "API unreachable";
  else if (!isPending) label = `API ${data.status} · PostGIS ${data.postgis}`;

  return (
    <p data-testid="api-status" className="text-sm text-neutral-500">
      {label}
    </p>
  );
}
