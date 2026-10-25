require "rails_helper"

RSpec.describe GuestMailer do
  let(:user) { create(:user, :profile_complete, password: nil, email: "ana@example.com") }
  let(:trip) { create(:trip, user:, name: "Bantayan getaway") }

  it "sends the trip link and PIN, with the day the trip is deleted without an account" do
    mail = described_class.trip_link(user, trip, token: "tok-123", pin: "042917")

    expect(mail.to).to eq([ "ana@example.com" ])
    [ mail.html_part, mail.text_part ].each do |part|
      expect(part.body.to_s).to include("http://example.com/trips/open/tok-123", "042917",
        (trip.ends_on + 60).to_fs(:long), "http://example.com/trips/keep")
    end
  end

  it "sends a sign-in code" do
    mail = described_class.sign_in_code(user, "381204")

    expect(mail.subject).to include("381204")
    expect(mail.text_part.body.to_s).to include("10 minutes")
  end

  it "reminds the guest before the trip is deleted" do
    mail = described_class.trip_deletion_reminder(trip)

    expect(mail.subject).to include("Bantayan getaway", (trip.ends_on + 60).to_fs(:long))
    expect(mail.html_part.body.to_s).to include("http://example.com/trips/keep")
  end
end
