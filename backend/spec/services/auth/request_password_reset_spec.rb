require "rails_helper"

RSpec.describe Auth::RequestPasswordReset do
  let!(:user) { create(:user, email: "ana@example.com") }

  it "emails the account of that email and role a link whose token resets its password" do
    expect { described_class.call(" Ana@Example.com ", "guest") }.to have_enqueued_mail(AccountMailer, :password_reset)
    token = ActiveJob::Base.queue_adapter.enqueued_jobs.last[:args].last["args"].last
    expect(User.find_by_token_for(:password_reset, token)).to eq(user)
  end

  it "sends nothing for an unknown email, another role's or an account with no password" do
    create(:user, :oauth_only, email: "google@example.com")

    expect do
      described_class.call("nobody@example.com", "guest")
      described_class.call("ana@example.com", "partner")
      described_class.call("google@example.com", "guest")
    end.not_to have_enqueued_mail
  end

  it "refuses a missing email or a role that can't reset here" do
    expect { described_class.call(nil, "guest") }.to raise_error(ActiveRecord::RecordInvalid, /Email is required/)
    expect { described_class.call("ana@example.com", "admin") }.to raise_error(ActiveRecord::RecordInvalid, /Role must be/)
  end
end
