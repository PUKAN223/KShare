"use client";

import React, { useRef, useEffect } from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore } from "@/lib/store";
import { hydrateCache, loadRoomsFromStorage } from "@/lib/store/room-slice";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  useEffect(() => {
    // Hydrate cached rooms from localStorage immediately on client mount
    // so rooms are visible before any network fetch begins
    const cached = loadRoomsFromStorage();
    if (cached.length > 0 && storeRef.current) {
      storeRef.current.dispatch(hydrateCache(cached));
    }
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}
