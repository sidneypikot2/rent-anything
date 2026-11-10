require "swagger_helper"

RSpec.describe "Book cards", type: :request do
  let!(:bantayan) { create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island") }
  let!(:santa_fe) { create(:area, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan) }
  let!(:hidden) { create(:area, :draft, slug: "madridejos", name: "Madridejos", kind: "town", parent: bantayan) }

  let(:slug) { "bantayan-island" }
  let(:group) { "rental" }
  let(:page) { nil }
  let(:per_page) { nil }
  let(:around) { nil }
  let(:"listing_ids[]") { nil }

  # A rental of its own business, named so the order shows.
  def rental(business_name, title, cents: 50_000, policy: "non_refundable", area: bantayan)
    business = Business.find_by(name: business_name) || create(:business, name: business_name)
    create(:listing, :vehicle, area:, business:, partner: business.partner, title:, cancellation_policy: policy)
      .tap { |listing| listing.vehicle_rate.update_columns(daily_price_cents: cents) }
  end

  path "/api/v1/areas/{slug}/book_cards" do
    get "A page of one What to book section's cards in a place" do
      tags "Discovery"
      produces "application/json"
      description "What to book: the cards of one guest group here and in the published places inside it, a stay's per " \
        "business, any other per business and listing title, each with its listings as browse rows; priced first, then " \
        "by title. The filters and search apply listing by listing; facets count the filter sheet's choices, counts the " \
        "cards per group with the search, pin_ids every listing that passes."
      parameter name: :slug, in: :path, type: :string
      parameter name: :group, in: :query, required: true, schema: { type: :string, enum: Category::GUEST_GROUPS }
      parameter name: :page, in: :query, type: :integer, required: false, description: "From 1 (the default)"
      parameter name: :per_page, in: :query, type: :integer, required: false,
        description: "1 to #{Discovery::BookCards::PER_PAGE} (the default)"
      parameter name: :around, in: :query, type: :integer, required: false,
        description: "A listing id: answers with the page holding its card (a link to its row)"
      parameter name: :"listing_ids[]", in: :query, required: false, style: :form, explode: true,
        schema: { type: :array, items: { type: :integer } },
        description: "Only these listings, in this order (the map's distance search)"
      listing_filter_parameters

      response "200", "a page of cards, priced first, a card with its listings" do
        schema "$ref" => "#/components/schemas/book_cards"

        let!(:beat) { rental("Alpha", "Honda Beat scooter", cents: 40_000) }
        let!(:beat_two) { rental("Alpha", " honda beat scooter", cents: 0, area: santa_fe) }
        let!(:unpriced) { rental("Aardvark", "Unpriced scooter", cents: 0) }
        let!(:vios) { rental("Beta", "Toyota Vios sedan", policy: "free_cancellation") }
        before do
          rental("Gamma", "Draft town scooter", area: hidden)
          create(:listing, :stay, area: bantayan)
        end

        context "the first page" do
          run_test! do |response|
            json = response.parsed_body
            expect(json["cards"].map { |card| card["listings"].pluck("id") }).to eq([ [ beat.id, beat_two.id ], [ vios.id ], [ unpriced.id ] ])
            expect(json["cards"].first).to include("key" => "#{beat.business_id}-#{beat.id}")
            expect(json).to include("total" => 3, "page" => 1, "per_page" => 18,
              "counts" => { "stay" => 1, "transfer" => 0, "rental" => 3, "activity" => 0, "gear" => 0 })
            expect(json["pin_ids"]).to eq([ beat.id, beat_two.id, unpriced.id, vios.id ].sort)
            expect(json["facets"]).to include("cards" => 3, "free_cancellation" => 1, "unpriced" => true,
              "unpriced_booking_type" => "rental")
          end
        end

        context "a small page around a listing" do
          let(:per_page) { 1 }
          let(:around) { vios.id }

          run_test! do |response|
            json = response.parsed_body
            expect(json["cards"].map { |card| card["listings"].pluck("id") }).to eq([ [ vios.id ] ])
            expect(json).to include("page" => 2, "per_page" => 1, "total" => 3)
          end
        end

        context "filtered and searched" do
          let(:free_cancellation) { true }
          let(:q) { "toyota" }

          run_test! do |response|
            json = response.parsed_body
            expect(json["cards"].map { |card| card["listings"].pluck("id") }).to eq([ [ vios.id ] ])
            expect(json).to include("total" => 1, "pin_ids" => [ vios.id ], "counts" => include("rental" => 1, "stay" => 0))
            expect(json["facets"]).to include("cards" => 1)
          end
        end

        context "a distance search, in its order" do
          let(:"listing_ids[]") { [ unpriced.id, vios.id ] }

          run_test! do |response|
            json = response.parsed_body
            expect(json["cards"].map { |card| card["listings"].pluck("id") }).to eq([ [ unpriced.id ], [ vios.id ] ])
            expect(json["total"]).to eq(2)
          end
        end
      end

      response "404", "a draft place" do
        let(:slug) { "madridejos" }

        run_test!
      end

      response "422", "bad paging or filters" do
        let(:per_page) { 50 }
        let(:"kinds[]") { [ "" ] }

        run_test! do |response|
          expect(response.parsed_body.to_s).to include("Per page must be a whole number from 1 to 18", "Kinds must be a list of words")
        end
      end
    end
  end
end
