require "rails_helper"

RSpec.describe ListingPhotos::DeleteFilesJob do
  it "deletes the files from storage in one request" do
    described_class.perform_now(%w[test/listing_photos/1/image.jpg test/listing_photos/1/image_card.jpg])

    deletes = storage_requests(:delete_objects)
    expect(deletes.size).to eq(1)
    expect(deletes.first[:params][:delete][:objects].pluck(:key))
      .to eq(%w[test/listing_photos/1/image.jpg test/listing_photos/1/image_card.jpg])
  end
end
