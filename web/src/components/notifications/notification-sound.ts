// The sound a new notification makes (LiveUpdates, on notification.created). Every open tab
// gets the message, so the first tab to note the notification's id plays it and the others
// stay quiet. A browser that blocks sound before the page has been clicked just stays silent.
const SOUND_URL = "/sounds/notification.mp3";
const LAST_PLAYED_KEY = "notification-sound:last";

export function playNotificationSound(notificationId: number | undefined) {
  if (notificationId !== undefined) {
    try {
      if (localStorage.getItem(LAST_PLAYED_KEY) === String(notificationId)) return;
      localStorage.setItem(LAST_PLAYED_KEY, String(notificationId));
    } catch {
      // No storage (a private window): play it anyway.
    }
  }
  void new Audio(SOUND_URL).play().catch(() => {});
}
