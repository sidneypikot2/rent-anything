---
paths:
  - "web/src/components/partner/use-listing-photos.ts"
  - "web/src/components/partner/listing-photos.tsx"
  - "web/src/components/partner/new-listing-photos.tsx"
  - "web/src/components/partner/listing-wizard.tsx"
  - "web/src/components/partner/stay-wizard.tsx"
  - "web/src/components/partner/tour-wizard.tsx"
  - "web/src/components/partner/listing-form.tsx"
  - "web/src/components/discovery/listing-gallery.tsx"
  - "web/src/components/landing/sample-photos.ts"
  - "web/src/components/admin/use-admin-areas.ts"
  - "web/src/components/admin/use-admin-landmarks.ts"
  - "web/src/components/admin/use-admin-photos.ts"
  - "web/src/components/admin/photo-gallery.tsx"
  - "web/src/components/admin/destination-form.tsx"
  - "web/src/components/admin/landmark-form.tsx"
  - "web/src/components/landing/banner-carousel.tsx"
  - "web/src/components/landing/page-banner.tsx"
---

# Listing photos in the web app (RAA-109)

The API side is in `photos.md`. A photo belongs to a listing that already exists, so every add-listing wizard (generic, stay, tour) ends with `SAVED_STEPS` — Photos, Booking (instant book or request to book, RAA-133), then Listing status (RAA-116): the step before Photos ("Save and add photos") creates the draft, then `NewListingPhotos` runs the last steps (adding photos, choosing how guests book, then Save as draft or Go live, which saves the booking mode and the photos' order with the wizard's body) with the earlier sections closed (`WizardLayout openFrom={photosStep}`: the steps from Photos on open again once reached). Never move Photos before the save.

**Upload** (`useListingPhotos` in `use-listing-photos.ts`): per file, the client checks type, size (`photoProblem`) and the listing's `photo_limit` from the API (5 for a tour, 12 otherwise; `ListingPhotos`' `limit`), computes the MD5 with `spark-md5` (Web Crypto has none) as base64, `POST`s the photo, `PUT`s the bytes to `upload.url` with exactly `upload.headers`, then confirms with `PATCH {uploaded: true}`. That `PUT` is the one plain `fetch` allowed: it goes to storage (R2, or the local stand-in), not the API. `usePartnerListing` polls every 2 s while a photo is uploaded but not ready. A failed `PUT` or confirm deletes its row. The partner listing also returns unconfirmed rows (another file mid-upload), whose URLs have no file yet: show only `uploadedPhotos`.

**Order**: uploads and deletes are saved at once; the order is part of the listing body. `photos` in a body deletes every photo it leaves out, so send it only after the partner moved one (`orderedPhotos`), and hold the save while uploads or a delete run (`onBusyChange`): the body's ids must be exactly the listing's photos, or the API refuses it.

**Showing them**: guest cards use `listingCover` (the API's `cover_photo_url`, else the category's stand-in); the listing page's banner shows only a real cover (RAA-107 dropped the stand-in there) and `ListingGallery` the rest. API photos are already sized, so Next's Image gets `unoptimized` for them (`isApiPhoto`), which also keeps the R2 host out of `remotePatterns`.

**Destination and place photos** (RAA-211, over RAA-210's API): the admin editors' Photos section (`PhotoGallery`, `useAdminPhotos` in `use-admin-photos.ts`) uploads each file as a listing photo is (one at a time, so they keep the order chosen), up to 12, and saves every change at once: Make banner / Make cover (`PATCH {position: 1}`), Replace (upload the new one, move it into the old one's position, delete the old, so the banner stays in place) and Delete (a confirm). `position` counts all the owner's `photos`, unconfirmed rows too, which are never shown (`uploadedAdminPhotos`). The editor polls every 2 s while a photo is being sized (`photoPollMs`). Guests: an area page's banner shows the area's own photos from `GET /areas/{slug}` (`photos`, large size), turning through them from the first every 6 s (`BannerCarousel`, through `PageBanner carousel`: held while off-screen, the tab is hidden, or a pointer or focus is on the banner, never by itself under reduced motion, with dots to pick one), else the stand-in; a place to see's card and panel take its own first photo before any stand-in (`landmarkPhotos`).
