require "rails_helper"

RSpec.describe Auth::IssueTokens do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user) }

  it "gives a cable token that identifies the user to anycable-go and expires with the access token (RAA-224)" do
    tokens = described_class.call(user)
    expires_at = JsonWebToken.decode(tokens[:access_token])[:exp]

    expect(AnyCable::JWT.decode(tokens[:cable_token])).to eq(current_user: user)
    travel_to(Time.zone.at(expires_at)) do
      expect { AnyCable::JWT.decode(tokens[:cable_token]) }.to raise_error(AnyCable::JWT::ExpiredSignature)
    end
  end

  it "closes the user's WebSockets when the access token expires, however they connected" do
    freeze_time do
      expires_at = described_class::ACCESS_TOKEN_LIFETIME.from_now

      expect { described_class.call(user) }.to have_enqueued_job(Cable::CloseExpiredJob).with(user).at(expires_at)
    end
  end

  it "gives no cable token, and queues nothing, without an anycable-go to use them" do
    allow(UserChannel).to receive(:live?).and_return(false)

    expect { expect(described_class.call(user)[:cable_token]).to be_nil }.not_to have_enqueued_job(Cable::CloseExpiredJob)
  end
end
