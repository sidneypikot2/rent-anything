require "rails_helper"

RSpec.describe TourDetail do
  let(:listing) { create(:listing, :tour, with_detail: false) }

  def detail(**attributes)
    build(:tour_detail, listing:, **attributes)
  end

  def messages(record)
    record.tap(&:validate).errors.full_messages
  end

  it "belongs to tours only" do
    other = create(:listing, category: create(:category, booking_type: "activity"))
    expect(messages(detail(listing: other))).to include("Only tours have tour details")
  end

  it "keeps the group size and duration in range" do
    expect(detail).to be_valid
    expect(messages(detail(min_guests: 5, max_guests: 4))).to include("Max guests can't be fewer than the minimum guests")
    expect(messages(detail(duration_value: 25))).to include("Duration value can be at most 24 hours")
    expect(detail(duration_value: 30, duration_unit: "days")).to be_valid
    expect(messages(detail(tour_type: "both"))).to include("Tour type is not included in the list")
  end

  it "prices a private tour per group and a joiner tour per person" do
    expect(detail(tour_type: "private").price_unit).to eq("group")
    expect(detail(tour_type: "joiner").price_unit).to eq("person")
  end

  it "is checked by the database too" do
    record = create(:tour_detail, listing:)
    expect { record.update_columns(max_guests: 1, min_guests: 2) }.to raise_error(ActiveRecord::StatementInvalid)
  end
end
