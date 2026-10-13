require "rails_helper"

RSpec.describe StayRate do
  let(:listing) { create(:listing, :stay, with_rate: false) }

  def rate(**attributes)
    described_class.new(listing:, nightly_price_cents: 200_000, **attributes)
  end

  def messages(record)
    record.tap(&:validate).errors.full_messages
  end

  it "prices accommodation only" do
    tour = create(:listing, category: create(:category, booking_type: "activity"))
    expect(messages(described_class.new(listing: tour, nightly_price_cents: 1)))
      .to include("Only accommodation is priced by the night")
  end

  it "keeps base guests within what the place sleeps" do
    expect(rate(base_guests: 4)).to be_valid
    expect(messages(rate(base_guests: 5))).to include("Guests included in the price can't be more than the 4 guests the place sleeps")
  end

  it "keeps the maximum nights from the minimum and the monthly discount from the weekly one" do
    expect(messages(rate(min_nights: 3, max_nights: 2))).to include("Maximum nights can't be fewer than the minimum nights")
    expect(messages(rate(weekly_discount_percent: 15, monthly_discount_percent: 10)))
      .to include("Monthly discount can't be less than the weekly discount")
    expect(rate(weekly_discount_percent: 15)).to be_valid
  end

  it "prices a shared room per guest: no base occupancy or extra-guest fee" do
    listing.update!(attrs: { "place_type" => "shared_room", "guests" => 6 })

    expect(rate(base_guests: 1)).to be_valid
    expect(messages(rate(base_guests: 2, extra_guest_fee_cents: 100))).to include(
      "Guests included in the price must be 1 for a shared room: it is priced per guest",
      "Extra-guest fee must be 0 for a shared room: it is priced per guest"
    )
  end

  it "has no price yet at zero, and the database refuses a negative price" do
    expect(rate(nightly_price_cents: 0)).not_to be_priced
    expect { rate.tap(&:save!).update_column(:nightly_price_cents, -1) }.to raise_error(ActiveRecord::StatementInvalid)
  end

  it "is back-filled at zero for accommodation listings without one, and for nothing else" do
    require Rails.root.join("db/migrate/20261014000001_create_stay_rates").to_s
    listing
    priced = create(:listing, :stay)
    create(:listing)

    expect { 2.times { CreateStayRates.backfill(ActiveRecord::Base.connection) } }.to change(described_class, :count).by(1)
    expect(listing.reload.stay_rate).to have_attributes(nightly_price_cents: 0, base_guests: 1, min_nights: 1)
    expect(priced.stay_rate.reload.nightly_price_cents).to eq(200_000)
  end

  it "goes with its listing" do
    rate.save!
    expect { listing.destroy! }.to change(described_class, :count).by(-1)
  end
end
