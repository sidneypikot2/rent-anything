# How an accommodation listing is priced (RAA-104), as on Airbnb and Booking.com: a nightly
# price (a weekend one for Friday and Saturday nights if set) covers up to base_guests, and
# each guest above that pays extra_guest_fee per night, up to the listing's attrs.guests. A
# shared room (a dorm bed) is priced per guest instead, so it has no base occupancy or extra
# fee. Stays of 7+ / 28+ nights get the weekly / monthly discount. A nightly price of 0 is
# "no price yet": existing listings were given one, and a partner sets the real price.
# Stays::Quote works out a stay's price from it.
class StayRate < ApplicationRecord
  WEEKEND_DAYS = [ 5, 6 ].freeze # The nights of Friday and Saturday (Date#wday).
  WEEKLY_NIGHTS = 7
  MONTHLY_NIGHTS = 28

  belongs_to :listing, inverse_of: :stay_rate

  validates :nightly_price_cents, :extra_guest_fee_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :weekend_price_cents, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :base_guests, numericality: { only_integer: true, in: 1..50 }
  validates :weekly_discount_percent, :monthly_discount_percent, numericality: { only_integer: true, in: 0..90 }
  validates :min_nights, numericality: { only_integer: true, in: 1..365 }
  validates :max_nights, numericality: { only_integer: true, less_than_or_equal_to: 365 }, allow_nil: true
  validate :listing_is_accommodation
  validate :max_nights_from_min_nights
  validate :base_guests_fit_the_place
  validate :monthly_discount_at_least_weekly
  validate :shared_room_priced_per_guest

  def priced?
    nightly_price_cents.positive?
  end

  # A dorm bed: the nightly price is per guest.
  def per_guest?
    listing.attrs["place_type"] == "shared_room"
  end

  private

  def listing_is_accommodation
    errors.add(:base, "Only accommodation is priced by the night") if listing && !listing.category&.accommodation?
  end

  def max_nights_from_min_nights
    return if max_nights.nil? || min_nights.nil? || max_nights >= min_nights

    errors.add(:max_nights, "can't be fewer than the minimum nights")
  end

  def base_guests_fit_the_place
    guests = listing&.attrs&.dig("guests")
    return unless guests.is_a?(Integer) && base_guests.is_a?(Integer) && base_guests > guests

    errors.add(:base_guests, "can't be more than the #{guests} #{'guest'.pluralize(guests)} the place sleeps")
  end

  def monthly_discount_at_least_weekly
    return unless weekly_discount_percent.to_i.positive? && monthly_discount_percent.to_i.positive?
    return if monthly_discount_percent >= weekly_discount_percent

    errors.add(:monthly_discount_percent, "can't be less than the weekly discount")
  end

  def shared_room_priced_per_guest
    return unless listing && per_guest?

    errors.add(:base_guests, "must be 1 for a shared room: it is priced per guest") unless base_guests == 1
    errors.add(:extra_guest_fee_cents, "must be 0 for a shared room: it is priced per guest") unless extra_guest_fee_cents.to_i.zero?
  end
end
