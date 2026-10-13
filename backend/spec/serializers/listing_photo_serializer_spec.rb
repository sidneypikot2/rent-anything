require "rails_helper"

RSpec.describe ListingPhotoSerializer do
  let(:listing) { create(:listing) }
  let!(:photo) { listing.photos.create!(position: 1, image: uploaded_photo(filename: "front.jpg")) }

  context "on R2" do
    before do
      allow(Rails.configuration.active_storage).to receive(:service).and_return(:cloudflare)
      stub_const("ENV", ENV.to_h.merge("R2_PUBLIC_URL" => "https://photos.example.com/"))
    end

    it "points at the bucket's public URL: the original until a size is made, then the size" do
      expect(described_class.call(photo)).to eq(
        card_url: "https://photos.example.com/#{photo.image.key}", large_url: "https://photos.example.com/#{photo.image.key}"
      )

      photo.image.variant(:card).processed
      card_key = photo.image.variant(:card).key
      expect(card_key).not_to eq(photo.image.key)
      expect(described_class.call(ListingPhoto.includes(ListingPhoto::WITH_IMAGE).find(photo.id)))
        .to include(card_url: "https://photos.example.com/#{card_key}")
    end
  end

  context "on the local disk" do
    it "uses Active Storage's redirect URLs, on BACKEND_PUBLIC_URL when set" do
      stub_const("ENV", ENV.to_h.merge("BACKEND_PUBLIC_URL" => "http://localhost:3101"))

      expect(described_class.call(photo)[:card_url])
        .to start_with("http://localhost:3101/rails/active_storage/representations/redirect/")
    end
  end

  it "makes the first photo the cover, and a listing without photos has none" do
    listing.photos.create!(position: 2, image: uploaded_photo(filename: "back.jpg"))

    expect(described_class.cover_url(listing.reload)).to include("front")
    expect(described_class.cover_url(create(:listing))).to be_nil
  end
end
