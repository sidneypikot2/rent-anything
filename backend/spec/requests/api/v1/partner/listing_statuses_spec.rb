require "swagger_helper"

RSpec.describe "Partner listing status", type: :request do
  let(:user) { create(:user, :partner, :id_verified) }
  let(:Authorization) { bearer_for(user) }
  let(:status) { "draft" }
  let(:listing) { create(:listing, partner: user, status:, description: "Waterproof to 10 m, with a spare battery, a floating grip and a chest mount.") }
  let(:listing_id) { listing.id }
  let(:body) { { status: "active" } }

  before { create_photo(listing) }

  path "/api/v1/partner/listings/{listing_id}/status" do
    patch "Change a listing's status" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only (RAA-115). `active` goes live from a draft, paused or delisted listing, and needs " \
        "everything in `live_blockers` first: there is no review. `paused` takes a live listing off for now, " \
        "`delisted` takes a live or paused one off the marketplace. Only active listings reach guests. The status " \
        "it already has changes nothing. Another partner's listing is a 404."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :listing_id, in: :path, schema: { type: :integer }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/listing_status_body" }

      response "200", "a complete draft goes live" do
        schema "$ref" => "#/components/schemas/partner_listing"

        run_test! do |response|
          expect(response.parsed_body).to include("status" => "active", "live_blockers" => [])
          expect(listing.reload).to be_active
        end
      end

      response "200", "a live listing paused, resumed and delisted, and a delisted one live again" do
        schema "$ref" => "#/components/schemas/partner_listing"

        let(:status) { "active" }
        let(:body) { { status: "paused" } }

        run_test! do
          expect(listing.reload).to be_paused
          moves = %w[active paused delisted active delisted]
          moves.each do |to|
            patch "/api/v1/partner/listings/#{listing_id}/status", params: { status: to }, as: :json,
              headers: { "Authorization" => Authorization() }
            expect(response).to have_http_status(:ok)
            expect(listing.reload.status).to eq(to)
          end
        end
      end

      response "200", "the status it already has" do
        schema "$ref" => "#/components/schemas/partner_listing"

        let(:status) { "active" }

        run_test! { expect(listing.reload).to be_active }
      end

      response "422", "going live without what it needs" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:listing) { create(:listing, :tour, partner: user, status: "draft", description: "") }

        before do
          listing.photos.delete_all
          listing.tour_detail.update_column(:base_price_cents, 0)
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq(
            [ "To go live it needs a photo, a description of at least 50 characters, a price, and a landmark on its route" ]
          )
          expect(listing.reload).to be_draft
        end
      end

      response "422", "a move that isn't offered" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { status: "paused" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "A draft listing can't be made paused" ])
          expect(listing.reload).to be_draft
        end
      end

      response "422", "a status we don't know, or not text" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { status: "draft" } }
        let(:status) { "active" }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Status must be one of active, paused, delisted" ])
          patch "/api/v1/partner/listings/#{listing_id}/status", params: { status: [ "active" ] }, as: :json,
            headers: { "Authorization" => Authorization() }
          expect(response).to have_http_status(:unprocessable_content)
          expect(listing.reload).to be_active
        end
      end

      response "404", "another partner's listing" do
        schema "$ref" => "#/components/schemas/error"

        let(:listing) { create(:listing, status: "draft", description: "Waterproof to 10 m, with a spare battery, a floating grip and a chest mount.") }

        run_test! { expect(listing.reload).to be_draft }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user) }
        let(:listing) { create(:listing, status: "draft") }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
