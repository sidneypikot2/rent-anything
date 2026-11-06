require "rails_helper"

RSpec.describe Notifications::RequestDetails do
  def rows(booking)
    described_class.call(booking)[:rows].to_h
  end

  it "gives the partner's payout, reference and deadline, and never the total or the commission" do
    booking = create(:booking, :checkout, status: "requested", total_cents: 450_050, commission_cents: 45_000,
      expires_at: Time.utc(2030, 3, 1, 4, 0))
    details = described_class.call(booking)

    expect(details).to include(payout: "₱4,050.50", reference: booking.reference, answer_by: "Mar 1, 12:00 PM")
    expect(details.to_s).not_to include("4,500", "₱450", "Commission", "Total")
  end

  it "gives a stay's check-in, check-out, nights, rooms and pets" do
    listing = create(:listing, :stay)
    booking = create(:booking, :checkout, listing:, status: "requested", guest_name: "Ana Cruz", starts_on: Date.new(2030, 3, 10),
      ends_on: Date.new(2030, 3, 13), guests: 3, quantity: 2, room_guests: [ { adults: 2, children: 0 }, { adults: 1, children: 0 } ], pets: 1)

    expect(rows(booking)).to include("Listing" => listing.title, "Business" => listing.business.name, "Guest" => "Ana Cruz",
      "Check-in" => "Mar 10, 2030", "Check-out" => "Mar 13, 2030", "Nights" => "3", "Party" => "3 guests, 2 rooms, 1 pet")
  end

  it "gives a rental's pickup and return in the area's time, and whether the shop delivers" do
    listing = create(:listing, :vehicle)
    booking = create(:booking, :checkout, listing:, status: "requested", starts_on: Date.new(2030, 3, 10), ends_on: Date.new(2030, 3, 12),
      starts_at: Time.utc(2030, 3, 10, 1, 30), ends_at: Time.utc(2030, 3, 12, 1, 30), delivery: true, return_pickup: true,
      delivery_address: "Santa Fe port")

    expect(rows(booking)).to include("Pickup" => "Mar 10, 2030, 9:30 AM", "Return" => "Mar 12, 2030, 9:30 AM",
      "Delivery" => "Delivery and return pick-up")
    expect(rows(booking)).not_to include("Dates")
  end

  it "gives gear's count without guests" do
    booking = create(:booking, :checkout, listing: create(:listing, :gear), status: "requested", guests: nil, quantity: 3)

    expect(rows(booking)).to include("Party" => "3 units")
  end

  it "gives a joiner tour's dates and guests, without counting them twice" do
    listing = create(:listing, :tour)
    listing.tour_detail.update!(tour_type: "joiner")
    booking = create(:booking, :checkout, listing:, status: "requested", starts_on: Date.new(2030, 3, 10), ends_on: Date.new(2030, 3, 10),
      guests: 4, quantity: 4)

    expect(rows(booking)).to include("Dates" => "Mar 10, 2030", "Party" => "4 guests")
  end

  it "says a price still to be agreed" do
    booking = create(:booking, :checkout, status: "requested", price_breakdown: { "to_be_agreed" => true })

    expect(described_class.call(booking)[:payout]).to eq("To be agreed with the guest")
  end

  it "keeps the guest's contact details, notes and address for the site" do
    booking = create(:booking, :checkout, listing: create(:listing, :vehicle), status: "requested", guest_email: "ana@example.com",
      guest_phone: "+639171234567", notes: "Arriving late", delivery: true, delivery_address: "Santa Fe port")

    expect(described_class.call(booking).to_s).not_to include("ana@example.com", "+639171234567", "Arriving late", "Santa Fe port")
  end
end
