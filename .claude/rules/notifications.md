---
paths:
  - "backend/app/services/notifications/**"
  - "backend/app/models/notification.rb"
  - "backend/app/mailers/notification_mailer.rb"
  - "backend/app/views/notification_mailer/**"
  - "backend/app/controllers/api/v1/notifications_controller.rb"
  - "backend/app/jobs/notifications/**"
  - "web/src/components/notifications/**"
---

# Notifications

**One row per recipient** (`notifications`): `kind`, a polymorphic `subject` (a booking so far) and `params`, the few values its wording needs. Wording and link come from `Notifications::Copy` at read time, so editing a sentence there changes old notifications too; never store rendered text. Each kind is in `Copy::CATALOGUE` with its recipient (guest or partner) and whether it is emailed; a new kind goes there first (the model validates against it).

**Made in one place per cause**: `Notifications::Notify` inserts in the caller's transaction and, after commit, broadcasts `notification.created` on `UserChannel` and sends `NotificationMailer#event` with `deliver_later` for emailed kinds. Booking notifications come only from `Notifications::BookingChanged`, which `Bookings::Transition` (every status change, and `record_start`) and `Bookings::Change` (a request changed while waiting) call: add a booking notification there, never in a controller or another service. A partner isn't told of an instant hold until it is paid, nor of a request while `Bookings.auto_accept?` is on (staging); a cancel names the partner only when they made it. Reminders are `Notifications::Remind` (every 15 minutes, once per deadline through `dedupe_key`); read rows older than 90 days go in `Notifications::PruneJob`. Rows cascade with their user (`Users::Erase`).

**Links**: a guest's go to `/cart?trip=` while a booking is asked for or paid, `/trips?trip=` once confirmed; a partner's to `/partner/calendar?booking=`, which opens that booking's sheet. A notification never carries more than its recipient can already see; the page it opens checks access.

**Web**: `NotificationBell` in the header (`AccountNav`, guests and partners) reads `GET /notifications` (`useNotifications`, a page of 20, `before` for older), marks read on open (`useMarkRead`, shown at once) and is refetched by `LiveUpdates` on `notification.created`, which also plays `public/sounds/notification.mp3` (`playNotificationSound`: once across open tabs, by the notification's id; silent where the browser blocks sound).

**Not yet**: chat messages (M6) are not notifications (their own unread counts, per trip), push, per-kind email opt-outs, and grouping several bookings of one checkout or payment into one email.
