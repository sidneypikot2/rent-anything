require "rails_helper"

RSpec.describe SystemMailer do
  describe "#test_email" do
    subject(:mail) { described_class.test_email(to: "someone@example.com") }

    before do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with("MAILER_FROM", anything).and_return("TripKoNext <sender@example.com>")
    end

    it "sends from the configured address to the given one" do
      expect(mail.to).to eq([ "someone@example.com" ])
      expect(mail.from).to eq([ "sender@example.com" ])
      expect(mail.subject).to eq("TripKoNext test email")
    end

    it "has HTML and text parts in the TripKoNext layout" do
      expect(mail.html_part.body.to_s).to include("TripKoNext", "sending email works")
      expect(mail.text_part.body.to_s).to include("TripKoNext", "sending email works")
    end

    it "is delivered by the test adapter" do
      expect { mail.deliver_now }.to change(ActionMailer::Base.deliveries, :count).by(1)
    end
  end
end
