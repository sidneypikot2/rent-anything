require "rails_helper"

RSpec.describe PhotoStorage, ".copy_root" do
  before do
    PhotoStorage.client.stub_responses(:list_objects_v2, lambda { |context|
      keys = {
        "production/" => %w[production/listing_photos/1/image.jpg production/listing_photos/1/image_card.webp],
        "staging/" => %w[staging/listing_photos/1/image.jpg]
      }.fetch(context.params[:prefix], [])
      { contents: keys.map { |key| { key: } } }
    })
  end

  it "copies the keys the destination is missing and skips the rest" do
    expect(described_class.copy_root(from: "production", to: "staging")).to eq(copied: 1, skipped: 1)

    copies = storage_requests(:copy_object).map { |request| request[:params].slice(:copy_source, :key) }
    expect(copies).to eq([ { copy_source: "#{described_class.bucket}/production/listing_photos/1/image_card.webp",
                             key: "staging/listing_photos/1/image_card.webp" } ])
  end

  it "refuses to copy a root onto itself" do
    expect { described_class.copy_root(from: "staging", to: "staging") }.to raise_error(ArgumentError)
  end
end
