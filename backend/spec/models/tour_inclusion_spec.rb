require "rails_helper"

RSpec.describe TourInclusion do
  let(:listing) { create(:listing, :tour) }

  it "takes the options of its kind, at least one where the kind has any" do
    expect(described_class.new(listing:, kind: "transport", options: %w[van])).to be_valid
    expect(described_class.new(listing:, kind: "accommodation")).to be_valid
    expect(described_class.new(listing:, kind: "meal", options: [])).not_to be_valid
    expect(described_class.new(listing:, kind: "meal", options: %w[brunch])).not_to be_valid
  end
end
