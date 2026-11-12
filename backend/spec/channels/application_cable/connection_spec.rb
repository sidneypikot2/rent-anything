require "rails_helper"

RSpec.describe ApplicationCable::Connection, type: :channel do
  let(:user) { create(:user) }

  # anycable-go identifies a client by its cable_token and never asks Rails to (RAA-224).
  it "refuses a connection without a token" do
    expect { connect "/cable" }.to have_rejected_connection
  end

  it "refuses an access token in the URL" do
    expect { connect "/cable", params: { token: Auth::IssueTokens.call(user)[:access_token] } }
      .to have_rejected_connection
  end
end
