require "rails_helper"

RSpec.describe Tours::Schedule do
  let(:listing) { create(:listing, :tour) }
  # A Monday.
  let(:monday) { Date.new(2026, 10, 19) }

  def schedule
    described_class.new(Listing.includes(*Listing::TOUR_ASSOCIATIONS).find(listing.id))
  end

  it "runs every day on a daily schedule" do
    expect((monday...monday + 7).map { schedule.open_on?(_1) }).to all(be(true))
  end

  it "runs on its weekdays only: weekends, Saturdays, weekdays" do
    listing.tour_detail.update!(weekdays: [ 0, 6 ])
    expect(schedule.open_dates(from: monday, days: 7)).to eq([ monday + 5, monday + 6 ])
    listing.tour_detail.update!(weekdays: [ 6 ])
    expect(schedule.open_dates(from: monday, days: 14)).to eq([ monday + 5, monday + 12 ])
    listing.tour_detail.update!(weekdays: [ 1, 2, 3, 4, 5 ])
    expect(schedule.open_dates(from: monday, days: 7)).to eq((monday..monday + 4).to_a)
  end

  it "runs on its extra dates, and on those alone with no weekdays" do
    listing.tour_detail.update!(weekdays: [])
    listing.tour_dates.create!(date: monday + 2)
    expect(schedule.open_dates(from: monday, days: 7)).to eq([ monday + 2 ])
    listing.tour_detail.update!(weekdays: [ 6 ])
    expect(schedule.open_dates(from: monday, days: 7)).to eq([ monday + 2, monday + 5 ])
  end

  it "doesn't run on a blocked day or range, whatever its weekdays and dates" do
    listing.tour_dates.create!(date: monday + 1)
    listing.availability_blocks.create!(starts_on: monday + 1, ends_on: monday + 1, reason: "Fiesta")
    listing.availability_blocks.create!(starts_on: monday + 4, ends_on: monday + 5)
    expect(schedule.open_dates(from: monday, days: 7)).to eq([ monday, monday + 2, monday + 3, monday + 6 ])
  end

  it "never runs without tour details" do
    expect(described_class.new(create(:listing)).open_on?(monday)).to be(false)
  end
end
