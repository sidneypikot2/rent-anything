# libvips in the job that readies photos (ListingPhotos::ResizeJob, RAA-221): its operation cache
# would keep decoded images in a long-running worker's memory after the job is done.
require "vips"

Vips.cache_set_max(0)
