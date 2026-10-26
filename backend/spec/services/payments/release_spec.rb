require "rails_helper"

# A hold with a PayMongo checkout open when its time runs out (Bookings::Expire, Payments::Release).
RSpec.describe Payments::Release do
  let(:user) { create(:user) }
  let(:listing) { create(:listing, :stay) }
  let(:booking) { create(:booking, :checkout, listing:, user:, status: "awaiting_payment", expires_at: 1.minute.ago) }
  let!(:payment) { create(:payment, :paymongo, user:, covered_booking_ids: [ booking.id ]) }

  before { enable_paymongo }

  it "ends the checkout before the booking expires" do
    allow(Paymongo).to receive(:expire_checkout_session)
    allow(Paymongo).to receive(:checkout_session) { paymongo_session(payment.provider_ref, status: "expired") }

    expect(Bookings::Expire.call).to eq(1)
    expect(Paymongo).to have_received(:expire_checkout_session).with(payment.provider_ref)
    expect(payment.reload).to have_attributes(status: "failed")
    expect(booking.reload).to be_expired
  end

  it "confirms the booking instead when it was paid meanwhile" do
    allow(Paymongo).to receive(:expire_checkout_session).and_raise(Paymongo::Error.new("400", status: 400))
    allow(Paymongo).to receive(:checkout_session) { paymongo_session(payment.provider_ref, paid: true) }

    expect(Bookings::Expire.call).to eq(0)
    expect(payment.reload).to have_attributes(status: "paid")
    expect(booking.reload).to be_confirmed
  end

  it "leaves the booking for the next run while PayMongo can't be reached" do
    allow(Paymongo).to receive(:expire_checkout_session).and_raise(Paymongo::Error, "PayMongo answered 500")
    allow(Sentry).to receive(:capture_exception)

    expect(Bookings::Expire.call).to eq(0)
    expect(booking.reload).to be_awaiting_payment
    expect(payment.reload).to be_pending
  end
end
