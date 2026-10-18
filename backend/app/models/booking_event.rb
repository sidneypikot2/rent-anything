# One change of a booking's status (RAA-132), written by Bookings::Transition: who made it
# (the guest, the partner or the system, with the user when there is one), from which status
# (none for the booking's first) and why. Never changed or deleted.
class BookingEvent < ApplicationRecord
  ACTORS = %w[guest partner system].freeze

  belongs_to :booking, inverse_of: :events
  belongs_to :user, optional: true

  validates :actor, inclusion: { in: ACTORS }
  validates :to_status, inclusion: { in: Booking::STATUSES }

  def readonly?
    persisted?
  end
end
