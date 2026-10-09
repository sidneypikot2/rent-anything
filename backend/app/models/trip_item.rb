# One listing in a guest's trip (RAA-64), with its own dates and quantity. Undated items can
# sit in a trip but can't be checked out until they have a date (decision 9). Nothing is
# priced here: quotes come at checkout.
class TripItem < ApplicationRecord
  include DateRange

  belongs_to :trip, touch: true
  belongs_to :listing

  validates :quantity, numericality: { only_integer: true, in: 1..99 }
  validate :listing_is_bookable, if: :will_save_change_to_listing_id?

  private

  def listing_is_bookable
    errors.add(:listing, "isn't available to book") if listing && !listing.active?
  end
end
