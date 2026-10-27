require "rails_helper"

RSpec.describe Stays::Quote do
  include ActiveSupport::Testing::TimeHelpers

  # 2026-11-02 is a Monday.
  let(:monday) { Date.new(2026, 11, 2) }
  let(:listing) { create(:listing, :stay) }
  let(:rate) { listing.stay_rate }

  before { travel_to Date.new(2026, 10, 1) }

  def quote(nights: 2, guests: 2, starts_on: monday, fee_ids: [])
    described_class.call(listing.reload, starts_on:, ends_on: starts_on + nights, guests:, fee_ids:)
  end

  def errors_for(**options)
    quote(**options)
  rescue ActiveRecord::RecordInvalid => e
    e.record.errors.full_messages
  end

  it "charges the nightly price for each night, for up to the base guests" do
    expect(quote(nights: 2, guests: 2)).to include(
      nights_count: 2, nightly_subtotal_cents: 400_000, extra_guests: 0, extra_guests_total_cents: 0,
      discount: nil, fees: [], total_cents: 400_000
    )
  end

  it "charges the weekend price for Friday and Saturday nights" do
    rate.update!(weekend_price_cents: 300_000)

    result = quote(starts_on: monday + 3, nights: 3) # Thursday, Friday, Saturday nights
    expect(result[:nights]).to eq([
      { date: monday + 3, price_cents: 200_000, weekend: false },
      { date: monday + 4, price_cents: 300_000, weekend: true },
      { date: monday + 5, price_cents: 300_000, weekend: true }
    ])
    expect(result[:total_cents]).to eq(800_000)
  end

  it "charges each guest above the base guests the extra-guest fee per night" do
    rate.update!(extra_guest_fee_cents: 50_000)

    expect(quote(nights: 2, guests: 4)).to include(
      extra_guests: 2, extra_guest_fee_cents: 50_000, extra_guests_total_cents: 200_000, total_cents: 600_000
    )
  end

  it "takes the weekly discount from 7 nights and the monthly one from 28, off the nights and extra guests" do
    rate.update!(extra_guest_fee_cents: 50_000, weekly_discount_percent: 10, monthly_discount_percent: 25)

    expect(quote(nights: 6, guests: 3)[:discount]).to be_nil
    expect(quote(nights: 7, guests: 3)).to include(
      discount: { kind: "weekly", percent: 10, amount_cents: 175_000 }, total_cents: 1_575_000
    )
    expect(quote(nights: 28, guests: 3)[:discount]).to eq(kind: "monthly", percent: 25, amount_cents: 1_750_000)
  end

  it "prices a shared room per guest" do
    listing.update!(attrs: { "place_type" => "shared_room", "guests" => 6 })
    (2..3).each { listing.units.create!(position: _1) }
    rate.update!(base_guests: 1, nightly_price_cents: 60_000)

    expect(quote(nights: 2, guests: 3)).to include(per_guest: true, nightly_subtotal_cents: 360_000, extra_guests: 0,
      total_cents: 360_000)
  end

  it "adds the required fees and the chosen add-ons by what they are charged per, undiscounted" do
    rate.update!(weekly_discount_percent: 10)
    create(:listing_fee, listing:, name: "Cleaning fee", amount_cents: 80_000, charged_per: "booking", position: 1)
    create(:listing_fee, listing:, name: "Environmental fee", amount_cents: 5_000, charged_per: "guest", position: 2)
    create(:listing_fee, listing:, name: "Breakfast", amount_cents: 25_000, charged_per: "guest_night", required: false,
      position: 3)
    kayak = create(:listing_fee, listing:, name: "Kayak", amount_cents: 30_000, charged_per: "night", required: false,
      position: 4)

    result = quote(nights: 7, guests: 2, fee_ids: [ kayak.id ])
    expect(result[:fees].map { _1.slice(:name, :quantity, :total_cents) }).to eq([
      { name: "Cleaning fee", quantity: 1, total_cents: 80_000 },
      { name: "Environmental fee", quantity: 2, total_cents: 10_000 },
      { name: "Kayak", quantity: 7, total_cents: 210_000 }
    ])
    expect(result[:total_cents]).to eq(1_400_000 - 140_000 + 300_000)
  end

  describe "several rooms (RAA-182)" do
    before do
      listing.update!(attrs: { "place_type" => "entire_place", "guests" => 4, "pets_allowed" => true })
      (2..3).each { listing.units.create!(position: _1) }
    end

    it "prices each room for its own guests, and a fee per pet once for the stay" do
      rate.update!(extra_guest_fee_cents: 50_000)
      create(:listing_fee, listing:, name: "Pet fee", amount_cents: 30_000, charged_per: "pet_night", position: 1)

      result = described_class.call(listing.reload, starts_on: monday, ends_on: monday + 2, adults: 5, pets: 2,
        room_guests: [ { adults: 1 }, { adults: 4 } ])
      expect(result[:rooms].map { _1.slice(:adults, :extra_guests, :total_cents) }).to eq([
        { adults: 1, extra_guests: 0, total_cents: 400_000 }, { adults: 4, extra_guests: 2, total_cents: 600_000 }
      ])
      expect(result[:fees]).to contain_exactly(include(name: "Pet fee", quantity: 4, total_cents: 120_000))
      expect(result).to include(extra_guests: 2, rooms_free: 3, pets: 2, total_cents: 1_120_000)
    end

    it "charges extra guests on who takes a bed: adults, and children and infants as the place counts them" do
      rate.update!(extra_guest_fee_cents: 50_000)
      stay = ->(**party) { described_class.call(listing.reload, starts_on: monday, ends_on: monday + 1, **party) }

      expect(stay.(adults: 2, children: 1, infants: 1)).to include(extra_guests: 1, total_cents: 250_000)
      listing.update!(attrs: listing.attrs.merge("children_count" => false, "infants_count" => true))
      expect(stay.(adults: 2, children: 1, infants: 1)).to include(extra_guests: 1, total_cents: 250_000)
      listing.update!(attrs: listing.attrs.merge("children_count" => false, "infants_count" => false))
      expect(stay.(adults: 2, children: 1, infants: 1)).to include(extra_guests: 0, total_cents: 200_000)
    end

    it "refuses more rooms than are left on a night" do
      create(:booking, listing:, starts_on: monday, ends_on: monday + 1)

      expect { described_class.call(listing.reload, starts_on: monday, ends_on: monday + 2, adults: 9) }
        .to raise_error(ActiveRecord::RecordInvalid, /Only 2 left on Nov 2/)
    end
  end

  it "refuses a stay outside the minimum and maximum nights" do
    rate.update!(min_nights: 2, max_nights: 5)

    expect(errors_for(nights: 1)).to eq([ "This place needs a stay of at least 2 nights" ])
    expect(errors_for(nights: 6)).to eq([ "This place takes stays of at most 5 nights" ])
  end

  it "follows the partner calendar: a day's own price and minimum nights (RAA-118)" do
    create(:listing_day, listing:, date: monday + 1, price_cents: 250_000)
    expect(quote(nights: 2)[:nights].pluck(:price_cents)).to eq([ 200_000, 250_000 ])

    create(:listing_day, listing:, date: monday, price_cents: nil, min_nights: 3)
    expect(errors_for(nights: 2)).to eq([ "This place needs a stay of at least 3 nights" ])
    expect(quote(starts_on: monday + 1, nights: 1)[:total_cents]).to eq(250_000)
  end

  it "refuses a night that is blocked or fully booked, but not the check-out day (RAA-118)" do
    create(:availability_block, listing:, starts_on: monday + 1, ends_on: monday + 1)
    expect(errors_for(nights: 2)).to eq([ "Those dates aren't available: Nov 3 is blocked" ])

    create(:booking, listing:, starts_on: monday + 4, ends_on: monday + 6)
    expect(errors_for(starts_on: monday + 5, nights: 1)).to eq([ "Those dates aren't available: Nov 7 is fully booked" ])
    expect(quote(starts_on: monday + 2, nights: 2)[:nights_count]).to eq(2)
    expect(quote(starts_on: monday + 6, nights: 1)[:nights_count]).to eq(1)
  end

  it "refuses more guests than the place sleeps, and no guests" do
    expect(errors_for(guests: 5)).to eq([ "This place sleeps at most 4 guests" ])
    expect(errors_for(guests: 0)).to eq([ "Guests must be at least 1" ])
  end

  it "refuses dates that aren't a stay" do
    expect(errors_for(nights: 0)).to eq([ "Check-out must be after check-in" ])
    expect(errors_for(starts_on: Date.new(2026, 9, 30))).to eq([ "Check-in can't be in the past" ])
  end

  it "refuses a place with no price yet" do
    rate.update!(nightly_price_cents: 0)

    expect(errors_for).to eq([ "This place has no price yet" ])
  end

  it "refuses an add-on that isn't one of the listing's optional fees" do
    required = create(:listing_fee, listing:, position: 1)
    other = create(:listing_fee, required: false)

    expect(errors_for(fee_ids: [ required.id ])).to eq([ "Add-ons must be this place's optional fees" ])
    expect(errors_for(fee_ids: [ other.id ])).to eq([ "Add-ons must be this place's optional fees" ])
  end
end
