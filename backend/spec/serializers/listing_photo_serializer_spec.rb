require "rails_helper"

RSpec.describe ListingPhotoSerializer do
  let(:listing) { create(:listing) }
  let!(:photo) { create_photo(listing, position: 1, ready: false) }
  let(:folder) { "https://photos.example.com/test/listing_photos/#{photo.id}" }

  before { stub_const("ENV", ENV.to_h.merge("R2_PUBLIC_URL" => "https://photos.example.com/")) }

  it "points at the bucket's public URL: the original until the photo is ready, then the sizes" do
    expect(described_class.partner(photo)).to eq(
      id: photo.id, uploaded: true, ready: false, card_url: "#{folder}/image.jpg", large_url: "#{folder}/image.jpg"
    )

    photo.update!(sized_at: Time.current)
    expect(described_class.call(photo)).to eq(card_url: "#{folder}/image_card.jpg", large_url: "#{folder}/image_large.jpg")
  end

  it "makes the first ready photo the cover, and a listing without one has none" do
    second = create_photo(listing, position: 2)

    expect(described_class.cover_url(listing.reload)).to eq(described_class.call(second)[:card_url])
    expect(described_class.cover_url(create(:listing))).to be_nil
  end
end
