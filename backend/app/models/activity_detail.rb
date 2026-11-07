# How a water activity is sold and when it runs (RAA-270), one row per listing in a water
# activity category. Sold per unit, a guest takes a whole machine, kayak or boat for their party,
# up to seats_per_unit on it; sold per person, guests take seats, seats_per_unit on each unit.
# It runs in open hours (a start on any half hour from opens_at, ending by closes_at) or at set
# departure_times. What a guest picks, and pays, is one of the listing's ActivityOffers.
#
# What comes with it is picked from a fixed list (inclusions, RAA-271), so every listing names it
# the same; `included` is a free-text note beside it. Its delivery_zones price taking the unit to
# the guest's beach or chosen spot by distance (DeliveryZoned); none, no drop-off.
class ActivityDetail < ApplicationRecord
  include DeliveryZoned

  INCLUSIONS = {
    "life_vest" => "Life vest",
    "safety_briefing" => "Safety briefing",
    "fuel" => "Fuel",
    "marshal_boat" => "Marshal boat",
    "waterproof_bag" => "Waterproof bag",
    "shower_room" => "Shower room"
  }.freeze
  SOLD_BY = %w[unit person].freeze
  SCHEDULES = %w[open_hours departures].freeze
  # "08:00", "16:30": a start on the hour or the half hour, as trip items' pickup_time.
  HALF_HOUR = /\A([01][0-9]|2[0-3]):(00|30)\z/
  MAX_SEATS = 100
  MAX_DEPARTURES = 24
  MIN_AGES = 1..99
  TEXT_LENGTH = 500

  belongs_to :listing, inverse_of: :activity_detail
  has_many :delivery_zones, -> { order(:max_distance_m) }, class_name: "ActivityDeliveryZone",
    inverse_of: :activity_detail, dependent: :delete_all, autosave: true

  validate :known_inclusions

  validates :sold_by, inclusion: { in: SOLD_BY }
  validates :schedule, inclusion: { in: SCHEDULES }
  validates :seats_per_unit, numericality: { only_integer: true, in: 1..MAX_SEATS }
  validates :min_age, numericality: { only_integer: true, in: MIN_AGES }, allow_nil: true
  validates :included, :requirements, length: { maximum: TEXT_LENGTH }
  validate :listing_is_a_water_activity
  validate :hours_or_departures

  def per_person?
    sold_by == "person"
  end

  def open_hours?
    schedule == "open_hours"
  end

  # The minutes from opening to closing, nil for departures.
  def open_minutes
    open_hours? && opens_at && closes_at ? self.class.minutes(closes_at) - self.class.minutes(opens_at) : nil
  end

  def self.minutes(time)
    hour, minute = time.split(":").map { Integer(_1, 10) }
    (hour * 60) + minute
  end

  private

  def known_inclusions
    errors.add(:inclusions, "must be from: #{INCLUSIONS.keys.join(', ')}") unless (inclusions - INCLUSIONS.keys).empty?
  end

  def listing_is_a_water_activity
    errors.add(:base, "Only water activities have activity details") if listing && !listing.category&.water_activity?
  end

  def hours_or_departures
    if open_hours?
      unless [ opens_at, closes_at ].all? { _1.is_a?(String) && HALF_HOUR.match?(_1) } && opens_at < closes_at
        errors.add(:base, "Open hours need an opening time before the closing time, each on the hour or half hour")
      end
    elsif schedule == "departures"
      unless departure_times.size.between?(1, MAX_DEPARTURES) && departure_times.all? { HALF_HOUR.match?(_1) }
        errors.add(:departure_times, "need 1 to #{MAX_DEPARTURES} times, each on the hour or half hour")
      end
    end
  end
end
