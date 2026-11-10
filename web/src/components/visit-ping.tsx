"use client";

import { useEffect } from "react";
import { apiClient } from "@/api/client";

const ID_KEY = "visitor-id";
const DAY_KEY = "visitor-counted-on";

// Manila's day, the one the API counts in: the browser's own day could be another.
function manilaDay() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

// Counts this browser once a day for the admin overview's visitors (POST /visits, RAA-290), on
// guest pages only, so the team's and partners' own use isn't counted. The id is random and
// stays in this browser; the API keeps only a digest of it with the day. Without storage
// (a private window, blocked site data) it still counts, once per page load. Nothing on the
// page waits for it, and a failure is ignored.
export function VisitPing() {
  useEffect(() => {
    const today = manilaDay();
    let visitorId: string | null = null;
    try {
      if (localStorage.getItem(DAY_KEY) === today) return;
      visitorId = localStorage.getItem(ID_KEY);
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem(ID_KEY, visitorId);
      }
    } catch {
      visitorId = crypto.randomUUID();
    }

    apiClient()
      .POST("/api/v1/visits", { body: { visitor_id: visitorId } })
      .then(({ response }) => {
        if (!response.ok) return;
        try {
          localStorage.setItem(DAY_KEY, today);
        } catch {
          // Nowhere to remember it: the next page load counts again, as the same browser.
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
