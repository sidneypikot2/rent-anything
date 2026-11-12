"use client";

import { createCable, type Cable } from "@anycable/web";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { bookingsKey, paymentKey } from "@/components/bookings/use-bookings";
import { playNotificationSound } from "@/components/notifications/notification-sound";
import { notificationsKey } from "@/components/notifications/use-notifications";
import { partnerCalendarKey, partnerRequestsKey } from "@/components/partner/use-partner-calendar";
import { partnerDashboardKey } from "@/components/partner/use-partner-dashboard";
import { tripsKey } from "@/components/trips/use-trips";
import { refreshSession } from "@/lib/auth/middleware";
import { getSession, useSession } from "@/lib/auth/session";
import { cableUrl } from "@/lib/config";

// What the API's UserChannel sends (RAA-201): only what changed, so the page refetches it
// through the API, which decides what this user may see.
type LiveMessage = { type?: string; notification_id?: number };

// A refresh that can't reach the API (offline) changes nothing here; the next one will.
function refreshQuietly() {
  refreshSession().catch(() => {});
}

// Keeps the signed-in user's WebSocket open (anycable, RAA-203) and refreshes what a booking
// change touches: the guest's bookings, trips and payments, the partner's calendar; and the
// bell's notifications when one comes in (notification.created), with a sound. Inactive
// queries are only marked stale. Renders nothing; a page works the same without it.
//
// One connection per user, identified by the session's cable token (RAA-304), which anycable-go
// checks itself. It goes as a WebSocket sub-protocol, so it is never in the URL. The server
// checks it only when a connection opens, so a new token is just what the next reconnect sends.
// A reconnect that couldn't restore its session (a long outage) refetches, since messages may
// have been missed. When the token has expired (the server closes connections then, and refuses
// to reopen them, with `token_expired`) the session is refreshed and the new token reconnects;
// a failed refresh signs out as it does for the API. No cable token (an API without AnyCable):
// no connection.
export function LiveUpdates() {
  const session = useSession();
  const queryClient = useQueryClient();
  const signedInWithoutToken = Boolean(session && !session.accessToken);
  const cableToken = session?.cableToken ?? undefined;
  const userId = session?.user.id;
  const hasToken = Boolean(cableToken);

  const cableRef = useRef<Cable | null>(null);
  const tokenRef = useRef(cableToken);

  // A new token: what the next reconnect sends, and a reconnect now if the server had closed
  // it. First, so the connection below opens with the token of the same render.
  useEffect(() => {
    tokenRef.current = cableToken;
    const cable = cableRef.current;
    if (!cable || !cableToken) return;
    cable.transport.setToken(cableToken);
    if (cable.state === "closed") void cable.connect().catch(() => {});
  }, [cableToken]);

  // After a reload the tokens are gone (they live only in memory, RAA-226): get them.
  useEffect(() => {
    if (signedInWithoutToken) refreshQuietly();
  }, [signedInWithoutToken]);

  useEffect(() => {
    if (userId === undefined || !hasToken || !tokenRef.current) return;

    const refetch = () => {
      for (const queryKey of [
        bookingsKey(userId),
        tripsKey(userId),
        paymentKey(userId),
        partnerCalendarKey(userId),
        partnerRequestsKey(userId),
        partnerDashboardKey(userId),
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    const cable = createCable(cableUrl(), {
      // Each reconnect gets the messages it missed, in order, while the server still has them.
      protocol: "actioncable-v1-ext-json",
      logLevel: "error",
      websocketAuthStrategy: "sub-protocol",
      auth: { token: tokenRef.current },
      // On `token_expired` (once until a connection succeeds); the reconnect sends the new token.
      tokenRefresher: async (transport) => {
        await refreshSession();
        const token = getSession()?.cableToken;
        if (!token) throw new Error("no cable token");
        transport.setToken(token);
      },
    });
    cableRef.current = cable;
    const refetchNotifications = () => void queryClient.invalidateQueries({ queryKey: notificationsKey(userId) });

    cable.subscribeTo("UserChannel").on("message", (message) => {
      const { type, notification_id } = (message as LiveMessage | null) ?? {};
      if (type === "booking.updated") refetch();
      if (type === "notification.created") {
        refetchNotifications();
        playNotificationSound(notification_id);
      }
    });
    cable.on("connect", (event) => {
      if (event.reconnect && !event.restored) {
        refetch();
        refetchNotifications();
      }
    });
    return () => {
      cableRef.current = null;
      cable.disconnect();
    };
    // hasToken: the first token after a reload opens it; later ones are only set (above).
  }, [userId, hasToken, queryClient]);

  return null;
}
