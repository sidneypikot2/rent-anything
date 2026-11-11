require "rails_helper"

RSpec.describe Auth::ConfirmEmail do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user, :unconfirmed) }

  it "confirms the email the token was made for" do
    expect(described_class.call(user.generate_token_for(:email_confirmation))).to eq(user)
    expect(user.reload.email_confirmed_at).to be_present
  end

  it "keeps the first confirmation when the link is opened again" do
    token = user.generate_token_for(:email_confirmation)
    described_class.call(token)
    first = user.reload.email_confirmed_at

    travel 1.hour do
      described_class.call(token)
    end
    expect(user.reload.email_confirmed_at).to eq(first)
  end

  it "refuses a token made before the email changed" do
    token = user.generate_token_for(:email_confirmation)
    user.update!(email: "new@example.com")

    expect { described_class.call(token) }.to raise_error(ActiveRecord::RecordInvalid, /invalid or has expired/)
  end

  it "refuses a token after 24 hours" do
    token = user.generate_token_for(:email_confirmation)

    travel 25.hours do
      expect { described_class.call(token) }.to raise_error(ActiveRecord::RecordInvalid)
    end
  end

  it "refuses a token that isn't text" do
    expect { described_class.call({ "a" => 1 }) }.to raise_error(ActiveRecord::RecordInvalid, /Token is required/)
  end
end
