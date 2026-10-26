require "rails_helper"

RSpec.describe Payments::Pay do
  let(:user) { create(:user) }
  let(:listing) { create(:listing, :stay) }
  let(:today) { Date.current }

  def held(**values)
    create(:booking, :checkout, listing:, user:, status: "awaiting_payment", expires_at: 10.minutes.from_now, **values)
  end

  context "without PayMongo" do
    it "pays at once through the stub, and opens no checkout" do
      booking = held
      result = described_class.call(user, [ booking.id ])

      expect(result.payment).to be_nil
      expect(result.bookings.map(&:status)).to eq(%w[confirmed])
      expect(booking.reload.payment).to have_attributes(provider: "stub", status: "paid", user:)
    end
  end

  context "with PayMongo" do
    before do
      enable_paymongo
      allow(Paymongo).to receive(:create_checkout_session) { paymongo_session("cs_new") }
    end

    it "opens one checkout for bookings of several checkouts, and holds them while it is open" do
      first = held
      second = held(starts_on: today + 5, ends_on: today + 6, total_cents: 150_000)
      result = described_class.call(user, [ first.id, second.id ])

      expect(result.payment).to have_attributes(provider: "paymongo", status: "pending", provider_ref: "cs_new",
        checkout_url: "https://checkout.paymongo.com/cs_new", amount_cents: 550_000, user:, checkout: nil,
        covered_booking_ids: [ first.id, second.id ])
      expect(result.bookings.map(&:status)).to eq(%w[awaiting_payment awaiting_payment])
      expect(first.reload.payment).to be_nil
      expect(first.expires_at).to be_within(1.minute).of(Payment::CHECKOUT_WINDOW.from_now)
      expect(Paymongo).to have_received(:create_checkout_session).with(hash_including(
        payment_method_types: %w[gcash paymaya card qrph],
        line_items: [ hash_including(amount: 400_000, quantity: 1, currency: "PHP"), hash_including(amount: 150_000) ],
        success_url: end_with("/cart?payment=#{result.payment.id}")
      ))
    end

    it "returns the checkout already open when asked again for the same bookings" do
      booking = held
      first = described_class.call(user, [ booking.id ]).payment
      again = described_class.call(user, [ booking.id ]).payment

      expect(again).to eq(first)
      expect(Paymongo).to have_received(:create_checkout_session).once
    end

    it "lets an open checkout go when some of its bookings are paid for with others" do
      booking = held
      other = held(starts_on: today + 5, ends_on: today + 6)
      old = create(:payment, :paymongo, user:, covered_booking_ids: [ booking.id ])
      allow(Paymongo).to receive(:expire_checkout_session)
      allow(Paymongo).to receive(:checkout_session).with(old.provider_ref) { paymongo_session(old.provider_ref, status: "expired") }

      payment = described_class.call(user, [ booking.id, other.id ]).payment

      expect(old.reload).to have_attributes(status: "failed")
      expect(payment).to have_attributes(status: "pending", covered_booking_ids: [ booking.id, other.id ])
    end

    it "refuses while an open checkout for some of them is being paid" do
      booking = held
      old = create(:payment, :paymongo, user:, covered_booking_ids: [ booking.id ])
      allow(Paymongo).to receive(:expire_checkout_session).and_raise(Paymongo::Error.new("400", status: 400))
      allow(Paymongo).to receive(:checkout_session) { paymongo_session(old.provider_ref) }

      expect { described_class.call(user, [ booking.id, held(starts_on: today + 5, ends_on: today + 6).id ]) }
        .to raise_error(ActiveRecord::RecordInvalid, /still going through/)
      expect(old.reload).to be_pending
    end

    it "confirms a booking paid already and one priced at nothing without charging" do
      paid = held
      paid.update!(payment: create(:payment, checkout: paid.checkout))
      free = held(starts_on: today + 5, ends_on: today + 6, total_cents: 0)
      result = described_class.call(user, [ paid.id, free.id ])

      expect(result.payment).to be_nil
      expect(result.bookings.map(&:status)).to eq(%w[confirmed confirmed])
      expect(Paymongo).not_to have_received(:create_checkout_session)
    end

    it "refuses a total below PayMongo's minimum" do
      expect { described_class.call(user, [ held(total_cents: 1_000).id ]) }
        .to raise_error(ActiveRecord::RecordInvalid, /at least ₱20/)
      expect(Payment.count).to eq(0)
    end

    it "fails the payment when PayMongo can't be reached" do
      allow(Paymongo).to receive(:create_checkout_session).and_raise(Paymongo::Error, "PayMongo answered 500")

      expect { described_class.call(user, [ held.id ]) }.to raise_error(Paymongo::Error)
      expect(Payment.sole).to have_attributes(status: "failed")
    end
  end
end
