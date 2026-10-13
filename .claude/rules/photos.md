---
paths:
  - "backend/app/models/listing_photo.rb"
  - "backend/app/services/listing_photos/**"
  - "backend/app/jobs/listing_photos/**"
  - "backend/app/serializers/listing_photo_serializer.rb"
  - "backend/app/controllers/api/v1/partner/direct_uploads_controller.rb"
  - "backend/config/storage.yml"
---

# Listing photos (RAA-106)

**Storage**: Active Storage on Cloudflare R2 through its S3 API (`cloudflare` in `config/storage.yml`, `aws-sdk-s3`). Production always uses it. Development uses the local disk (`backend/storage`) unless `ACTIVE_STORAGE_SERVICE=cloudflare`, and specs use `tmp/storage`. The `R2_*` variables are in `backend/.env.example` and `render.yaml`. The bucket's CORS policy (set in the Cloudflare dashboard, not in the repo) must allow `PUT` from every web origin that uploads, with the `Content-Type`, `Content-MD5` and `Content-Disposition` headers (what `upload.headers` holds). libvips is in `backend/Dockerfile` for the sizes.

**Upload**: the browser never sends a file to this API. `POST /api/v1/partner/direct_uploads` (`ListingPhotos::DirectUpload`) checks the type (JPEG, PNG, WebP), the size (≤ 10 MB) and the MD5, then reserves a blob. The browser `PUT`s the bytes to the returned URL with exactly the returned headers. The listing's `photos` then takes the blob's `signed_id`. A listing refuses a new photo whose bytes aren't in storage yet. Rails' own `POST /rails/active_storage/direct_uploads` takes anyone's upload, so `config/routes.rb` answers it with a 404 (`spec/requests/active_storage_routes_spec.rb`); its other routes stay, for the URLs below.

**Order**: each photo is a `ListingPhoto` row with a `position`, and the first is the cover. `photos` in a listing body is the full ordered list. `Listings::ListingValues#save_photos!` keeps the photos still listed, adds the new ones and destroys the rest, which purges their images after the commit. The `(listing_id, position)` unique constraint is deferred, so a reorder can swap positions inside one transaction. In a spec, `SET CONSTRAINTS ... IMMEDIATE` shows what a commit would do. A blob attached to another listing is refused, and a partial unique index on `active_storage_attachments.blob_id` holds it under concurrency; `save_photos!` locks the listing's row first. Unattached uploads older than two days are purged daily (`ListingPhotos::PurgeUnattachedJob`).

**Serving**: guests load photos straight from the bucket's public URL (`R2_PUBLIC_URL` + the object's key), never through this API: on the free tier every image request would wake Render. `ListingPhotoSerializer` builds every URL. `card` (fill 800×600) and `large` (limit 1600) are preprocessed in a job after attach, and until then the URL is the original's. Off R2, the URLs are Active Storage redirect URLs on `BACKEND_PUBLIC_URL` (set in `docker-compose.yml`), because server-rendered pages fetch from inside Docker. A list of listings for guests (`ListingSummarySerializer`) preloads only the cover, `cover_photo: ListingPhoto::WITH_IMAGE`; `ListingDetailSerializer` and `PartnerListingSerializer` preload `photos: ListingPhoto::WITH_IMAGE`. Without them each photo costs several queries.

**Specs**: `uploaded_photo` (`spec/support/photo_helpers.rb`) is a blob as a direct upload leaves it, with its declared content type. The test queue adapter keeps jobs across examples, so count purge or transform jobs with the block form (`expect { ... }.to have_enqueued_job`).
