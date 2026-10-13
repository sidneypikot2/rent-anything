require "rails_helper"

RSpec.describe ListingPhoto do
  let(:listing) { create(:listing) }

  it "takes a JPEG, PNG or WebP image of at most 10 MB" do
    expect(listing.photos.build(position: 1, image: uploaded_photo)).to be_valid

    pdf = listing.photos.build(position: 1, image: uploaded_photo(content_type: "application/pdf"))
    expect(pdf).not_to be_valid
    expect(pdf.errors.full_messages).to eq([ "Image must be a JPEG, PNG or WebP image" ])

    large = uploaded_photo.tap { |blob| blob.update_column(:byte_size, 11.megabytes) }
    expect(errors_of(listing.photos.build(position: 1, image: large))).to eq([ "Image must be at most 10 MB" ])
  end

  it "needs an image" do
    expect(errors_of(listing.photos.build(position: 1))).to eq([ "Image is required" ])
  end

  # Specs never commit, so the deferred check is made immediate to see what a commit would do.
  def check_positions_now
    described_class.connection.execute("SET CONSTRAINTS listing_photos_listing_id_position_key IMMEDIATE")
  end

  def errors_of(photo)
    photo.validate
    photo.errors.full_messages
  end

  it "numbers a listing's photos once each, checked at commit so two can swap" do
    first = listing.photos.create!(position: 1, image: uploaded_photo)
    second = listing.photos.create!(position: 2, image: uploaded_photo)

    described_class.transaction do
      first.update!(position: 2)
      second.update!(position: 1)
    end
    expect { check_positions_now }.not_to raise_error
    expect(listing.photos.reload).to eq([ second, first ])

    expect { listing.photos.create!(position: 1, image: uploaded_photo) }.to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "keeps an image to one photo, so deleting one never purges another's" do
    blob = listing.photos.create!(position: 1, image: uploaded_photo).image.blob

    expect { create(:listing).photos.create!(position: 1, image: blob) }.to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "goes with its listing, and its image is deleted from storage" do
    photo = listing.photos.create!(position: 1, image: uploaded_photo)

    expect { listing.destroy! }.to change(described_class, :count).by(-1)
    expect(ActiveStorage::PurgeJob).to have_been_enqueued.with(photo.image.blob)
  end
end
