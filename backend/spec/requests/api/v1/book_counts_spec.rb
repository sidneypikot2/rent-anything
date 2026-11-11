require "swagger_helper"

RSpec.describe "Book counts", type: :request do
  let!(:bantayan) { create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island") }
  let!(:santa_fe) { create(:area, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan) }
  let!(:hidden) { create(:area, :draft, slug: "madridejos", name: "Madridejos", kind: "town", parent: bantayan) }

  let(:slug) { "bantayan-island" }
  let(:q) { nil }
  let(:from) { nil }
  let(:to) { nil }

  path "/api/v1/areas/{slug}/book_counts" do
    get "How many cards each What to book section has in a place" do
      tags "Discovery"
      produces "application/json"
      description "What to book's section chips: the cards per guest group here and in the published places inside it, " \
        "with the search and the dates (not a section's filters), asked once for every section."
      parameter name: :slug, in: :path, type: :string
      parameter name: :q, in: :query, type: :string, required: false, description: "Only listings with every word somewhere in them"
      parameter name: :from, in: :query, type: :string, format: :date, required: false,
        description: "With to: only listings with a unit free on these dates (a stay's or rental's nights from from to the day before to)"
      parameter name: :to, in: :query, type: :string, format: :date, required: false,
        description: "The last day, with from (at most #{Discovery::BookCards::MAX_DAYS} days after it)"

      response "200", "the cards per group" do
        schema "$ref" => "#/components/schemas/book_counts"

        let!(:inn) { create(:listing, :stay, area: bantayan, title: "Open beach inn") }
        let!(:booked) { create(:listing, :stay, area: santa_fe, title: "Booked beach inn") }
        before do
          business = create(:business)
          create(:listing, :vehicle, area: bantayan, business:, partner: business.partner, title: "Honda Beat scooter")
          create(:listing, :stay, area: hidden, title: "Draft town beach inn")
          booked.units.drop(1).each(&:destroy)
          create(:booking, listing: booked.reload, starts_on: Date.current + 11, ends_on: Date.current + 13)
        end

        context "every listing here" do
          run_test! do |response|
            expect(response.parsed_body).to eq("counts" => { "stay" => 2, "transfer" => 0, "rental" => 1, "activity" => 0, "gear" => 0 })
          end
        end

        context "searched" do
          let(:q) { "honda" }

          run_test! do |response|
            expect(response.parsed_body["counts"]).to include("stay" => 0, "rental" => 1)
          end
        end

        context "only what is free on the dates" do
          let(:from) { (Date.current + 10).iso8601 }
          let(:to) { (Date.current + 12).iso8601 }

          run_test! do |response|
            expect(response.parsed_body["counts"]).to include("stay" => 1, "rental" => 1)
          end
        end
      end

      response "404", "a draft place" do
        let(:slug) { "madridejos" }

        run_test!
      end

      response "422", "bad dates" do
        let(:from) { (Date.current + 5).iso8601 }
        let(:to) { (Date.current + 2).iso8601 }

        run_test! do |response|
          expect(response.parsed_body.to_s).to include("To must be on or after from")
        end
      end
    end
  end
end
