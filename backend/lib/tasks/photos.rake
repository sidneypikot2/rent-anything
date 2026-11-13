# WebP sizes (RAA-240) for photos sized before them: queues ResizeJob for each, in batches. Safe
# to run again; on staging: docker compose exec backend bin/rails photos:webp_sizes
namespace :photos do
  desc "Give photos sized before RAA-240 their WebP card and large sizes (queued; safe to run again)"
  task webp_sizes: :environment do
    puts "Queued WebP sizes for #{ListingPhotos::ResizeOutdated.call} photos"
  end
end
