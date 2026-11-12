"use client";

import { useEffect, useState } from "react";
import type { AuthSession } from "@/app/api/auth/route";

export function useAuthSession() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    // 1. Fast read from localStorage if available
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem("cymfarm_user_session");
      if (cached) {
        try {
          setSession(JSON.parse(cached));
        } catch {
          // ignore
        }
      }
    }

    // 2. Authoritative check from /api/auth cookie
    fetch("/api/auth")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.user) {
          setSession(data.user);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              "cymfarm_user_session",
              JSON.stringify(data.user)
            );
          }
        }
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return { session, loaded };
}
