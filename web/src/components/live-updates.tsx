"use client";

import { createCable, type Cable } from "@anycable/web";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { bookingsKey, paymentKey } from "@/components/bookings/use-bookings";
import { notificationsKey } from "@/components/notifications/use-notifications";
import { partnerCalendarKey } from "@/components/partner/use-partner-calendar";
import { tripsKey } from "@/components/trips/use-trips";
import { refreshSession } from "@/lib/auth/middleware";
import { useSession } from "@/lib/auth/session";
import { cableUrl } from "@/lib/config";

// What the API's UserChannel sends (RAA-201): only what changed, so the page refetches it
// through the API, which decides what this user may see.
type LiveMessage = { type?: string };

// Whether a JWT's exp has passed (read, not verified: the server checks it).
function expired(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(part)) as { exp?: unknown };
    return typeof exp === "number" && exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

// A refresh that can't reach the API (offline) changes nothing here; the next one will.
function refreshQuietly() {
  refreshSession().catch(() => {});
}

function urlFor(token: string) {
  return `${cableUrl()}?token=${encodeURIComponent(token)}`;
}

// Keeps the signed-in user's WebSocket open (anycable, RAA-203) and refreshes what a booking
// change touches: the guest's bookings, trips and payments, the partner's calendar; and the
// bell's notifications when one comes in (notification.created). Inactive
// queries are only marked stale. Renders nothing; a page works the same without it.
//
// One connection per user. The server checks the access token only when a connection opens,
// so a new token just becomes the URL the next reconnect uses. A reconnect that couldn't
// restore its session (a long outage) refetches, since messages may have been missed. A drop
// with an expired token, or the server closing the connection, refreshes the session (the
// latter once until a connection succeeds), and the new token reconnects; a failed refresh
// signs out as it does for the API.
export function LiveUpdates() {
  const session = useSession();
  const queryClient = useQueryClient();
  const accessToken = session?.accessToken;
  const userId = session?.user.id;

  const cableRef = useRef<Cable | null>(null);
  const tokenRef = useRef(accessToken);
  // Set once a refused connection has refreshed the session, cleared when one connects: a
  // server that refuses fresh tokens too (no secret set) gets one refresh, not a loop.
  const refreshedRef = useRef(false);

  // A new token: the URL the next reconnect uses, and a reconnect now if the server had closed
  // it. First, so the connection below opens with the token of the same render.
  useEffect(() => {
    tokenRef.current = accessToken;
    const cable = cableRef.current;
    if (!cable || !accessToken) return;
    cable.transport.setURL(urlFor(accessToken));
    if (cable.state === "closed") void cable.connect().catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    if (userId === undefined || !tokenRef.current) return;

    const refetch = () => {
      for (const queryKey of [bookingsKey(userId), tripsKey(userId), paymentKey(userId), partnerCalendarKey(userId)]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    const cable = createCable(urlFor(tokenRef.current), {
      // Each reconnect gets the messages it missed, in order, while the server still has them.
      protocol: "actioncable-v1-ext-json",
      logLevel: "error",
    });
    cableRef.current = cable;
    const refetchNotifications = () => void queryClient.invalidateQueries({ queryKey: notificationsKey(userId) });

    cable.subscribeTo("UserChannel").on("message", (message) => {
      const type = (message as LiveMessage | null)?.type;
      if (type === "booking.updated") refetch();
      if (type === "notification.created") refetchNotifications();
    });
    cable.on("connect", (event) => {
      refreshedRef.current = false;
      if (event.reconnect && !event.restored) {
        refetch();
        refetchNotifications();
      }
    });
    // Dropped: anycable refuses an expired token at the handshake (a 403 the client takes for
    // a network failure and retries), so renew it first; the retry then uses the new one.
    cable.on("disconnect", () => {
      if (expired(tokenRef.current)) refreshQuietly();
    });
    // An event means the server closed it (no event: our own disconnect below).
    cable.on("close", (event) => {
      if (!event || refreshedRef.current) return;
      refreshedRef.current = true;
      refreshQuietly();
    });
    return () => {
      cableRef.current = null;
      cable.disconnect();
    };
  }, [userId, queryClient]);

  return null;
}
