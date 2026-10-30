require "swagger_helper"

RSpec.describe "Notifications", type: :request do
  let(:user) { create(:user) }
  let(:Authorization) { bearer_for(user) }

  path "/api/v1/notifications" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :before, in: :query, required: false, schema: { type: :integer },
      description: "Only notifications older than this id: the last page's next_before"

    get "The signed-in user's notifications" do
      tags "Notifications"
      produces "application/json"
      description "Guests and partners. Newest first, 20 at a time, with how many are unread. Each has its wording " \
        "and the web app page it opens."
      security [ { bearer: [] } ]

      response "200", "newest first, with the unread count" do
        schema "$ref" => "#/components/schemas/notification_page"

        let!(:older) { create(:notification, recipient: user, created_at: 2.hours.ago, read_at: 1.hour.ago) }
        let!(:newer) { create(:notification, recipient: user) }
        let!(:others) { create(:notification) }

        run_test! do |response|
          body = response.parsed_body
          expect(body["notifications"].pluck("id", "read")).to eq([ [ newer.id, false ], [ older.id, true ] ])
          expect(body).to include("unread_count" => 1, "next_before" => nil)
          expect(body["notifications"].first).to include("title" => start_with("Request accepted: "),
            "path" => start_with("/cart"))
        end
      end

      response "200", "a page older than `before`" do
        schema "$ref" => "#/components/schemas/notification_page"

        let!(:notifications) { create_list(:notification, 22, recipient: user) }
        let(:before) { notifications.last.id }

        run_test! do |response|
          body = response.parsed_body
          expect(body["notifications"].size).to eq(20)
          expect(body["notifications"].pluck("id")).to all(be < before)
          expect(body["next_before"]).to eq(notifications.second.id)
        end
      end

      response "422", "a `before` that isn't an id" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:before) { "soon" }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/notifications/{id}/read" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :id, in: :path, schema: { type: :integer }

    post "Marks one notification read" do
      tags "Notifications"
      produces "application/json"
      description "Another user's notification is a 404."
      security [ { bearer: [] } ]

      let(:notification) { create(:notification, recipient: user) }
      let(:id) { notification.id }

      response "200", "read" do
        schema "$ref" => "#/components/schemas/notification"

        run_test! do |response|
          expect(response.parsed_body["read"]).to be(true)
          expect(notification.reload.read_at).to be_present
        end
      end

      response "404", "another user's notification" do
        schema "$ref" => "#/components/schemas/error"

        let(:notification) { create(:notification) }

        run_test! { expect(notification.reload.read_at).to be_nil }
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/notifications/read_all" do
    parameter name: :Authorization, in: :header, schema: { type: :string }

    post "Marks all of the signed-in user's notifications read" do
      tags "Notifications"
      produces "application/json"
      security [ { bearer: [] } ]

      response "200", "all read; other users' untouched" do
        schema type: :object, properties: { unread_count: { type: :integer } }, required: %w[unread_count]

        let!(:mine) { create_list(:notification, 2, recipient: user) }
        let!(:others) { create(:notification) }

        run_test! do |response|
          expect(response.parsed_body).to eq("unread_count" => 0)
          expect(user.notifications.unread).to be_empty
          expect(others.reload.read_at).to be_nil
        end
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
