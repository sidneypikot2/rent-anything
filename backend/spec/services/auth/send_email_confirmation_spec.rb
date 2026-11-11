require "rails_helper"

RSpec.describe Auth::SendEmailConfirmation do
  it "emails an unconfirmed account a link whose token confirms it" do
    user = create(:user, :unconfirmed)

    expect { described_class.call(user) }.to have_enqueued_mail(AccountMailer, :email_confirmation)
    token = ActiveJob::Base.queue_adapter.enqueued_jobs.last[:args].last["args"].last
    expect(User.find_by_token_for(:email_confirmation, token)).to eq(user)
  end

  it "sends nothing once the email is confirmed" do
    expect { described_class.call(create(:user)) }.not_to have_enqueued_mail
  end

  it "refuses a guest with no email yet" do
    expect { described_class.call(User.create!(role: "guest")) }.to raise_error(ActiveRecord::RecordInvalid)
  end
end
