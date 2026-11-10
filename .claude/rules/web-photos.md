---
paths:
  - "web/src/components/partner/use-listing-photos.ts"
  - "web/src/components/partner/listing-photos.tsx"
  - "web/src/components/partner/new-listing-photos.tsx"
  - "web/src/components/partner/listing-wizard.tsx"
  - "web/src/components/partner/stay-wizard.tsx"
  - "web/src/components/partner/tour-wizard.tsx"
  - "web/src/components/partner/listing-form.tsx"
  - "web/src/components/discovery/business-view.tsx"
  - "web/src/components/landing/sample-photos.ts"
  - "web/src/components/admin/use-admin-areas.ts"
  - "web/src/components/admin/use-admin-landmarks.ts"
  - "web/src/components/admin/use-admin-photos.ts"
  - "web/src/components/admin/photo-gallery.tsx"
  - "web/src/components/photos/photo-manager.tsx"
  - "web/src/components/admin/destination-form.tsx"
  - "web/src/components/admin/landmark-form.tsx"
  - "web/src/components/landing/banner-carousel.tsx"
  - "web/src/components/landing/page-banner.tsx"
---

# Listing photos in the web app (RAA-109)

The API side is in `photos.md`. A photo belongs to a listing that already exists, so every add-listing wizard (generic, stay, tour) ends with `SAVED_STEPS` — Photos, Booking (instant book or request to book, RAA-133), then Listing status (RAA-116): the step before Photos ("Save and add photos") creates the draft, then `NewListingPhotos` runs the last steps (adding photos, choosing how guests book, then Save as draft or Go live, which saves the booking mode and the photos' order with the wizard's body) with the earlier sections closed (`WizardLayout openFrom={photosStep}`: the steps from Photos on open again once reached). Never move Photos before the save.

**Managing photos** (RAA-211): a listing's, a destination's and a place to see's photos are changed only in `PhotoManager` (`src/components/photos/photo-manager.tsx`), a sheet opened by `ManagePhotosButton` ("Add photos" while there are none, "Manage photos" after) in the Photos section's header, beside its title (`FormSection` / `EditSection` `action`, the wizard's title row), over the read-only photos (`SavedPhotos`). Nothing in it is saved until Save: picked or dropped files join the end as previews, any photo is dragged into place (`@dnd-kit/react` sortable: a mouse drags at once, a finger after a short hold, the keyboard too; its buttons never start a drag), Make banner / Make cover moves one to the front, and Delete asks first (an unsaved file just goes). Save deletes, then uploads the new files one at a time in their order, each tile showing its progress, then saves the order; the sheet is `Dialog locked` until that is over, closes once it all worked, and otherwise stays on what failed for Save to try again. There is no Replace: add the new photo, drag it into place, delete the old.

**Upload** (`useListingPhotos` in `use-listing-photos.ts`): per file, the client checks type, size (`photoProblem`) and the listing's `photo_limit` from the API (5 for a tour, 12 otherwise; `ListingPhotos`' `limit`), computes the MD5 with `spark-md5` (Web Crypto has none) as base64, `POST`s the photo, `PUT`s the bytes to `upload.url` with exactly `upload.headers`, then confirms with `PATCH {uploaded: true}`. That `PUT` is the one request outside `apiClient()`: it goes to storage (R2, or the local stand-in), not the API, through `putWithProgress` (an `XMLHttpRequest`, since `fetch` can't report an upload's progress; `UploadProgress` says preparing, sending or finishing). `usePartnerListing` polls every 2 s while a photo is uploaded but not ready. A failed `PUT` or confirm deletes its row. The partner listing also returns unconfirmed rows (another file mid-upload), whose URLs have no file yet: show only `uploadedPhotos`.

**Order**: a listing's uploads and deletes are saved by the manager; its order is part of the listing body, which the manager only reports (`onOrderChange`). `photos` in a body deletes every photo it leaves out, so send it only after the partner moved one (`orderedPhotos`), and hold the save while uploads or a delete run (`onBusyChange`): the body's ids must be exactly the listing's photos, or the API refuses it.

**Showing them**: guest cards use `listingCover` (the API's `cover_photo_url`, else the category's stand-in); the listing page's banner shows only a real cover (RAA-107 dropped the stand-in there) and `ShopPhotos` (`business-view.tsx`, shared with the business page) the rest: a swipe on a phone, from sm one large photo beside four. API photos are already sized, so Next's Image gets `unoptimized` for them (`isApiPhoto`), which also keeps the R2 host out of `remotePatterns`.

**Destination and place photos** (RAA-211, over RAA-210's API): the admin editors' Photos section (`PhotoGallery`, `useAdminPhotos` in `use-admin-photos.ts`) uploads each file as a listing photo is (one at a time, so they keep the order chosen), up to 12, and saves the manager's changes as it makes them: each upload, each delete, then the order as one `PATCH {position}` per photo out of place, the API shifting the others (`PhotoGallery` follows the API's order meanwhile, so it needn't ask again). `position` counts all the owner's `photos`, unconfirmed rows too, which are never shown (`uploadedAdminPhotos`). The editor polls every 2 s while a photo is being sized (`photoPollMs`). Guests: an area page's banner shows the area's own photos from `GET /areas/{slug}` (`photos`, large size), turning through them from the first every 5 s (`BannerCarousel`, through `PageBanner carousel`: held while off-screen, the tab is hidden, or a pointer or keyboard focus is on the banner, never by itself under reduced motion, with dots to pick one), else the stand-in. Every turn — by itself, a dot or a swipe — slides (700 ms, `ease-calm`; a fade under reduced motion), never a cut; with `fade`, as on the sign-in sheet, it never slides: the next photo comes up slowly over the shown one (1.8 s), and a swipe turns it the same way, without dragging. It must sit inside a `<section>`, which it watches for hovers and swipes, or it never turns. A finger's swipe drags the photo with it and turns past 40 px or a quick flick, else settles back; the banner is `touch-pan-y`, so a vertical swipe still scrolls the page. A trackpad's sideways swipe turns one photo per gesture and is cancelled, so the browser never goes back a page. Neither is taken inside something that scrolls sideways itself (the phone's chip row, which is `overscroll-x-contain`), and a tap that ends a swipe opens nothing; a place to see's card and panel take its own first photo before any stand-in (`landmarkPhotos`).
