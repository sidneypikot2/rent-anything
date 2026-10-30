require "rails_helper"

RSpec.describe ApplicationCable::Connection, type: :channel do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user) }

  it "connects with an access token, as that user" do
    connect "/cable", params: { token: Auth::IssueTokens.call(user)[:access_token] }
    expect(connection.current_user).to eq(user)
  end

  it "refuses a connection without a token" do
    expect { connect "/cable" }.to have_rejected_connection
  end

  it "refuses an expired token" do
    token = Auth::IssueTokens.call(user)[:access_token]
    travel(Auth::IssueTokens::ACCESS_TOKEN_LIFETIME + 1.minute) do
      expect { connect "/cable", params: { token: } }.to have_rejected_connection
    end
  end

  it "refuses a token that isn't one of ours" do
    expect { connect "/cable", params: { token: "not-a-jwt" } }.to have_rejected_connection
  end

  it "refuses a token whose user is gone" do
    token = Auth::IssueTokens.call(user)[:access_token]
    user.destroy!
    expect { connect "/cable", params: { token: } }.to have_rejected_connection
  end
end
