require "rails_helper"

RSpec.describe Payments::Sync do
  let(:user) { create(:user) }
  let(:listing) { create(:listing, :stay) }
  let(:booking) do
    create(:booking, :checkout, listing:, user:, status: "awaiting_payment", expires_at: 10.minutes.from_now)
  end
  let(:payment) { create(:payment, :paymongo, user:, covered_booking_ids: [ booking.id ], amount_cents: booking.total_cents) }

  before { enable_paymongo }

  def session(**values)
    allow(Paymongo).to receive(:checkout_session).with(payment.provider_ref) { paymongo_session(payment.provider_ref, **values) }
  end

  it "confirms the bookings of a paid session on the payment, once" do
    session(paid: true)
    described_class.call(payment)
    described_class.call(payment.reload)

    expect(payment.reload).to have_attributes(status: "paid", provider_payment_id: "pay_#{payment.provider_ref}")
    expect(booking.reload).to have_attributes(status: "confirmed", payment:)
    expect(booking.events.where(to_status: "confirmed").count).to eq(1)
    expect(Paymongo).to have_received(:checkout_session).once
  end

  it "fails the payment when its session expired unpaid" do
    session(status: "expired")
    described_class.call(payment)

    expect(payment.reload).to have_attributes(status: "failed")
    expect(booking.reload).to be_awaiting_payment
  end

  it "leaves a session still being paid alone" do
    session
    described_class.call(payment)

    expect(payment.reload).to be_pending
  end

  it "marks a payment for bookings let go meanwhile as needing a refund" do
    Bookings::Transition.call(booking, "expired", actor: "system")
    session(paid: true)
    allow(Sentry).to receive(:capture_message)
    described_class.call(payment)

    expect(payment.reload).to have_attributes(status: "needs_refund")
    expect(booking.reload).to be_expired
    expect(Sentry).to have_received(:capture_message).with(/no longer held/, level: :error)
  end
end
