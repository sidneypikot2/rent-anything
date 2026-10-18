require "rails_helper"

# Two guests checking out a listing's last unit at the same moment (RAA-132): the listing row
# lock makes one wait for the other, so exactly one gets it. Real transactions on separate
# connections, so this spec doesn't run inside one; it empties the tables it wrote to after.
RSpec.describe Checkouts::Create, "under concurrency" do
  self.use_transactional_tests = false

  after do
    tables = ActiveRecord::Base.connection.tables - %w[schema_migrations ar_internal_metadata spatial_ref_sys]
    ActiveRecord::Base.connection.execute("TRUNCATE #{tables.join(', ')} RESTART IDENTITY CASCADE")
  end

  it "sells the last unit once" do
    day = 20.days.from_now.to_date
    listing = create(:listing, :stay, booking_mode: "instant")
    checkouts = Array.new(2) do |n|
      trip = create(:trip, starts_on: day, ends_on: day + 2)
      item = create(:trip_item, trip:, listing:, starts_on: day, ends_on: day + 2)
      [ trip.user, { trip_id: trip.id, item_ids: [ item.id ], idempotency_key: "concurrent-#{n}" } ]
    end

    results = checkouts.map do |user, params|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          Checkouts::Create.call(user, params) && :booked
        rescue ActiveRecord::RecordInvalid => e
          e.record.errors.full_messages
        end
      end
    end.map(&:value)

    expect(results).to include(:booked)
    expect(results.count(:booked)).to eq(1)
    expect(Booking.holding.count).to eq(1)
  end
end
