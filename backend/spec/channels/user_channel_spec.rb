require "rails_helper"

RSpec.describe UserChannel, type: :channel do
  let(:user) { create(:user) }

  it "streams the signed-in user's own updates" do
    stub_connection current_user: user
    subscribe
    expect(subscription).to be_confirmed
    expect(subscription).to have_stream_for(user)
  end

  it "refuses a subscription without a user" do
    stub_connection current_user: nil
    subscribe
    expect(subscription).to be_rejected
  end

  describe ".booking_updated" do
    let(:listing) { create(:listing, :stay) }
    let(:booking) { create(:booking, :checkout, listing:, status: "requested", expires_at: 1.hour.from_now) }
    let(:message) { { type: "booking.updated", booking_id: booking.id, status: "accepted" } }

    it "tells the guest and the partner when a request is answered" do
      expect { Bookings::Transition.call(booking, "accepted", actor: "partner", user: listing.partner) }
        .to have_broadcasted_to(booking.user).from_channel(UserChannel).with(message)
        .and have_broadcasted_to(listing.partner).from_channel(UserChannel).with(message)
    end

    it "tells them when a request is declined" do
      declined = message.merge(status: "declined")
      expect { Bookings::Respond.call(booking, "declined", user: listing.partner) }
        .to have_broadcasted_to(booking.user).from_channel(UserChannel).with(declined)
        .and have_broadcasted_to(listing.partner).from_channel(UserChannel).with(declined)
    end

    it "tells the partner about a new request" do
      new_booking = build(:booking, :checkout, listing:, status: "requested", expires_at: 1.hour.from_now)
      expect do
        new_booking.save!
        Bookings::Transition.record_start(new_booking, actor: "guest", user: new_booking.user)
      end.to have_broadcasted_to(listing.partner).from_channel(UserChannel)
        .with(a_hash_including("type" => "booking.updated", "status" => "requested"))
    end

    it "tells only the partner about their own offline booking" do
      offline = build(:booking, listing:, status: "confirmed")
      expect do
        offline.save!
        Bookings::Transition.record_start(offline, actor: "partner", user: listing.partner)
      end.to have_broadcasted_to(listing.partner).from_channel(UserChannel).exactly(:once)
    end

    it "says nothing when the change is rolled back" do
      expect do
        Booking.transaction do
          Bookings::Transition.call(booking, "accepted", actor: "partner", user: listing.partner)
          raise ActiveRecord::Rollback
        end
      end.not_to have_broadcasted_to(listing.partner).from_channel(UserChannel)
    end

    it "says nothing on a deployed stack without AnyCable's secret, where no server would take it" do
      allow(UserChannel).to receive(:live?).and_return(false)
      expect { Bookings::Transition.call(booking, "accepted", actor: "partner", user: listing.partner) }
        .not_to have_broadcasted_to(listing.partner).from_channel(UserChannel)
    end

    it "says nothing when the status doesn't change" do
      expect { Bookings::Transition.call(booking, "requested", actor: "system") }
        .not_to have_broadcasted_to(listing.partner).from_channel(UserChannel)
    end
  end
end
