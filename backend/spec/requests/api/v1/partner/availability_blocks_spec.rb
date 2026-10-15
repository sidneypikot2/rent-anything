require "swagger_helper"

RSpec.describe "Partner availability blocks", type: :request do
  let(:user) { create(:user, :partner) }
  let(:Authorization) { bearer_for(user) }
  let(:today) { Date.current }
  let(:listing) { create(:listing, partner: user) }
  let(:listing_id) { listing.id }
  let(:body) { { starts_on: (today + 1).iso8601, ends_on: (today + 2).iso8601, reason: "  Fiesta  " } }

  path "/api/v1/partner/listings/{listing_id}/availability_blocks" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :listing_id, in: :path, schema: { type: :integer }

    get "A listing's blocked days" do
      tags "Partner"
      produces "application/json"
      description "Partner-only (RAA-118). The listing's blocks ending today or later, by start date."
      security [ { bearer: [] } ]

      response "200", "the blocks still to come" do
        schema type: :array, items: { "$ref" => "#/components/schemas/availability_block" }

        before do
          create(:availability_block, listing:, starts_on: today + 9, ends_on: today + 9, reason: nil)
          create(:availability_block, listing:, starts_on: today - 1, ends_on: today, reason: "Repairs")
          create(:availability_block, listing:, starts_on: today - 5, ends_on: today - 3)
        end

        run_test! { |response| expect(response.parsed_body.pluck("reason")).to eq([ "Repairs", nil ]) }
      end

      response "404", "another partner's listing" do
        schema "$ref" => "#/components/schemas/error"

        let(:listing) { create(:listing) }

        run_test!
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user) }
        let(:listing) { create(:listing) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end

    post "Block a run of a listing's days" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only (RAA-118). Bookings already on those days stay; no new ones can take them. A block " \
        "can't overlap another of the listing's."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/availability_block_body" }

      response "201", "blocked" do
        schema "$ref" => "#/components/schemas/availability_block"

        before { create(:booking, listing:, starts_on: today + 1, ends_on: today + 1) }

        run_test! do |response|
          expect(response.parsed_body).to include("starts_on" => (today + 1).iso8601, "reason" => "Fiesta")
          expect(listing.availability_blocks.count).to eq(1)
          expect(listing.bookings.confirmed.count).to eq(1)
        end
      end

      response "422", "overlapping another block" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { create(:availability_block, listing:, starts_on: today + 2, ends_on: today + 4) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([
            "Those dates overlap the block from #{(today + 2).strftime('%b %-d')} to " \
              "#{(today + 4).strftime('%b %-d')}: change that one instead"
          ])
        end
      end

      response "422", "dates missing, backwards or past, or a reason too long" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { starts_on: (today - 2).iso8601, ends_on: (today - 3).iso8601, reason: "x" * 121 } }

        run_test! do |first|
          expect(first.parsed_body["errors"]).to eq([
            "Reason can be at most 120 characters", "End date can't be before the start date",
            "A block must end today or later"
          ])
          post "/api/v1/partner/listings/#{listing_id}/availability_blocks", as: :json,
            params: { ends_on: today.iso8601, reason: 3 }, headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["errors"]).to eq([ "Start date is required", "Reason must be text" ])
        end
      end

      response "404", "another partner's listing" do
        schema "$ref" => "#/components/schemas/error"

        let(:listing) { create(:listing) }

        run_test! { expect(AvailabilityBlock.count).to eq(0) }
      end
    end
  end

  path "/api/v1/partner/listings/{listing_id}/availability_blocks/{id}" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :listing_id, in: :path, schema: { type: :integer }
    parameter name: :id, in: :path, schema: { type: :integer }

    let(:block) { create(:availability_block, listing:, starts_on: today + 5, ends_on: today + 6) }
    let(:id) { block.id }

    patch "Change a block" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only (RAA-118). Its dates and reason, as when blocking. A block already over keeps its " \
        "end date when only its reason changes."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/availability_block_body" }

      response "200", "moved and renamed" do
        schema "$ref" => "#/components/schemas/availability_block"

        let(:body) { { starts_on: (today + 4).iso8601, ends_on: (today + 8).iso8601, reason: "Owner stay" } }

        before { create(:availability_block, listing:, starts_on: today + 9, ends_on: today + 9) }

        run_test! do
          expect(block.reload).to have_attributes(starts_on: today + 4, ends_on: today + 8, reason: "Owner stay")
        end
      end

      response "200", "a past block's reason" do
        schema "$ref" => "#/components/schemas/availability_block"

        let(:block) { create(:availability_block, listing:, starts_on: today - 4, ends_on: today - 2) }
        let(:body) { { starts_on: (today - 4).iso8601, ends_on: (today - 2).iso8601, reason: "Typhoon" } }

        run_test! { expect(block.reload.reason).to eq("Typhoon") }
      end

      response "404", "another partner's block" do
        schema "$ref" => "#/components/schemas/error"

        let(:block) { create(:availability_block, starts_on: today + 5, ends_on: today + 6) }
        let(:body) { { starts_on: (today + 4).iso8601, ends_on: (today + 8).iso8601 } }

        run_test! { expect(block.reload.starts_on).to eq(today + 5) }
      end
    end

    delete "Unblock" do
      tags "Partner"
      description "Partner-only (RAA-118). The days can be booked again."
      security [ { bearer: [] } ]

      response "204", "removed" do
        run_test! { expect(AvailabilityBlock.exists?(id)).to be(false) }
      end

      response "404", "another partner's block" do
        schema "$ref" => "#/components/schemas/error"

        let(:block) { create(:availability_block) }

        run_test! { expect(AvailabilityBlock.exists?(id)).to be(true) }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user) }
        let(:listing) { create(:listing) }

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
