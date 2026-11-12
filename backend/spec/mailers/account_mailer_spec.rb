require "rails_helper"

RSpec.describe AccountMailer do
  let(:user) { create(:user, :unconfirmed, email: "ana@example.com") }

  it "sends a link to confirm the email, to the web app's page" do
    mail = described_class.email_confirmation(user, "tok+1/2=")

    expect(mail.to).to eq([ "ana@example.com" ])
    [ mail.html_part, mail.text_part ].each do |part|
      expect(part.body.to_s).to include("http://example.com/confirm-email?token=tok%2B1%2F2%3D", "24 hours")
    end
  end

  it "sends a link to choose a new password, to the web app's page" do
    mail = described_class.password_reset(user, "tok-9")

    expect(mail.to).to eq([ "ana@example.com" ])
    [ mail.html_part, mail.text_part ].each do |part|
      expect(part.body.to_s).to include("http://example.com/reset-password?token=tok-9", "30 minutes")
    end
  end
end
