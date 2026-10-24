require "rails_helper"

RSpec.describe ListingPhotos::PurgeUnfinishedJob do
  it "deletes photos whose upload was never confirmed once they are two days old" do
    listing = create(:listing)
    abandoned = create_photo(listing, uploaded: false, created_at: 3.days.ago)
    create_photo(listing, uploaded: false) # still uploading
    create_photo(listing, created_at: 3.days.ago)

    expect { described_class.perform_now }.to change(ListingPhoto, :count).by(-1)
      .and have_enqueued_job(ListingPhotos::DeleteFilesJob).exactly(:once)
    expect(ListingPhoto.exists?(abandoned.id)).to be(false)
  end

  it "deletes an area banner never confirmed too" do
    attributes = { filename: "beach.jpg", content_type: "image/jpeg", byte_size: 505, checksum: "1B2M2Y8AsgTpgAmY7PhCfg==" }
    AreaPhoto.create!(area: create(:area), created_at: 3.days.ago, **attributes)
    kept = AreaPhoto.create!(area: create(:area), created_at: 3.days.ago, uploaded_at: 3.days.ago, **attributes)

    expect { described_class.perform_now }.to change(AreaPhoto, :count).by(-1)
    expect(AreaPhoto.sole).to eq(kept)
  end
end
