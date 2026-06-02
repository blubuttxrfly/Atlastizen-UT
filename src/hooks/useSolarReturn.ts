import { useCallback, useEffect, useState } from "react";

const SOLAR_RETURN_KEY_V1 = "aut-solar-return";
const SOLAR_RETURN_KEY_V2 = "aut-solar-returns-v2";

export type SolarReturnProfile = {
  id: string;
  name: string;
  birthMonth: number; // 0-11
  birthDay: number;   // 1-31
  birthYear?: number;
  birthHour?: number;   // 0-23
  birthMinute?: number; // 0-59
  birthTimezoneOffset?: number; // minutes offset from UTC (e.g., -300 for EST)
  birthLat: number;
  birthLon: number;
  birthPlaceLabel: string;
};

export type SolarReturnStore = {
  version: 2;
  activeId: string | null;
  profiles: SolarReturnProfile[];
};

/* ── Sacred helpers ───────────────────────────────────────────────────────── */

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function migrateV1(): SolarReturnStore | null {
  try {
    const raw = localStorage.getItem(SOLAR_RETURN_KEY_V1);
    if (!raw) return null;
    const old = JSON.parse(raw) as {
      birthMonth: number;
      birthDay: number;
      birthYear?: number;
      birthHour?: number;
      birthMinute?: number;
      birthLat: number;
      birthLon: number;
      birthPlaceLabel: string;
    };
    const profile: SolarReturnProfile = {
      id: generateId(),
      name: "My Solar Return",
      ...old,
    };
    const store: SolarReturnStore = {
      version: 2,
      activeId: profile.id,
      profiles: [profile],
    };
    // Write new format, keep old as backup
    localStorage.setItem(SOLAR_RETURN_KEY_V2, JSON.stringify(store));
    return store;
  } catch {
    return null;
  }
}

function readStore(): SolarReturnStore {
  // Try new format first
  try {
    const raw = localStorage.getItem(SOLAR_RETURN_KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw) as SolarReturnStore;
      if (parsed.version === 2 && Array.isArray(parsed.profiles)) {
        return parsed;
      }
    }
  } catch {
    /* ignore corrupt v2 */
  }

  // Try migrate from v1
  const migrated = migrateV1();
  if (migrated) return migrated;

  // Fresh start
  return { version: 2, activeId: null, profiles: [] };
}

function writeStore(store: SolarReturnStore) {
  try {
    localStorage.setItem(SOLAR_RETURN_KEY_V2, JSON.stringify(store));
  } catch {
    // ignore storage errors (e.g., private mode, quota exceeded)
  }
}

/* ── Hook ───────────────────────────────────────────────────────────────── */

export function useSolarReturn(): {
  profiles: SolarReturnProfile[];
  activeProfile: SolarReturnProfile | null;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  addProfile: (p: Omit<SolarReturnProfile, "id">) => void;
  updateProfile: (id: string, patch: Partial<Omit<SolarReturnProfile, "id">>) => void;
  removeProfile: (id: string) => void;
  reorderProfiles: (ids: string[]) => void;
} {
  const [store, setStore] = useState<SolarReturnStore>(readStore);

  const persist = useCallback((next: SolarReturnStore) => {
    writeStore(next);
    setStore(next);
  }, []);

  const setActiveId = useCallback(
    (id: string | null) => {
      persist({ ...store, activeId: id });
    },
    [store, persist]
  );

  const addProfile = useCallback(
    (p: Omit<SolarReturnProfile, "id">) => {
      const profile: SolarReturnProfile = { ...p, id: generateId() };
      const next: SolarReturnStore = {
        ...store,
        profiles: [...store.profiles, profile],
        activeId: store.activeId ?? profile.id,
      };
      persist(next);
    },
    [store, persist]
  );

  const updateProfile = useCallback(
    (id: string, patch: Partial<Omit<SolarReturnProfile, "id">>) => {
      const next: SolarReturnStore = {
        ...store,
        profiles: store.profiles.map((p) =>
          p.id === id ? { ...p, ...patch } : p
        ),
      };
      persist(next);
    },
    [store, persist]
  );

  const removeProfile = useCallback(
    (id: string) => {
      const remaining = store.profiles.filter((p) => p.id !== id);
      const next: SolarReturnStore = {
        ...store,
        profiles: remaining,
        activeId: store.activeId === id ? (remaining[0]?.id ?? null) : store.activeId,
      };
      persist(next);
    },
    [store, persist]
  );

  const reorderProfiles = useCallback(
    (ids: string[]) => {
      const map = new Map(store.profiles.map((p) => [p.id, p]));
      const ordered = ids.map((id) => map.get(id)).filter(Boolean) as SolarReturnProfile[];
      // Append any profiles not in the ordered list at the end
      const rest = store.profiles.filter((p) => !ids.includes(p.id));
      persist({ ...store, profiles: [...ordered, ...rest] });
    },
    [store, persist]
  );

  // Listen for storage events from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SOLAR_RETURN_KEY_V2) {
        setStore(readStore());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const activeProfile =
    store.profiles.find((p) => p.id === store.activeId) ?? store.profiles[0] ?? null;

  return {
    profiles: store.profiles,
    activeProfile,
    activeId: store.activeId,
    setActiveId,
    addProfile,
    updateProfile,
    removeProfile,
    reorderProfiles,
  };
}
