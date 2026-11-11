require "rails_helper"

# listings.price_from_cents (2026-11-11): the listing's from-price stored on it, kept by the
# database as its rates, tour, offers and activity details change, so browsing sorts and filters
# by price without working it out per row. It must always equal PricingSerializer.price_from_cents.
RSpec.describe "A listing's stored from-price" do
  def stored(listing) = listing.reload.price_from_cents
  def ruby(listing) = PricingSerializer.price_from_cents(listing.reload)

  it "follows a stay's nightly price, and is null while it has none" do
    listing = create(:listing, :stay)
    expect(stored(listing)).to eq(ruby(listing)).and be_positive

    listing.stay_rate.update!(nightly_price_cents: 350_000)
    expect(stored(listing)).to eq(350_000)

    listing.stay_rate.update!(nightly_price_cents: 0)
    expect(stored(listing)).to be_nil
    expect(ruby(listing)).to be_nil
  end

  it "follows a vehicle's daily price and a transfer's flat price" do
    vehicle = create(:listing, :vehicle)
    vehicle.vehicle_rate.update!(daily_price_cents: 70_000)
    expect(stored(vehicle)).to eq(70_000)

    transfer = create(:listing, :transfer)
    expect(stored(transfer)).to eq(150_000)
    transfer.flat_rate.destroy!
    expect(stored(transfer)).to be_nil
  end

  it "follows a tour's base price" do
    tour = create(:listing, :tour)
    expect(stored(tour)).to eq(ruby(tour)).and be_positive
    tour.tour_detail.update!(base_price_cents: 99_000)
    expect(stored(tour)).to eq(99_000)
  end

  it "takes a water activity's cheapest current offer, not an archived one" do
    ride = create(:listing, :water_activity)
    cheap = create(:activity_offer, listing: ride, name: "15 minutes", price_cents: 80_000, position: 1)
    expect(stored(ride)).to eq(80_000)

    cheap.update!(archived_at: Time.current)
    expect(stored(ride)).to eq(ruby(ride)).and eq(150_000)
  end
end
