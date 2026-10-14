# What a tour is (RAA-110), one row per listing in the `tour` category. A private tour is
# booked by one group: base_price is per group, and each inclusion the group picks adds its
# price per head. A joiner tour sells seats: base_price is per head, its inclusions bundled in.
# It runs on its weekdays (Date#wday: 0 Sunday … 6 Saturday) and its extra tour_dates, never
# on an availability_block (Tours::Schedule); for a multi-day tour those are start days.
# max_groups_per_day caps the bookings a day takes (private) or the groups filled to
# max_guests (joiner), enforced with bookings in M3. A base price of 0 is "no price yet": the
# tours made before RAA-110 have one until their partners set it.
class TourDetail < ApplicationRecord
  TOUR_TYPES = %w[private joiner].freeze
  MAX_GUESTS = 100
  MAX_GROUPS_PER_DAY = 100
  # The longest tour, per unit.
  DURATION_UNITS = { "hours" => 24, "days" => 30 }.freeze
  WEEKDAYS = (0..6).to_a.freeze

  belongs_to :listing, inverse_of: :tour_detail

  validates :tour_type, inclusion: { in: TOUR_TYPES }
  validates :min_guests, :max_guests, numericality: { only_integer: true, in: 1..MAX_GUESTS }
  validates :max_groups_per_day, numericality: { only_integer: true, in: 1..MAX_GROUPS_PER_DAY }
  validates :duration_unit, inclusion: { in: DURATION_UNITS.keys }
  validates :duration_value, numericality: { only_integer: true, greater_than_or_equal_to: 1 }
  validates :base_price_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :listing_is_a_tour
  validate :max_guests_from_min_guests
  validate :duration_within_unit
  validate :weekdays_are_days

  def private_tour?
    tour_type == "private"
  end

  def joiner?
    tour_type == "joiner"
  end

  def priced?
    base_price_cents.positive?
  end

  # Who base_price is for: a private tour's whole group, or each joiner.
  def price_unit
    private_tour? ? "group" : "person"
  end

  private

  def listing_is_a_tour
    errors.add(:base, "Only tours have tour details") if listing && !listing.category&.tour?
  end

  def max_guests_from_min_guests
    return unless min_guests.is_a?(Integer) && max_guests.is_a?(Integer) && max_guests < min_guests

    errors.add(:max_guests, "can't be fewer than the minimum guests")
  end

  def duration_within_unit
    longest = DURATION_UNITS[duration_unit]
    return unless longest && duration_value.is_a?(Integer) && duration_value > longest

    errors.add(:duration_value, "can be at most #{longest} #{duration_unit}")
  end

  def weekdays_are_days
    errors.add(:weekdays, "must be days of the week, 0 (Sunday) to 6 (Saturday)") unless (weekdays - WEEKDAYS).empty?
  end
end
