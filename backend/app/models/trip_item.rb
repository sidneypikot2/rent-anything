# One listing in a guest's trip (RAA-64), with its own dates and quantity. Undated items can
# sit in a trip but can't be checked out until they have a date (decision 9). Nothing is
# priced here: quotes come at checkout. Once booked (RAA-132) it is the booking's: it can't be
# changed, moved or removed while its booking holds its days. A declined, expired or cancelled
# booking lets it go, and it can be booked again.
class TripItem < ApplicationRecord
  include DateRange

  belongs_to :trip, touch: true
  belongs_to :listing
  # Its booking that holds its days; at most one (a partial unique index).
  has_one :booking, -> { holding }, inverse_of: :trip_item
  has_many :bookings, inverse_of: :trip_item, dependent: :nullify

  before_destroy :keep_if_booked, prepend: true

  scope :booked, -> { where(Booking.holding.where("bookings.trip_item_id = trip_items.id").arel.exists) }
  scope :unbooked, -> { where.not(Booking.holding.where("bookings.trip_item_id = trip_items.id").arel.exists) }

  def booked?
    booking.present?
  end

  MAX_QUANTITY = 99

  validates :quantity, numericality: { only_integer: true, in: 1..MAX_QUANTITY }
  # A stay's pets (RAA-182); its split into rooms, room_guests, is checked by the services
  # that set it (Stays::Arrangement).
  validates :pets, numericality: { only_integer: true, in: 0..20 }
  validate :listing_is_bookable, if: :will_save_change_to_listing_id?

  private

  def keep_if_booked
    return unless booked?

    errors.add(:base, "A booked item can't be removed: cancel its booking first")
    throw :abort
  end

  def listing_is_bookable
    errors.add(:listing, "isn't available to book") if listing && !listing.active?
  end
end
