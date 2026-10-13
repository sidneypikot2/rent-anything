require "rails_helper"

RSpec.describe ListingPhotos::PurgeUnattachedJob do
  it "purges uploads no listing took once they are two days old" do
    abandoned = uploaded_photo.tap { |blob| blob.update!(created_at: 3.days.ago) }
    uploaded_photo # still being added
    create(:listing).photos.create!(position: 1, image: uploaded_photo.tap { |blob| blob.update!(created_at: 3.days.ago) })

    expect { described_class.perform_now }.to have_enqueued_job(ActiveStorage::PurgeJob).exactly(:once).with(abandoned)
  end
end
