require "rails_helper"

RSpec.describe Auth::ResetPassword do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user, :unconfirmed, password: "password123") }
  let(:token) { user.generate_token_for(:password_reset) }

  it "sets the new password, signs every session out and confirms the email" do
    Auth::IssueTokens.call(user)
    Auth::IssueTokens.call(user)

    described_class.call(token, "new-password-1")

    user.reload
    expect(user.authenticate("new-password-1")).to eq(user)
    expect(user.refresh_tokens.active).to be_empty
    expect(user.email_confirmed_at).to be_present
  end

  it "works once: the new password spends the token" do
    described_class.call(token, "new-password-1")

    expect { described_class.call(token, "new-password-2") }.to raise_error(ActiveRecord::RecordInvalid, /invalid or has expired/)
    expect(user.reload.authenticate("new-password-1")).to eq(user)
  end

  it "refuses a token after 30 minutes" do
    token
    travel 31.minutes do
      expect { described_class.call(token, "new-password-1") }.to raise_error(ActiveRecord::RecordInvalid)
    end
  end

  it "refuses a password too short, or not text, and keeps the sessions" do
    Auth::IssueTokens.call(user)

    expect { described_class.call(token, "short") }.to raise_error(ActiveRecord::RecordInvalid, /too short/)
    expect { described_class.call(token, 12345678) }.to raise_error(ActiveRecord::RecordInvalid, /Password is required/)
    expect(user.refresh_tokens.active).not_to be_empty
    expect(user.reload.authenticate("password123")).to eq(user)
  end
end
