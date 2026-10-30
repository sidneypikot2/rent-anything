# How a vehicle rental is priced (RAA-149), as PH rental shops price motorbikes, cars and
# vans: a daily price, and optionally a half-day one (for half_day_hours), an hourly one,
# and weekly and monthly totals that come out cheaper per day. The security deposit is
# refundable and never part of the price. Delivery to the guest and picking the vehicle up
# from them at the end are each not offered (nil), free (0) or a fee. min_rental_days bounds
# a rental; a daily km limit may come with a fee per km above it. A car, van, multicab or
# tricycle can come with a driver (driving): with_driver has the driver in the price, either
# lets the guest choose, a driver then costing driver_fee_cents a day. A motorcycle is always
# self-drive. A daily price of 0 is "no
# price yet": existing listings were given one, and a partner sets the real price.
#
# A rental runs 24 hours a day from its pickup (RAA-195): the guest picks a pickup time on the
# half hour from pickup_from_hour to pickup_until_hour (the shop's hours, in the area's time),
# and a returned vehicle needs turnaround_minutes (0 to 12 hours, by the half hour) before the
# next rental can take it.
#
# A motorcycle shop can offer child helmets (RAA-205): free (0, an inclusion), for a fee per
# helmet and day, or not at all (nil). A guest takes up to one for each motorbike.
class VehicleRate < ApplicationRecord
  WEEK_DAYS = 7
  MONTH_DAYS = 30
  DRIVING = %w[self_drive with_driver either].freeze
  SELF_DRIVE_ONLY_SLUGS = %w[motorcycle].freeze
  MAX_TURNAROUND_MINUTES = 720
  CHILD_HELMET_SLUGS = %w[motorcycle].freeze

  belongs_to :listing, inverse_of: :vehicle_rate

  validates :daily_price_cents, :security_deposit_cents,
    numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :half_day_price_cents, :hourly_price_cents, :weekly_price_cents, :monthly_price_cents,
    numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :delivery_fee_cents, :return_pickup_fee_cents, :excess_km_fee_cents, :child_helmet_fee_cents,
    numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :half_day_hours, numericality: { only_integer: true, in: 2..12 }
  validates :min_rental_days, numericality: { only_integer: true, in: 1..365 }
  validates :km_limit_per_day, numericality: { only_integer: true, in: 1..2000 }, allow_nil: true
  validates :driving, inclusion: { in: DRIVING }
  validates :driver_fee_cents, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :pickup_from_hour, :pickup_until_hour, numericality: { only_integer: true, in: 0..23 }
  validates :turnaround_minutes, numericality: { only_integer: true, in: 0..MAX_TURNAROUND_MINUTES }
  validate :pickup_hours_in_order
  validate :turnaround_by_the_half_hour
  validate :listing_is_a_vehicle
  validate :longer_rentals_cost_less_per_day
  validate :shorter_rentals_cost_less
  validate :excess_km_fee_has_a_limit
  validate :driver_fee_goes_with_a_choice
  validate :child_helmets_on_a_motorcycle

  def priced?
    daily_price_cents.positive?
  end

  def delivers?
    !delivery_fee_cents.nil?
  end

  def picks_up?
    !return_pickup_fee_cents.nil?
  end

  def child_helmets?
    !child_helmet_fee_cents.nil?
  end

  def self_drive?
    driving == "self_drive"
  end

  # The pickup times a guest can pick: every half hour from pickup_from_hour to pickup_until_hour.
  def pickup_times
    (pickup_from_hour..pickup_until_hour).flat_map { [ format("%02d:00", _1), format("%02d:30", _1) ] }
      .first(((pickup_until_hour - pickup_from_hour) * 2) + 1)
  end

  # The pickup times still ahead on a day, in the area's time: all of them on a later day, those
  # after now today, none on a day gone by.
  def pickup_times_on(on)
    now = Time.current.in_time_zone(Booking::RENTAL_TIME_ZONE)
    return pickup_times if on > now.to_date
    return [] if on < now.to_date

    pickup_times.select { _1 > now.strftime("%H:%M") }
  end

  # Booking::DEFAULT_PICKUP_TIME, or the first pickup time when the shop opens later. On a day
  # (`on`), only a time still ahead: today, the next free half hour once 9:00 has gone.
  def default_pickup_time(on: nil)
    times = on ? pickup_times_on(on).presence || pickup_times : pickup_times
    times.include?(Booking::DEFAULT_PICKUP_TIME) ? Booking::DEFAULT_PICKUP_TIME : times.first
  end

  private

  def listing_is_a_vehicle
    errors.add(:base, "Only a vehicle rental has a vehicle rate") if listing && !listing.category&.vehicle?
  end

  def longer_rentals_cost_less_per_day
    return unless daily_price_cents.is_a?(Integer) && daily_price_cents.positive?

    if weekly_price_cents.is_a?(Integer) && weekly_price_cents > daily_price_cents * WEEK_DAYS
      errors.add(:weekly_price_cents, "can't be more than #{WEEK_DAYS} days at the daily price")
    end
    if monthly_price_cents.is_a?(Integer) && monthly_price_cents > daily_price_cents * MONTH_DAYS
      errors.add(:monthly_price_cents, "can't be more than #{MONTH_DAYS} days at the daily price")
    end
  end

  def shorter_rentals_cost_less
    if half_day_price_cents.is_a?(Integer) && daily_price_cents.is_a?(Integer) && daily_price_cents.positive? &&
        half_day_price_cents >= daily_price_cents
      errors.add(:half_day_price_cents, "must be less than the daily price")
    end
    shortest_above = half_day_price_cents || (daily_price_cents if daily_price_cents.to_i.positive?)
    return unless hourly_price_cents.is_a?(Integer) && shortest_above.is_a?(Integer) && hourly_price_cents >= shortest_above

    errors.add(:hourly_price_cents, "must be less than the #{half_day_price_cents ? 'half-day' : 'daily'} price")
  end

  def pickup_hours_in_order
    return unless pickup_from_hour.is_a?(Integer) && pickup_until_hour.is_a?(Integer) && pickup_until_hour < pickup_from_hour

    errors.add(:pickup_until_hour, "can't be before the first pickup hour")
  end

  def turnaround_by_the_half_hour
    errors.add(:turnaround_minutes, "must be in half hours") if turnaround_minutes.is_a?(Integer) && turnaround_minutes % 30 != 0
  end

  def excess_km_fee_has_a_limit
    errors.add(:excess_km_fee_cents, "needs a daily km limit") if excess_km_fee_cents && km_limit_per_day.nil?
  end

  def child_helmets_on_a_motorcycle
    return if child_helmet_fee_cents.nil? || CHILD_HELMET_SLUGS.include?(listing&.category&.slug)

    errors.add(:base, "Child helmets are only for a motorcycle")
  end

  def driver_fee_goes_with_a_choice
    if !self_drive? && SELF_DRIVE_ONLY_SLUGS.include?(listing&.category&.slug)
      errors.add(:driving, "can only be self-drive for a #{listing.category.name.downcase}")
    elsif driving == "either"
      errors.add(:driver_fee_cents, "is required when the guest can choose a driver") if driver_fee_cents.nil?
    elsif driver_fee_cents
      errors.add(:driver_fee_cents, "is only for self-drive or with driver: leave it out")
    end
  end
end
