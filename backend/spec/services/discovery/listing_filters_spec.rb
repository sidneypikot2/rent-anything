require "rails_helper"

RSpec.describe Discovery::ListingFilters do
  let(:area) { create(:area) }
  # A card per business and title, as the plan's and What to book's rental cards.
  let(:card_sql) { "listings.business_id::text || '-' || LOWER(TRIM(listings.title))" }
  let(:rentals) { Listing.active.in_guest_group("rental") }

  # attrs go in after the create: these are the keys a guest sees, set without each category's schema.
  def rental(name, title, cents:, attrs: {}, category: :motorcycle, policy: "non_refundable", delivery: nil)
    business = Business.find_by(name:) || create(:business, name:)
    listing = create(:listing, :vehicle, area:, business:, partner: business.partner, title:, cancellation_policy: policy,
      category: create(:category, category))
    listing.update_column(:attrs, listing.attrs.merge(attrs))
    # Straight to the columns: whether drop-off is offered, without its delivery zones.
    listing.vehicle_rate.update_columns(daily_price_cents: cents, delivery_fee_cents: delivery, return_pickup_fee_cents: nil)
    listing
  end

  def ids(params) = described_class.new(params).apply(rentals).pluck(:id).sort

  let!(:click) { rental("Alpha", "Honda Click scooter", cents: 30_000, attrs: { "amenities" => %w[rider_helmet] }) }
  let!(:click_two) do
    rental("Alpha", "Honda Click scooter", cents: 90_000, policy: "free_cancellation", delivery: 0,
      attrs: { "amenities" => %w[rider_helmet raincoat] })
  end
  let!(:vios) do
    rental("Beta", "Toyota Vios sedan", cents: 250_000, category: :car, policy: "seven_days",
      attrs: { "transmission" => "manual", "amenities" => %w[air_conditioning], "licence_required" => true })
  end

  describe "#apply" do
    it "keeps each listing that passes, alone" do
      expect(ids(free_cancellation: "true")).to eq([ click_two.id, vios.id ].sort)
      expect(ids(min_price_cents: "50000", max_price_cents: "100000")).to eq([ click_two.id ])
      expect(ids(kinds: %w[car])).to eq([ vios.id ])
      expect(ids(transmissions: %w[automatic])).to eq([ click.id, click_two.id ].sort)
      expect(ids(delivery: "1")).to eq([ click_two.id ])
      expect(ids(includes: %w[amenity:raincoat])).to eq([ click_two.id ])
      expect(ids(includes: %w[licence amenity:air_conditioning])).to eq([ vios.id ])
      expect(ids(q: "toyota sedans")).to eq([ vios.id ])
      expect(ids(q: "alpha")).to eq([ click.id, click_two.id ].sort)
    end

    it "drops unpriced listings while a price is set" do
      click.vehicle_rate.update_columns(daily_price_cents: 0)
      expect(ids(max_price_cents: "100000")).to eq([ click_two.id ])
    end
  end

  describe "#facets" do
    it "counts each choice in cards, includes among the cards the other filters leave" do
      facets = described_class.new(includes: %w[licence], transmissions: %w[automatic]).facets(rentals, card_sql)
      expect(facets).to include(
        cards: 2, free_cancellation: 2, pets: 0, price_min_cents: 30_000, price_max_cents: 250_000, unpriced: false,
        delivery: 1, pickup: 0, child_helmets: 0, unpriced_booking_type: nil,
        kinds: [ { value: "car", label: "Car", count: 1 }, { value: "motorcycle", label: "Motorcycle", count: 1 } ],
        transmissions: [ { value: "automatic", count: 1 }, { value: "manual", count: 1 } ],
        shared: { includes: [], pets: false, cancellation_policy: nil }
      )
      expect(facets[:includes]).to eq([ { key: "amenity:raincoat", count: 1 }, { key: "amenity:rider_helmet", count: 1 }, { key: "licence", count: 0 } ])
    end

    it "counts only what the search finds, and says what every listing shares" do
      facets = described_class.new(q: "honda").facets(rentals, card_sql)
      expect(facets).to include(cards: 1, price_min_cents: 30_000, price_max_cents: 90_000)
      expect(facets[:shared]).to eq(includes: [], pets: false, cancellation_policy: nil)

      vios.update_columns(title: "Honda City sedan", attrs: vios.attrs.merge("amenities" => %w[rider_helmet]))
      expect(described_class.new(q: "honda").facets(rentals, card_sql)[:shared])
        .to eq(includes: %w[amenity:rider_helmet], pets: false, cancellation_policy: nil)
    end
  end

  it "reads bad values as errors" do
    filters = described_class.new(pets: "maybe", min_price_cents: "-1", kinds: "car", q: 5)
    expect(filters.errors).to contain_exactly(
      "Pets must be true or false", "Min price cents must be a whole number from 0", "Kinds must be a list of words", "Q must be text"
    )
  end
end
