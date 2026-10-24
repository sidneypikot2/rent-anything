require "rails_helper"
require "sentry/test_helper"

# config/initializers/sentry.rb does nothing without SENTRY_DSN, which no spec run sets; these
# load it with one and capture through Sentry's in-memory transport.
RSpec.describe "Sentry initializer" do
  include Sentry::TestHelper

  before do
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("SENTRY_DSN").and_return("http://public@sentry.invalid/1")
    allow(ENV).to receive(:[]).with("SENTRY_RELEASE").and_return("abc123")
    load Rails.root.join("config/initializers/sentry.rb")
    setup_sentry_test
  end

  after do
    teardown_sentry_test
    Sentry.close
  end

  it "tags events with the Rails env and the deployed commit" do
    Sentry.capture_message("boom")

    expect(last_sentry_event.environment).to eq("test")
    expect(last_sentry_event.release).to eq("abc123")
  end

  it "filters keyed data with the same parameters as the logs" do
    Sentry.with_scope do |scope|
      scope.set_extras(email: "guest@example.com", listing_id: 7)
      scope.set_context("didit", { decision: { name: "Juan" }, status: "Approved" })
      Sentry.capture_message("boom")
    end

    expect(last_sentry_event.extra).to include(email: "[FILTERED]", listing_id: 7)
    expect(last_sentry_event.contexts["didit"]).to include(decision: "[FILTERED]", status: "Approved")
  end

  it "sends no request bodies, cookies or client IPs" do
    data = Sentry.configuration.data_collection

    expect(data.collect_incoming_http_body?).to be(false)
    expect(data.cookies.mode).to eq(:off)
    expect(data.user_info).to be(false)
  end
end
