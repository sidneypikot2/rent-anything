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

  it "deletes area and landmark photos never confirmed too" do
    area = create(:area)
    create_photo(area, uploaded: false, created_at: 3.days.ago)
    kept = create_photo(area, created_at: 3.days.ago)
    landmark = create(:landmark, area:)
    create_photo(landmark, uploaded: false, created_at: 3.days.ago)

    expect { described_class.perform_now }.to change(AreaPhoto, :count).by(-1).and change(LandmarkPhoto, :count).by(-1)
    expect(AreaPhoto.sole).to eq(kept)
  end
end
