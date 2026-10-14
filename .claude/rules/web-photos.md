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
---

# Listing photos in the web app (RAA-109)

The API side is in `photos.md`. A photo belongs to a listing that already exists, so every add-listing wizard (generic, stay, tour) ends with Photos: the step before it ("Save and add photos") creates the draft, then `NewListingPhotos` adds photos to it and the earlier sections are closed (`WizardLayout locked`). Never move Photos before the save.

**Upload** (`useListingPhotos` in `use-listing-photos.ts`): per file, the client checks type, size (`photoProblem`) and the listing's `photo_limit` from the API (5 for a tour, 12 otherwise; `ListingPhotos`' `limit`), computes the MD5 with `spark-md5` (Web Crypto has none) as base64, `POST`s the photo, `PUT`s the bytes to `upload.url` with exactly `upload.headers`, then confirms with `PATCH {uploaded: true}`. That `PUT` is the one plain `fetch` allowed: it goes to storage (R2, or the local stand-in), not the API. `usePartnerListing` polls every 2 s while a photo is uploaded but not ready. A failed `PUT` or confirm deletes its row. The partner listing also returns unconfirmed rows (another file mid-upload), whose URLs have no file yet: show only `uploadedPhotos`.

**Order**: uploads and deletes are saved at once; the order is part of the listing body. `photos` in a body deletes every photo it leaves out, so send it only after the partner moved one (`orderedPhotos`), and hold the save while uploads or a delete run (`onBusyChange`): the body's ids must be exactly the listing's photos, or the API refuses it.

**Showing them**: guest cards use `listingCover` (the API's `cover_photo_url`, else the category's stand-in); the listing page's banner shows only a real cover (RAA-107 dropped the stand-in there) and `ListingGallery` the rest. API photos are already sized, so Next's Image gets `unoptimized` for them (`isApiPhoto`), which also keeps the R2 host out of `remotePatterns`.
