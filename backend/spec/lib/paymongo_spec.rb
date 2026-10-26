require "rails_helper"

RSpec.describe Paymongo do
  let(:secret) { "whsk_test_secret" }
  let(:body) { '{"data":{"id":"evt_1","attributes":{"type":"checkout_session.payment.paid"}}}' }
  let(:now) { Time.current }

  def stub_env(values)
    allow(ENV).to receive(:[]).and_call_original
    values.each { |key, value| allow(ENV).to receive(:[]).with(key).and_return(value) }
  end

  def sign(timestamp, raw = body)
    OpenSSL::HMAC.hexdigest("SHA256", secret, "#{timestamp}.#{raw}")
  end

  describe ".valid_signature?" do
    before { stub_env("PAYMONGO_WEBHOOK_SECRET" => secret) }

    it "accepts a test-mode signature of the timestamp and raw body" do
      t = now.to_i
      expect(described_class.valid_signature?(body, "t=#{t},te=#{sign(t)},li=")).to be(true)
    end

    it "refuses a live-mode signature: payments are in test mode only" do
      t = now.to_i
      expect(described_class.valid_signature?(body, "t=#{t},te=,li=#{sign(t)}")).to be(false)
    end

    it "refuses a body that was changed" do
      t = now.to_i
      expect(described_class.valid_signature?(body.sub("paid", "failed"), "t=#{t},te=#{sign(t)},li=")).to be(false)
    end

    it "refuses a timestamp more than five minutes off" do
      t = (now - 301).to_i
      expect(described_class.valid_signature?(body, "t=#{t},te=#{sign(t)},li=")).to be(false)
    end

    it "refuses a missing or malformed header" do
      expect(described_class.valid_signature?(body, nil)).to be(false)
      expect(described_class.valid_signature?(body, "garbage")).to be(false)
      expect(described_class.valid_signature?(body, "t=abc,te=#{sign('abc')}")).to be(false)
    end

    it "raises when the webhook secret isn't set" do
      stub_env("PAYMONGO_WEBHOOK_SECRET" => nil)
      expect { described_class.valid_signature?(body, "t=1,te=x") }.to raise_error(Paymongo::NotConfiguredError)
    end
  end

  describe "requests" do
    let(:http) { instance_double(Net::HTTP) }
    let(:response) do
      Net::HTTPOK.new("1.1", "200", "OK").tap do |ok|
        allow(ok).to receive(:body).and_return({ data: { id: "cs_1", attributes: { checkout_url: "https://x" } } }.to_json)
      end
    end

    before { allow(Net::HTTP).to receive(:start).and_yield(http) }

    it "creates a checkout session with the test key, by basic auth" do
      stub_env("PAYMONGO_SECRET_KEY" => "sk_test_abc")
      sent = nil
      allow(http).to receive(:request) { |req| sent = req; response }

      expect(described_class.create_checkout_session(line_items: [])).to include("id" => "cs_1")
      expect(sent.path).to eq("/v1/checkout_sessions")
      expect(sent["Authorization"]).to eq("Basic #{Base64.strict_encode64('sk_test_abc:')}")
      expect(JSON.parse(sent.body)).to eq("data" => { "attributes" => { "line_items" => [] } })
    end

    it "refuses a live key, so no real money can move" do
      stub_env("PAYMONGO_SECRET_KEY" => "sk_live_abc")
      allow(http).to receive(:request)

      expect { described_class.checkout_session("cs_1") }
        .to raise_error(Paymongo::NotConfiguredError, "PayMongo live keys aren't allowed yet")
      expect(http).not_to have_received(:request)
    end

    it "raises with the status when PayMongo refuses" do
      stub_env("PAYMONGO_SECRET_KEY" => "sk_test_abc")
      allow(http).to receive(:request).and_return(Net::HTTPBadRequest.new("1.1", "400", "Bad Request"))

      expect { described_class.expire_checkout_session("cs_1") }
        .to raise_error(Paymongo::Error) { expect(_1.status).to eq(400) }
    end
  end
end
