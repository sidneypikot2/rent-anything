require "rails_helper"

RSpec.describe ListingPhotos::Update do
  let(:listing) { create(:listing) }

  it "deletes a file whose bytes aren't the type declared, row and all (RAA-221)" do
    photo = create_photo(listing, uploaded: false, filename: "page.png", content_type: "image/png")
    stub_photo_in_storage("<!doctype html><script>alert(1)</script>")

    expect do
      expect { described_class.call(photo, { uploaded: true }) }
        .to raise_error(ActiveRecord::RecordInvalid, /page.png isn't a JPEG, PNG or WebP image/)
    end.not_to have_enqueued_job(ListingPhotos::ResizeJob)
    expect(ListingPhoto.exists?(photo.id)).to be(false)
    expect(storage_requests(:get_object).last[:params]).to include(range: "bytes=0-15")
    deleted = storage_requests(:delete_objects).last[:params][:delete][:objects].pluck(:key)
    expect(deleted).to eq(StoredPhoto::FIELDS.map { |field| photo.key(field) })
  end

  it "takes each type whose bytes say what it is" do
    {
      "image/jpeg" => file_fixture("photo.jpg").binread,
      "image/png" => Vips::Image.black(1, 1).pngsave_buffer,
      "image/webp" => Vips::Image.black(1, 1).webpsave_buffer
    }.each do |content_type, bytes|
      photo = create_photo(listing, uploaded: false, content_type:)
      stub_photo_in_storage(bytes)

      expect(described_class.call(photo, { uploaded: true })).to be_uploaded
    end
  end
end
