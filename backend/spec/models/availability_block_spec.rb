require "rails_helper"

RSpec.describe AvailabilityBlock do
  let(:listing) { create(:listing) }
  let(:today) { Date.current }

  it "never overlaps another of the listing's blocks, in the database" do
    listing.availability_blocks.create!(starts_on: today, ends_on: today + 2)
    create(:listing).availability_blocks.create!(starts_on: today, ends_on: today + 2)
    listing.availability_blocks.create!(starts_on: today + 3, ends_on: today + 3)
    expect { listing.availability_blocks.create!(starts_on: today + 2, ends_on: today + 5) }
      .to raise_error(ActiveRecord::StatementInvalid, /availability_blocks_no_overlap/)
  end

  it "doesn't end before it starts" do
    expect(described_class.new(listing:, starts_on: today, ends_on: today - 1)).not_to be_valid
  end
end
