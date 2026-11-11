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
  let(:from) { nil }
  let(:to) { nil }
  let(:facets) { nil }
  let(:counts) { nil }

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
        "cards per group with the search."
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
      parameter name: :from, in: :query, type: :string, format: :date, required: false,
        description: "With to: only listings with a unit free on these dates (a stay's or rental's nights from from to the day before to)"
      parameter name: :to, in: :query, type: :string, format: :date, required: false,
        description: "The last day, with from (at most #{Discovery::BookCards::MAX_DAYS} days after it)"
      parameter name: :facets, in: :query, type: :boolean, required: false,
        description: "false leaves the filter sheet's counts out (a section's later pages); true by default"
      parameter name: :counts, in: :query, type: :boolean, required: false,
        description: "false leaves the per-group counts out (the web app asks book_counts once instead); true by default"
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
            expect(json["facets"]).to include("cards" => 3, "free_cancellation" => 1, "unpriced" => true,
              "unpriced_booking_type" => "rental")
          end
        end

        context "a later page, without the filter sheet's counts" do
          let(:page) { 2 }
          let(:per_page) { 2 }
          let(:facets) { "false" }

          run_test! do |response|
            json = response.parsed_body
            expect(json["cards"].map { |card| card["listings"].pluck("id") }).to eq([ [ unpriced.id ] ])
            expect(json).to include("facets" => nil, "total" => 3, "page" => 2)
          end
        end

        context "without the per-group counts" do
          let(:counts) { "false" }

          run_test! do |response|
            expect(response.parsed_body).to include("counts" => nil, "total" => 3)
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
            expect(json).to include("total" => 1, "counts" => include("rental" => 1, "stay" => 0))
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

      response "200", "each listing as a browse row" do
        schema "$ref" => "#/components/schemas/book_cards"

        def rows(response) = response.parsed_body["cards"].flat_map { _1["listings"] }.index_by { _1["title"] }

        context "a row names its place and summary and carries its first ready photos (RAA-124)" do
          let!(:honda) do
            rental("Alpha", "Honda Click 125", area: santa_fe)
              .tap { _1.update!(description: "\n  Four islands and a sandbar in one day.  \nLunch included.") }
          end

          before do
            create_photo(honda, ready: false)
            7.times { create_photo(honda) }
          end

          run_test! do |response|
            row = rows(response)["Honda Click 125"]
            expect(row).to include("area_slug" => "santa-fe", "area_name" => "Santa Fe", "summary" => "Four islands and a sandbar in one day.",
              "group" => "rental", "business" => { "id" => honda.business_id, "name" => "Alpha" })
            expect(row["photos"].size).to eq(6)
            expect(row["photos"].first.keys).to eq(%w[card_url large_url])
          end
        end

        context "a vehicle's row says whether the shop delivers and collects it, priced or not (RAA-204)" do
          before do
            door = rental("Door", "Door-to-door bike").vehicle_rate
            door.update!(child_helmet_fee_cents: 0)
            deliver_within(door, [ [ 1000, 0 ], [ 3000, 15_000 ] ])
            deliver_within(rental("Drop", "Drop-off bike").vehicle_rate, [ [ 2000, 10_000 ] ], picks_up: false)
            rental("Shop", "Shop-only bike")
            rental("Unpriced", "Unpriced shop bike", cents: 0)
          end

          run_test! do |response|
            rows = rows(response)
            handover = ->(title) { rows[title]["handover"]&.values_at("delivery_fee_cents", "return_pickup_fee_cents") }
            expect(handover.call("Door-to-door bike")).to eq([ 0, 0 ])
            expect(handover.call("Drop-off bike")).to eq([ 10_000, nil ])
            expect(handover.call("Shop-only bike")).to eq([ nil, nil ])
            expect(handover.call("Unpriced shop bike")).to eq([ nil, nil ])
            expect(rows["Door-to-door bike"]["handover"]["child_helmet_fee_cents"]).to eq(0)
            expect(rows["Drop-off bike"]["handover"]["child_helmet_fee_cents"]).to be_nil
          end
        end

        context "a stay's row says its nightly price once it has one (RAA-104)" do
          let(:group) { "stay" }

          before do
            create(:listing, :stay, area: bantayan, title: "Kota Beach house")
            create(:listing, :stay, area: bantayan, title: "Unpriced house").stay_rate.update_columns(nightly_price_cents: 0)
          end

          run_test! do |response|
            rows = rows(response)
            expect(rows["Kota Beach house"].values_at("price_from_cents", "price_unit", "handover")).to eq([ 200_000, "night", nil ])
            expect(rows["Unpriced house"]["price_from_cents"]).to be_nil
          end
        end

        context "a tour's row says its kind and the group it takes" do
          let(:group) { "activity" }

          before { create(:listing, :tour, area: bantayan, title: "Sandbar joiner") }

          run_test! do |response|
            expect(rows(response)["Sandbar joiner"]["tour"]).to include("tour_type" => "joiner", "min_guests" => 2, "max_guests" => 12, "start_times" => [])
          end
        end
      end

      response "200", "only what is free on the dates" do
        schema "$ref" => "#/components/schemas/book_cards"

        let(:group) { "stay" }
        let(:from) { (Date.current + 10).iso8601 }
        let(:to) { (Date.current + 12).iso8601 }
        let!(:booked) { create(:listing, :stay, area: bantayan, title: "Booked beach inn") }
        let!(:blocked) { create(:listing, :stay, area: bantayan, title: "Blocked beach inn") }
        let!(:leaving) { create(:listing, :stay, area: bantayan, title: "Leaving beach inn") }
        let!(:open) { create(:listing, :stay, area: bantayan, title: "Open beach inn") }
        # Nothing booked, but nothing to book either.
        let!(:unitless) { create(:listing, :stay, area: bantayan, title: "Unitless beach inn") }
        before do
          [ booked, blocked, leaving, open ].each { |listing| listing.units.drop(1).each(&:destroy) }
          unitless.units.each(&:destroy)
          create(:booking, listing: booked.reload, starts_on: Date.current + 11, ends_on: Date.current + 13)
          create(:availability_block, listing: blocked, starts_on: Date.current + 10, ends_on: Date.current + 10)
          # Checks in on the guest's last day: their nights end the night before.
          create(:booking, listing: leaving.reload, starts_on: Date.current + 12, ends_on: Date.current + 14)
        end

        run_test! do |response|
          json = response.parsed_body
          ids = json["cards"].flat_map { |card| card["listings"].pluck("id") }
          expect(ids).to contain_exactly(leaving.id, open.id)
          expect(json).to include("total" => 2, "counts" => include("stay" => 2))
        end

        # A tour's room is its groups a day (its tour details), not units.
        context "a tour nothing holds" do
          let(:group) { "activity" }
          let!(:tour) { create(:listing, :tour, area: bantayan, title: "Sandbar joiner") }

          run_test! do |response|
            ids = response.parsed_body["cards"].flat_map { |card| card["listings"].pluck("id") }
            expect(ids).to include(tour.id)
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

        context "dates out of order" do
          let(:per_page) { nil }
          let(:"kinds[]") { nil }
          let(:from) { (Date.current + 5).iso8601 }
          let(:to) { (Date.current + 2).iso8601 }

          run_test! do |response|
            expect(response.parsed_body.to_s).to include("To must be on or after from")
          end
        end

        context "only one date" do
          let(:per_page) { nil }
          let(:"kinds[]") { nil }
          let(:from) { Date.current.iso8601 }

          run_test! do |response|
            expect(response.parsed_body.to_s).to include("From and to must both be dates")
          end
        end
      end
    end
  end
end
