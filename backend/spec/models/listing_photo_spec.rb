require "rails_helper"

RSpec.describe ListingPhoto do
  let(:listing) { create(:listing) }

  it "keeps its files in its own folder, under the environment's" do
    photo = create_photo(listing, content_type: "image/png")

    expect(photo.key).to eq("test/listing_photos/#{photo.id}/image.png")
    expect(photo.key(:image_card)).to eq("test/listing_photos/#{photo.id}/image_card.png")
  end

  it "keeps each local stack's files apart in development, where every stack numbers photos from 1" do
    photo = create_photo(listing)
    allow(Rails).to receive(:env).and_return(ActiveSupport::EnvironmentInquirer.new("development"))

    stub_const("ENV", ENV.to_h.merge("DEV_STORAGE_FOLDER" => "Sidney-raa-106 Photos"))
    expect(photo.key).to eq("development/sidney-raa-106-photos/listing_photos/#{photo.id}/image.jpg")

    stub_const("ENV", ENV.to_h.except("DEV_STORAGE_FOLDER"))
    expect(photo.key).to eq("development/unnamed/listing_photos/#{photo.id}/image.jpg")
  end

  it "takes a JPEG, PNG or WebP image of at most 10 MB" do
    expect { create_photo(listing, content_type: "application/pdf") }
      .to raise_error(ActiveRecord::RecordInvalid, /Content type is not included/)
    expect { create_photo(listing, byte_size: 11.megabytes) }
      .to raise_error(ActiveRecord::RecordInvalid, /Byte size must be less than or equal to/)
  end

  # Specs never commit, so the deferred check is made immediate to see what a commit would do.
  def check_positions_now
    described_class.connection.execute("SET CONSTRAINTS listing_photos_listing_id_position_key IMMEDIATE")
  end

  it "numbers a listing's photos once each, checked at commit so two can swap" do
    first = create_photo(listing, position: 1)
    second = create_photo(listing, position: 2)

    described_class.transaction do
      first.update!(position: 2)
      second.update!(position: 1)
    end
    expect { check_positions_now }.not_to raise_error
    expect(listing.photos.reload).to eq([ second, first ])

    expect { create_photo(listing, position: 1) }.to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "shows guests only ready photos, with their metadata gone and sizes made, the first of them the cover" do
    create_photo(listing, position: 1, uploaded: false)
    create_photo(listing, position: 2, ready: false)
    third = create_photo(listing, position: 3)

    expect(listing.reload.ready_photos).to eq([ third ])
    expect(listing.cover_photo).to eq(third)
  end

  it "goes with its listing, and its files are deleted from storage" do
    photo = create_photo(listing)
    keys = %w[image image_card image_large].map { |field| "test/listing_photos/#{photo.id}/#{field}.jpg" }

    expect { listing.destroy! }.to change(described_class, :count).by(-1)
      .and have_enqueued_job(ListingPhotos::DeleteFilesJob).with(keys)
  end
end
