require "swagger_helper"

RSpec.describe "Map pins", type: :request do
  let!(:bantayan) { create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island") }
  let!(:santa_fe) { create(:area, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan) }
  let!(:hidden) { create(:area, :draft, slug: "madridejos", name: "Madridejos", kind: "town", parent: bantayan) }

  # The box the map shows: around Santa Fe.
  let(:slug) { "bantayan-island" }
  let(:bbox) { "123.70,11.10,123.90,11.25" }
  let(:group) { nil }
  let(:from) { nil }
  let(:to) { nil }

  def at(lng, lat) = "POINT(#{lng} #{lat})"

  let!(:scooter) { create(:listing, :vehicle, area: santa_fe, title: "Honda Click 125", location: at(123.80, 11.16), cancellation_policy: "non_refundable") }
  let!(:inn) { create(:listing, :stay, area: bantayan, title: "Kota beach inn", location: at(123.75, 11.20)) }
  # Outside the box, paused, and in a draft place: never pinned.
  let!(:far) { create(:listing, :stay, area: bantayan, title: "North beach inn", location: at(123.75, 11.30)) }
  let!(:paused) { create(:listing, :vehicle, :paused, area: bantayan, title: "Paused scooter", location: at(123.78, 11.15)) }
  let!(:draft_town) { create(:listing, :stay, area: hidden, title: "Madridejos inn", location: at(123.76, 11.16)) }

  path "/api/v1/areas/{slug}/map_pins" do
    get "The listings on the part of a place's map in view" do
      tags "Discovery"
      produces "application/json"
      description "What to book's map: the active listings here and in the published places inside it within the box " \
        "in view, as pins with their browse rows (the pop-up), narrowed like a What to book section (its group, search, " \
        "dates and, with a group, filters); stays one per business, as their cards. More than #{Discovery::MapPins::CAP} in the box come as counted clusters instead."
      parameter name: :slug, in: :path, type: :string
      parameter name: :bbox, in: :query, type: :string, required: true,
        description: "west,south,east,north in degrees"
      parameter name: :group, in: :query, required: false, schema: { type: :string, enum: Category::GUEST_GROUPS },
        description: "One group's listings (the section shown); every group without"
      parameter name: :from, in: :query, type: :string, format: :date, required: false,
        description: "With to: only listings with a unit free on these dates, as book_cards"
      parameter name: :to, in: :query, type: :string, format: :date, required: false
      # The filters apply only with a group, as a section's do; the search either way.
      listing_filter_parameters

      response "200", "the listings in the box, each with its row" do
        schema "$ref" => "#/components/schemas/map_pins"

        run_test! do |response|
          json = response.parsed_body
          expect(json["listings"].map { _1["pin"]["id"] }).to contain_exactly(scooter.id, inn.id)
          expect(json["listings"].map { _1["row"]["id"] }).to contain_exactly(scooter.id, inn.id)
          expect(json).to include("total" => 2, "clusters" => [])
          # A pin per listing outside Stays.
          expect(json["listings"].map { _1["options"] }).to eq([ nil, nil ])
          # Where the section's listings are, in view or not (the far inn too), for fitting the map.
          expect(json["bounds"]).to eq("west" => 123.75, "south" => 11.16, "east" => 123.8, "north" => 11.3)
          # Rounded, as every guest's pin is.
          expect(json["listings"].find { _1["pin"]["id"] == inn.id }["pin"]["location"]).to eq("lat" => 11.2, "lng" => 123.75)
        end
      end

      response "200", "a section's group, search and filters" do
        schema "$ref" => "#/components/schemas/map_pins"
        let(:group) { "rental" }
        let!(:other) { create(:listing, :vehicle, area: bantayan, title: "Yamaha Mio 125", location: at(123.81, 11.17), cancellation_policy: "free_cancellation") }

        context "with a filter" do
          let(:free_cancellation) { "true" }

          run_test! do |response|
            expect(response.parsed_body["listings"].map { _1["pin"]["id"] }).to eq([ other.id ])
          end
        end

        context "with a search" do
          let(:q) { "honda" }

          run_test! do |response|
            expect(response.parsed_body["listings"].map { _1["pin"]["id"] }).to eq([ scooter.id ])
          end
        end
      end

      response "200", "stays: one pin per business, its cheapest stay leading, as its card" do
        schema "$ref" => "#/components/schemas/map_pins"
        let(:group) { "stay" }
        let!(:dorm) do
          create(:listing, :stay, area: santa_fe, partner: inn.partner, business: inn.business, title: "Dorm bed by the beach", location: at(123.76, 11.19), with_rate: false).tap do |listing|
            create(:stay_rate, listing:, nightly_price_cents: 50_000)
          end
        end
        let!(:huts) { create(:listing, :stay, area: santa_fe, title: "Beach huts on the sand", location: at(123.79, 11.18)) }

        context "with a few in the box" do
          run_test! do |response|
            json = response.parsed_body
            expect(json["total"]).to eq(2)
            expect(json["listings"].to_h { [ _1["pin"]["id"], _1["options"] ] }).to eq(dorm.id => 2, huts.id => 1)
            expect(json["listings"].find { _1["pin"]["id"] == dorm.id }["row"]["business"]["id"]).to eq(inn.business_id)
          end
        end

        context "with too many in the box" do
          before { stub_const("Discovery::MapPins::CAP", 1) }

          run_test! do |response|
            json = response.parsed_body
            expect(json["total"]).to eq(2)
            # Businesses, not their three stays.
            expect(json["clusters"].sum { _1["count"] }).to eq(2)
          end
        end
      end

      response "200", "only what is free on the dates" do
        schema "$ref" => "#/components/schemas/map_pins"
        let(:from) { (Date.current + 10).iso8601 }
        let(:to) { (Date.current + 12).iso8601 }
        before do
          inn.units.drop(1).each(&:destroy)
          create(:booking, listing: inn.reload, starts_on: Date.current + 10, ends_on: Date.current + 12)
        end

        run_test! do |response|
          expect(response.parsed_body["listings"].map { _1["pin"]["id"] }).to eq([ scooter.id ])
        end
      end

      response "200", "too many in the box: counted clusters, never an exact point" do
        schema "$ref" => "#/components/schemas/map_pins"
        before { stub_const("Discovery::MapPins::CAP", 1) }

        run_test! do |response|
          json = response.parsed_body
          expect(json["listings"]).to eq([])
          expect(json["total"]).to eq(2)
          expect(json["bounds"]).to be_present
          expect(json["clusters"].sum { _1["count"] }).to eq(2)
          json["clusters"].each do |cluster|
            expect(cluster["lat"]).to eq(cluster["lat"].round(2))
            expect(cluster["lng"]).to eq(cluster["lng"].round(2))
          end
        end
      end

      response "404", "a draft place" do
        let(:slug) { "madridejos" }

        run_test!
      end

      response "422", "a box that isn't one" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:bbox) { "123.9,11.1,123.7" }

        run_test! do |response|
          expect(response.parsed_body.to_s).to include("Bbox must be west,south,east,north")
        end
      end
    end
  end
end
