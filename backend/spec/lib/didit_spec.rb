require "rails_helper"

RSpec.describe Didit do
  let(:secret) { "test-webhook-secret" }
  let(:body) { '{"session_id":"abc","status":"Approved"}' }
  let(:now) { Time.current }
  let(:signature) { OpenSSL::HMAC.hexdigest("SHA256", secret, body) }

  def stub_env(values)
    allow(ENV).to receive(:[]).and_call_original
    values.each { |key, value| allow(ENV).to receive(:[]).with(key).and_return(value) }
  end

  describe ".valid_signature?" do
    before { stub_env("DIDIT_WEBHOOK_SECRET" => secret) }

    it "accepts the HMAC-SHA256 of the raw body with a fresh timestamp" do
      expect(described_class.valid_signature?(body, signature, now.to_i.to_s)).to be(true)
    end

    it "refuses a body that was changed" do
      expect(described_class.valid_signature?(body.sub("Approved", "Declined"), signature, now.to_i.to_s)).to be(false)
    end

    it "refuses a timestamp more than five minutes off, either way" do
      expect(described_class.valid_signature?(body, signature, (now - 301).to_i.to_s)).to be(false)
      expect(described_class.valid_signature?(body, signature, (now + 301).to_i.to_s)).to be(false)
    end

    it "refuses a missing or malformed signature or timestamp" do
      expect(described_class.valid_signature?(body, nil, now.to_i.to_s)).to be(false)
      expect(described_class.valid_signature?(body, signature, nil)).to be(false)
      expect(described_class.valid_signature?(body, signature, "soon")).to be(false)
    end
  end

  describe "configuration" do
    it "raises NotConfiguredError without the webhook secret" do
      stub_env("DIDIT_WEBHOOK_SECRET" => nil)

      expect { described_class.valid_signature?(body, signature, now.to_i.to_s) }
        .to raise_error(Didit::NotConfiguredError)
    end

    it "raises NotConfiguredError without the API key, before calling Didit" do
      stub_env("DIDIT_API_KEY" => "", "DIDIT_WORKFLOW_ID" => "wf")
      allow(Net::HTTP).to receive(:start)

      expect { described_class.create_session(vendor_data: "1", callback: "http://x") }
        .to raise_error(Didit::NotConfiguredError)
      expect(Net::HTTP).not_to have_received(:start)
    end
  end
end
