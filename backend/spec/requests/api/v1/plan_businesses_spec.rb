require "swagger_helper"

RSpec.describe "Plan businesses", type: :request do
  let!(:bantayan) { create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island") }
  let!(:santa_fe) { create(:area, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan) }
  let!(:hidden) { create(:area, :draft, slug: "madridejos", name: "Madridejos", kind: "town", parent: bantayan) }
  let!(:elsewhere) { create(:area, slug: "oslob", name: "Oslob") }

  let!(:kota) { create(:landmark, area: bantayan, slug: "kota-beach", name: "Kota Beach") }
  let!(:virgin) { create(:landmark, area: bantayan, slug: "virgin-island", name: "Virgin Island") }
  let!(:draft_cove) { create(:landmark, :draft, area: bantayan, slug: "draft-cove", name: "Draft Cove") }

  # A tour from a business of its own, named so the order by name shows.
  def tour_by(name)
    business = create(:business, name:)
    create(:listing, :tour, area: bantayan, partner: business.partner, business:)
  end

  let(:group) { "activity" }
  let(:page) { nil }
  let(:"hearted[]") { nil }
  let(:from) { nil }
  let(:to) { nil }
  let(:people) { nil }

  path "/api/v1/areas/{slug}/plan_businesses" do
    get "A page of one plan step's options in a place" do
      tags "Discovery"
      produces "application/json"
      description "Plan a whole trip: the businesses with active listings in one guest group here and in the published places " \
        "inside it, #{Discovery::PlanBusinesses::PER_PAGE} a page, each with what it offers there summed up, its first listing's " \
        "rounded point and the places to see its listings go to. Things to do lead with the businesses whose tours go to the " \
        "most hearted places, then those with a price; stays lead with those closest to the hearted places, and say how far " \
        "each is; the rest are by name. With the trip's dates (`from` and `to`, RAA-315), only listings with a unit free " \
        "on at least one of them: one booked out on every day is left out, of the cards and the counts alike."
      parameter name: :slug, in: :path, type: :string
      parameter name: :group, in: :query, required: true, schema: { type: :string, enum: Category::GUEST_GROUPS }
      parameter name: :page, in: :query, type: :integer, required: false, description: "From 1 (the default)"
      parameter name: :"hearted[]", in: :query, required: false, style: :form, explode: true,
        schema: { type: :array, items: { type: :string } },
        description: "The slugs of the trip's hearted places to see: Things to do that go there lead, and the stays closest to them"
      parameter name: :from, in: :query, type: :string, format: :date, required: false,
        description: "The trip's first day, with `to`: only listings free on some day from it to `to`"
      parameter name: :to, in: :query, type: :string, format: :date, required: false
      parameter name: :people, in: :query, type: :integer, required: false,
        description: "With the dates, the people a rental vehicle must seat (default 1): a vehicle covers the trip when " \
          "enough of its units for them are free on every day"
      listing_filter_parameters

      response "200", "one page, with the totals and every group's count" do
        schema "$ref" => "#/components/schemas/plan_businesses"
        let(:slug) { "bantayan-island" }

        let!(:stay) { create(:listing, :stay, area: santa_fe, title: "Kota Beach house", location: "POINT(123.71234 11.16789)") }
        let!(:scooter) { create(:listing, :vehicle, area: bantayan) }
        let!(:camera) { create(:listing, :gear, area: bantayan) }
        before do
          create(:listing, :tour, area: hidden, title: "Draft town tour")
          create(:listing, :tour, :paused, area: bantayan, title: "Paused tour")
          create(:listing, :tour, area: elsewhere, title: "Oslob whale sharks")
        end

        context "for the stays" do
          let(:group) { "stay" }

          run_test! do |response|
            json = response.parsed_body
            expect(json["facets"]).to include("cards" => 1, "includes" => [], "transmissions" => [])
            expect(json.except("businesses", "facets")).to eq(
              "total" => 1, "page" => 1, "per_page" => 18, "hearted_total" => 0,
              "counts" => { "stay" => 1, "transfer" => 0, "rental" => 1, "activity" => 0, "gear" => 1 }
            )
            expect(json["businesses"].first).to include(
              "id" => stay.business.id, "name" => stay.business.name, "title" => "Kota Beach house", "area_name" => "Santa Fe",
              "listings_count" => 1, "listing_ids" => [ stay.id ], "location" => { "lat" => 11.17, "lng" => 123.71 }, "goes_to" => []
            )
          end
        end

        context "for the gear, told apart from vehicle rentals" do
          let(:group) { "gear" }

          run_test! do |response|
            expect(response.parsed_body["businesses"].pluck("listing_ids")).to eq([ [ camera.id ] ])
          end
        end
      end

      response "200", "one card per listing title per business, with what it offers summed up" do
        schema "$ref" => "#/components/schemas/plan_businesses"
        let(:slug) { "bantayan-island" }
        let(:group) { "rental" }

        let!(:shop) { create(:business, name: "Santa Fe Scooters") }
        let!(:click) { create(:listing, :vehicle, area: santa_fe, business: shop, partner: shop.partner, title: "Honda Click") }
        let!(:click_two) { create(:listing, :vehicle, area: bantayan, business: shop, partner: shop.partner, title: " honda click") }
        let!(:beat) { create(:listing, :vehicle, area: bantayan, business: shop, partner: shop.partner, title: "Honda Beat") }
        let!(:other) { create(:listing, :vehicle, area: bantayan, title: "Honda Click") }

        run_test! do |response|
          json = response.parsed_body
          expect(json).to include("total" => 3, "counts" => include("rental" => 4))
          expect(json["businesses"].pluck("name", "title")).to eq([
            [ other.business.name, "Honda Click" ], [ "Santa Fe Scooters", "Honda Beat" ], [ "Santa Fe Scooters", " honda click" ]
          ].sort_by { |name, title| [ name, title.strip.downcase ] })
          clicks = json["businesses"].find { |each| each["id"] == shop.id && each["listings_count"] == 2 }
          expect(clicks).to include("key" => "#{shop.id}-#{click.id}", "listing_ids" => [ click_two.id, click.id ])
          expect(clicks["price_from_cents"]).to eq([ click, click_two ].map { |each| PricingSerializer.price_from_cents(each) }.compact.min)
          expect(json["businesses"].pluck("key").uniq.size).to eq(3)
        end
      end

      response "200", "stays: one card per business, whatever the titles" do
        schema "$ref" => "#/components/schemas/plan_businesses"
        let(:slug) { "bantayan-island" }
        let(:group) { "stay" }

        let!(:inn) { create(:business, name: "Kota inn") }
        let!(:room) { create(:listing, :stay, area: bantayan, business: inn, partner: inn.partner, title: "Sea view room") }
        let!(:hut) { create(:listing, :stay, area: bantayan, business: inn, partner: inn.partner, title: "Garden hut") }

        run_test! do |response|
          json = response.parsed_body
          expect(json["total"]).to eq(1)
          expect(json["businesses"].sole).to include("key" => inn.id.to_s, "listings_count" => 2, "listing_ids" => [ hut.id, room.id ])
        end
      end

      response "200", "things to do: hearted places first, then priced, then by name, a page at a time" do
        schema "$ref" => "#/components/schemas/plan_businesses"
        let(:slug) { "bantayan-island" }
        let(:"hearted[]") { %w[kota-beach virgin-island] }

        let!(:both) { tour_by("Zed tours") }
        let!(:one) { tour_by("Yan tours") }
        let!(:unpriced) { tour_by("Alpha tours") }
        let!(:priced) { tour_by("Beta tours") }
        before do
          unpriced.tour_detail.update!(base_price_cents: 0)
          ListingLandmark.create!(listing: both, landmark: kota, relation: "visits")
          ListingLandmark.create!(listing: both, landmark: virgin, relation: "visits")
          ListingLandmark.create!(listing: one, landmark: virgin, relation: "visits")
          ListingLandmark.create!(listing: one, landmark: draft_cove, relation: "visits")
          ListingLandmark.create!(listing: priced, landmark: kota, relation: "serves")
        end

        context "the first page" do
          run_test! do |response|
            json = response.parsed_body
            expect(json["businesses"].pluck("name")).to eq([ "Zed tours", "Yan tours", "Beta tours", "Alpha tours" ])
            expect(json["businesses"].first["goes_to"]).to eq(%w[kota-beach virgin-island])
            expect(json["businesses"].second["goes_to"]).to eq(%w[virgin-island])
            expect(json).to include("total" => 4, "hearted_total" => 2)
          end
        end

        context "a later page" do
          before { stub_const("Discovery::PlanBusinesses::PER_PAGE", 3) }
          let(:page) { 2 }

          run_test! do |response|
            json = response.parsed_body
            expect(json["businesses"].pluck("name")).to eq([ "Alpha tours" ])
            expect(json).to include("total" => 4, "page" => 2, "per_page" => 3)
          end
        end
      end

      response "200", "stays with picks: closest to them first, each saying how far in half kilometres" do
        schema "$ref" => "#/components/schemas/plan_businesses"
        let(:slug) { "bantayan-island" }
        let(:group) { "stay" }
        let(:"hearted[]") { %w[kota-beach virgin-island draft-cove] }

        # About 1.1 km to a hundredth of a degree of latitude; the picks sit on one line of longitude.
        let!(:kota) { create(:landmark, area: bantayan, slug: "kota-beach", name: "Kota Beach", location: "POINT(123.80 11.10)") }
        let!(:virgin) do
          create(:landmark, area: bantayan, slug: "virgin-island", name: "Virgin Island", location: "POINT(124.50 11.10)",
            boat_departure: "POINT(123.80 11.12)")
        end
        let!(:draft_cove) { create(:landmark, :draft, area: bantayan, slug: "draft-cove", name: "Draft Cove", location: "POINT(120.00 15.00)") }

        def stay_by(name, point, title: "A room by the sea")
          business = Business.find_by(name:) || create(:business, name:)
          create(:listing, :stay, area: bantayan, partner: business.partner, business:, title:, location: point)
        end

        before do
          stay_by("Alpha far", "POINT(123.80 11.30)")
          stay_by("Zed near", "POINT(123.80 11.11)")
          stay_by("Mid inn", "POINT(123.80 11.15)")
          # Far off, but with a second room right by the picks: its closest listing counts.
          stay_by("Two sites", "POINT(123.80 11.40)", title: "The far annexe")
          stay_by("Two sites", "POINT(123.80 11.09)", title: "The beach room")
        end

        context "with picks" do
          run_test! do |response|
            businesses = response.parsed_body["businesses"]
            expect(businesses.pluck("name")).to eq([ "Zed near", "Two sites", "Mid inn", "Alpha far" ])
            # Boat-only places count from where the boats leave, and a draft place not at all.
            expect(businesses.first["near"]).to eq([
              { "slug" => "kota-beach", "km" => 1.0 }, { "slug" => "virgin-island", "km" => 1.0 }
            ])
            expect(businesses.second["near"]).to eq([
              { "slug" => "kota-beach", "km" => 1.0 }, { "slug" => "virgin-island", "km" => 3.5 }
            ])
          end
        end

        context "with no picks that are published" do
          let(:"hearted[]") { %w[draft-cove nowhere] }

          run_test! do |response|
            businesses = response.parsed_body["businesses"]
            expect(businesses.pluck("name")).to eq([ "Alpha far", "Mid inn", "Two sites", "Zed near" ])
            expect(businesses.pluck("near")).to all(eq([]))
          end
        end
      end

      response "200", "things to do with nothing hearted: priced first, then by name" do
        schema "$ref" => "#/components/schemas/plan_businesses"
        let(:slug) { "bantayan-island" }

        before do
          tour_by("Alpha tours").tour_detail.update!(base_price_cents: 0)
          tour_by("Beta tours")
        end

        run_test! do |response|
          json = response.parsed_body
          expect(json["businesses"].pluck("name")).to eq([ "Beta tours", "Alpha tours" ])
          expect(json["hearted_total"]).to eq(0)
        end
      end

      response "200", "filtered listing by listing: a card keeps only those that pass, the totals follow, facets count all" do
        schema "$ref" => "#/components/schemas/plan_businesses"
        let(:slug) { "bantayan-island" }
        let(:group) { "rental" }

        let!(:shop) { create(:business, name: "Alpha Scooters") }
        let!(:beat) do
          create(:listing, :vehicle, area: bantayan, business: shop, partner: shop.partner, title: "Honda Beat",
            cancellation_policy: "non_refundable")
        end
        let!(:beat_free) do
          create(:listing, :vehicle, area: bantayan, business: shop, partner: shop.partner, title: "Honda Beat",
            cancellation_policy: "free_cancellation")
        end
        let!(:other) { create(:listing, :vehicle, area: bantayan, title: "Yamaha Mio 125", cancellation_policy: "non_refundable") }
        let(:free_cancellation) { true }

        run_test! do |response|
          json = response.parsed_body
          expect(json["businesses"].pluck("listing_ids")).to eq([ [ beat_free.id ] ])
          expect(json).to include("total" => 1, "counts" => include("rental" => 3))
          expect(json["facets"]).to include("cards" => 2, "free_cancellation" => 1)
        end
      end

      response "200", "with the trip's dates: a listing booked out on every day of them is left out" do
        schema "$ref" => "#/components/schemas/plan_businesses"
        let(:slug) { "bantayan-island" }
        let(:group) { "rental" }
        let(:day) { 20.days.from_now.to_date }
        let(:from) { day.iso8601 }
        let(:to) { (day + 2).iso8601 }

        let!(:booked) { create(:listing, :vehicle, area: bantayan, title: "Booked out bike") }
        let!(:partly) { create(:listing, :vehicle, area: bantayan, title: "Partly free bike") }
        let!(:free_bike) { create(:listing, :vehicle, area: bantayan, title: "Free all days bike") }

        before do
          create(:booking, listing: booked, starts_on: day, ends_on: day + 2)
          create(:booking, listing: partly, starts_on: day, ends_on: day + 1)
        end

        run_test! do |response|
          titles = response.parsed_body["businesses"].map { _1["title"] }
          expect(titles).to contain_exactly("Free all days bike", "Partly free bike")
          expect(response.parsed_body["total"]).to eq(2)
          expect(response.parsed_body["counts"]["rental"]).to eq(2)
        end
      end

      # RAA-315: what covers the whole trip first, then what is free on only some of its days.
      response "200", "with the trip's dates: whole-trip cards first, then those free on some days, with which" do
        schema "$ref" => "#/components/schemas/plan_businesses"
        let(:slug) { "bantayan-island" }
        let(:group) { "rental" }
        let(:day) { 20.days.from_now.to_date }
        let(:from) { day.iso8601 }
        let(:to) { (day + 3).iso8601 }

        # Named so that by name alone the partly free one would come first.
        let(:aaa) { create(:business, name: "Aaa Rentals") }
        let(:zzz) { create(:business, name: "Zzz Rentals") }
        let!(:partly) { create(:listing, :vehicle, area: bantayan, title: "Aaa partly free bike", business: aaa, partner: aaa.partner) }
        let!(:whole) { create(:listing, :vehicle, area: bantayan, title: "Zzz whole trip bike", business: zzz, partner: zzz.partner) }

        before { create(:booking, listing: partly, starts_on: day + 1, ends_on: day + 2) }

        context "for 2 people, one 2-seat bike each" do
          let(:people) { 2 }

          run_test! do |response|
            cards = response.parsed_body["businesses"]
            expect(cards.map { _1.slice("title", "covers_trip", "free_days") }).to eq([
              { "title" => "Zzz whole trip bike", "covers_trip" => true, "free_days" => nil },
              { "title" => "Aaa partly free bike", "covers_trip" => false,
                "free_days" => { "from" => day.iso8601, "to" => day.iso8601 } }
            ])
          end
        end

        context "for 3 people, who need 2 bikes: only a shop with 2 free covers them" do
          let(:people) { 3 }

          before { whole.units.create!(position: 2) }

          run_test! do |response|
            cards = response.parsed_body["businesses"]
            expect(cards.map { _1.slice("title", "covers_trip") })
              .to eq([ { "title" => "Zzz whole trip bike", "covers_trip" => true }, { "title" => "Aaa partly free bike", "covers_trip" => false } ])
            expect(cards.last["free_days"]).to be_nil
          end
        end
      end

      response "422", "dates that aren't both dates from today" do
        let(:slug) { "bantayan-island" }
        let(:from) { "soon" }
        let(:to) { "later" }

        run_test! { |response| expect(response.parsed_body.to_s).to include("From and to must both be dates") }
      end

      response "404", "an unknown or draft place" do
        let(:slug) { "madridejos" }

        run_test!
      end

      response "422", "a group guests never see" do
        let(:slug) { "bantayan-island" }
        let(:group) { "boats" }

        run_test! do |response|
          expect(response.parsed_body.to_s).to include("Group must be one of")
        end
      end

      response "422", "a page that isn't a whole number from 1" do
        let(:slug) { "bantayan-island" }
        let(:page) { "two" }

        run_test! do |response|
          expect(response.parsed_body.to_s).to include("Page must be a whole number from 1")
        end
      end

      response "422", "a filter that isn't true or false" do
        let(:slug) { "bantayan-island" }
        let(:pets) { "maybe" }

        run_test! do |response|
          expect(response.parsed_body.to_s).to include("Pets must be true or false")
        end
      end
    end
  end
end
