---
paths:
  - "backend/app/mailers/**"
  - "backend/app/views/**/*mailer*/**"
  - "backend/app/views/layouts/mailer.*"
  - "backend/config/initializers/mailer.rb"
  - "backend/lib/tasks/mail.rake"
---

# Email

- Which SMTP server is used depends only on the env vars (`SMTP_*`, `MAILER_FROM`), not on the Rails env, because staging runs with `RAILS_ENV=production`. The local stack and staging use Gmail (`tripkonext@gmail.com`, an App Password). Production uses GoDaddy Professional Email (`team@tripkonext.com`, `smtpout.secureserver.net:465`). The values are in `backend/.env.example` and `deploy/staging/backend.env.example`.
- `MAILER_FROM` must be the SMTP account's own address, because both providers rewrite or refuse any other sender. Use `reply_to` to send replies somewhere else.
- Every mailer inherits from `ApplicationMailer` (layout `mailer`, HTML and text parts). Keep styles inline.
- Send from the app with `deliver_later`; on staging Solid Queue runs inside Puma. `deliver_now` is only for `bin/rails mail:test`.
- Links in emails point to the web app (`default_url_options` comes from `FRONTEND_ORIGIN`), never to the API.
- Gmail allows about 500 messages a day, which is enough for staging but not for bulk mail.
