import { useEffect, useRef, useState } from "react";
import { ZIP_LOOKUP_ENDPOINT, ZIP_LOOKUP_USER_AGENT } from "../config/geocode";

export type GeocodeResult = {
  lat: number;
  lon: number;
  displayName: string;
};

export type ForwardGeocodeStatus = "idle" | "loading" | "success" | "error";

const cache = new Map<string, GeocodeResult[]>();

/**
 * useForwardGeocode
 *
 * Searches Nominatim for a place name (city, state, country)
 * and returns up to 5 matching coordinates.
 */
export function useForwardGeocode(query: string): {
  results: GeocodeResult[];
  status: ForwardGeocodeStatus;
} {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [status, setStatus] = useState<ForwardGeocodeStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }

    if (cache.has(trimmed)) {
      setResults(cache.get(trimmed)!);
      setStatus("success");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");

    const url = `${ZIP_LOOKUP_ENDPOINT}?q=${encodeURIComponent(trimmed)}&format=json&limit=5&accept-language=en`;

    fetch(url, {
      headers: { "User-Agent": ZIP_LOOKUP_USER_AGENT },
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Forward geocode failed");
        return res.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const parsed: GeocodeResult[] = (Array.isArray(data) ? data : [])
          .map((item: any) => ({
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            displayName: item.display_name ?? "Unknown",
          }))
          .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));

        cache.set(trimmed, parsed);
        setResults(parsed);
        setStatus("success");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setResults([]);
        setStatus("error");
      });

    return () => controller.abort();
  }, [query]);

  return { results, status };
}
