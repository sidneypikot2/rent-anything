require "rails_helper"

RSpec.describe ListingPhotos::ResizeOutdated do
  # Photos sized before RAA-240, with their sizes in the original's format.
  def sized_before_webp(owner)
    create_photo(owner).tap { |photo| photo.update!(versions_content_type: nil) }
  end

  it "queues WebP sizes for every kind of photo sized before them, and only those" do
    business = create(:business)
    outdated = [
      sized_before_webp(create(:listing)), sized_before_webp(create(:area)), sized_before_webp(create(:landmark)),
      sized_before_webp(business),
      business.create_logo!(filename: "logo.png", content_type: "image/png", byte_size: 505,
        checksum: "1B2M2Y8AsgTpgAmY7PhCfg==", uploaded_at: Time.current, sized_at: Time.current)
    ]
    listing = create(:listing)
    create_photo(listing)
    create_photo(listing, ready: false)
    create_photo(listing, uploaded: false)

    expect { expect(described_class.call(batch_size: 2)).to eq(5) }
      .to have_enqueued_job(ListingPhotos::ResizeJob).exactly(5).times
    outdated.each { |photo| expect(ListingPhotos::ResizeJob).to have_been_enqueued.with(photo) }
  end

  it "queues nothing once every photo has its WebP sizes" do
    create_photo(create(:listing))

    expect { expect(described_class.call).to eq(0) }.not_to have_enqueued_job(ListingPhotos::ResizeJob)
  end
end
