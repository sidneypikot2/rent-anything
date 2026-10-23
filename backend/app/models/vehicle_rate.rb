# How a vehicle rental is priced (RAA-149), as PH rental shops price motorbikes, cars and
# vans: a daily price, and optionally a half-day one (for half_day_hours), an hourly one,
# and weekly and monthly totals that come out cheaper per day. The security deposit is
# refundable and never part of the price. Delivery to the guest and picking the vehicle up
# from them at the end are each not offered (nil), free (0) or a fee. min_rental_days bounds
# a rental; a daily km limit may come with a fee per km above it. A car, van, multicab or
# tricycle can come with a driver (driving), at driver_fee_cents a day; a motorcycle is
# always self-drive. A daily price of 0 is "no
# price yet": existing listings were given one, and a partner sets the real price. It isn't
# quoted at checkout yet: a rental is still agreed with the partner (Bookings::Price).
class VehicleRate < ApplicationRecord
  WEEK_DAYS = 7
  MONTH_DAYS = 30
  DRIVING = %w[self_drive with_driver either].freeze
  SELF_DRIVE_ONLY_SLUGS = %w[motorcycle].freeze

  belongs_to :listing, inverse_of: :vehicle_rate

  validates :daily_price_cents, :security_deposit_cents,
    numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :half_day_price_cents, :hourly_price_cents, :weekly_price_cents, :monthly_price_cents,
    numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :delivery_fee_cents, :return_pickup_fee_cents, :excess_km_fee_cents,
    numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :half_day_hours, numericality: { only_integer: true, in: 2..12 }
  validates :min_rental_days, numericality: { only_integer: true, in: 1..365 }
  validates :km_limit_per_day, numericality: { only_integer: true, in: 1..2000 }, allow_nil: true
  validates :driving, inclusion: { in: DRIVING }
  validates :driver_fee_cents, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validate :listing_is_a_vehicle
  validate :longer_rentals_cost_less_per_day
  validate :shorter_rentals_cost_less
  validate :excess_km_fee_has_a_limit
  validate :driver_fee_goes_with_a_driver

  def priced?
    daily_price_cents.positive?
  end

  def delivers?
    !delivery_fee_cents.nil?
  end

  def picks_up?
    !return_pickup_fee_cents.nil?
  end

  def self_drive?
    driving == "self_drive"
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

  def excess_km_fee_has_a_limit
    errors.add(:excess_km_fee_cents, "needs a daily km limit") if excess_km_fee_cents && km_limit_per_day.nil?
  end

  def driver_fee_goes_with_a_driver
    if self_drive?
      errors.add(:driver_fee_cents, "needs a driver: choose with driver, or leave it out") if driver_fee_cents
    elsif SELF_DRIVE_ONLY_SLUGS.include?(listing&.category&.slug)
      errors.add(:driving, "can only be self-drive for a #{listing.category.name.downcase}")
    elsif driver_fee_cents.nil?
      errors.add(:driver_fee_cents, "is required with a driver")
    end
  end
end
