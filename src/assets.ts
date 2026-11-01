import type { Manifest, BuildingsDoc, RoadsDoc } from "./types";

const BASE = import.meta.env.BASE_URL || "/";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}data/${path}`);
  if (!res.ok) throw new Error(`Failed to load data/${path}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export interface WorldData {
  manifest: Manifest;
  buildings: BuildingsDoc;
  roads: RoadsDoc;
}

export async function loadWorldData(
  onProgress?: (msg: string, frac: number) => void,
): Promise<WorldData> {
  onProgress?.("Loading map manifest…", 0.1);
  const manifest = await getJSON<Manifest>("manifest.json");

  onProgress?.(`Loading ${manifest.counts.buildings} buildings…`, 0.35);
  const buildings = await getJSON<BuildingsDoc>("buildings.json");

  onProgress?.(`Loading ${manifest.counts.roads} roads…`, 0.65);
  const roads = await getJSON<RoadsDoc>("roads.json");

  onProgress?.("Building the city…", 0.8);
  return { manifest, buildings, roads };
}
