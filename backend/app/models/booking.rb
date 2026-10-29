# A booking of a listing (RAA-118, RAA-132): `quantity` of its units (a private tour's groups,
# a joiner tour's joiners) on the days it takes. A stay's dates are check-in and check-out, so
# it takes the nights between. A vehicle rental (RAA-195) runs 24 hours a day from its pickup
# time (starts_at to ends_at), so it takes the days it starts on, like a stay's nights, and its
# vehicles are free again on the return day once they are back. Any other booking takes every
# day from starts_on to ends_on.
#
# A guest's checkout (Checkouts::Create) makes one per trip item; a partner can also record one
# taken offline (Bookings::CreateOffline), which is confirmed from the start. Its lifecycle,
# as on Airbnb and Booking.com:
#
#   requested → accepted → awaiting_payment → confirmed → in_progress → completed
#
# An instant-book listing's booking starts at awaiting_payment. A request can be declined, and
# expires unanswered; an unpaid hold expires; anything not yet under way can be cancelled.
# Bookings::Transition makes every change and records it as a BookingEvent. Every HOLDING
# booking takes its days on the calendar, so a request already blocks them.
class Booking < ApplicationRecord
  STATUSES = %w[requested accepted awaiting_payment confirmed in_progress completed declined cancelled expired].freeze
  # Those that take their days: everything not declined, cancelled or expired.
  HOLDING = %w[requested accepted awaiting_payment confirmed in_progress completed].freeze
  # Not yet confirmed: what the guest and the partner see as pending.
  PENDING = %w[requested accepted awaiting_payment].freeze
  # Not settled yet: what keeps an unregistered guest's trip from being purged (RAA-175).
  UNSETTLED = %w[requested accepted awaiting_payment confirmed in_progress].freeze
  SOURCES = %w[offline checkout].freeze
  BOOKING_MODES = %w[instant request].freeze
  CANCELLED_BY = %w[guest partner system].freeze
  GUEST_NAME_LENGTH = 80
  NOTES_LENGTH = 500
  REASON_LENGTH = 500
  MAX_QUANTITY = 100
  # How long a partner has to answer a request, and a guest to pay for an instant hold. An
  # accepted request gives the guest a day to pay, or until the day it starts (RAA-143).
  REQUEST_TTL = 24.hours
  PAYMENT_TTL = 15.minutes
  ACCEPTED_PAYMENT_TTL = 24.hours
  # A vehicle rental's pickup time (RAA-195): on the half hour, in the area's time (every area
  # is in the Philippines so far); 9:00 when none was picked.
  RENTAL_TIME_ZONE = "Asia/Manila"
  DEFAULT_PICKUP_TIME = "09:00"
  PICKUP_TIME_FORMAT = /\A([01]\d|2[0-3]):(00|30)\z/

  belongs_to :listing, inverse_of: :bookings
  belongs_to :user, optional: true
  belongs_to :checkout, optional: true, inverse_of: :bookings
  belongs_to :payment, optional: true, inverse_of: :bookings
  belongs_to :trip_item, optional: true, inverse_of: :bookings
  has_many :events, -> { order(:created_at, :id) }, class_name: "BookingEvent", inverse_of: :booking

  enum :status, STATUSES.index_with(&:itself), validate: true
  enum :source, SOURCES.index_with(&:itself), validate: true, prefix: true

  before_validation :assign_reference, on: :create
  before_validation :assign_rental_period

  scope :holding, -> { where(status: HOLDING) }
  scope :unsettled, -> { where(status: UNSETTLED) }
  # Those that may take a day from `from` to `to`; a stay's last date is its check-out.
  scope :overlapping, ->(from, to) { where(starts_on: ..to, ends_on: from..) }

  # The units `guests` take of a listing (RAA-132): a joiner tour's seats, one each; a
  # private tour's groups of up to max_guests; a stay's units, each sleeping what its attrs
  # say (a shared room's beds, one each); gear as many as the item's count, its quantity being
  # how many rather than guests (Category#gear?); anything else one unit (a van, a motorbike),
  # as the trip item counts guests, not units. A stay split into rooms by the guest
  # (room_guests, RAA-182) takes those rooms. A vehicle with seats (RAA-191) takes enough for
  # the guests, rounded up, or the more the guest chose (`chosen`, a trip item's units): a group
  # of 10 on 2-seat motorbikes takes 5, or 6 if one rides alone.
  def self.units_for(listing, guests, room_guests: nil, chosen: nil)
    units =
      if (tour = listing.tour_detail)
        tour.joiner? ? guests : guests.fdiv(tour.max_guests).ceil
      elsif listing.category.accommodation? && room_guests && !listing.stay_rate&.per_guest?
        room_guests.size
      elsif listing.category.gear?
        guests
      elsif (seats = listing.vehicle_seats)
        [ guests.fdiv(seats).ceil, [ chosen || 0, guests ].min ].max
      elsif listing.category.accommodation?
        sleeps = listing.attrs["guests"]
        listing.stay_rate&.per_guest? ? guests : (sleeps.is_a?(Integer) && sleeps.positive? ? guests.fdiv(sleeps).ceil : 1)
      else
        1
      end
    units.clamp(1, MAX_QUANTITY)
  end

  # The days a booking of the listing from starts_on to ends_on takes: a stay's nights, a vehicle
  # rental's days (each 24 hours from the pickup, so Nov 3 to Nov 5 takes Nov 3 and 4, and a
  # single date one day), anything else every day.
  def self.days_for(listing, starts_on, ends_on)
    if listing.category.accommodation?
      starts_on...ends_on
    elsif listing.category.vehicle?
      starts_on...(starts_on + rental_days(starts_on, ends_on))
    else
      starts_on..ends_on
    end
  end

  # A rental's days, at least one: Nov 3 to Nov 5 is 2, a single date 1 (Bookings::Price).
  def self.rental_days(starts_on, ends_on)
    [ (ends_on - starts_on).to_i, 1 ].max
  end

  # A vehicle rental's period: from the pickup time (DEFAULT_PICKUP_TIME when nil) on starts_on,
  # 24 hours for each of its days, so it is due back at the pickup time on its last date.
  def self.rental_period(starts_on, ends_on, pickup_time)
    hour, minute = (pickup_time || DEFAULT_PICKUP_TIME).split(":").map { Integer(_1, 10) }
    starts_at = ActiveSupport::TimeZone[RENTAL_TIME_ZONE].local(starts_on.year, starts_on.month, starts_on.day, hour, minute)
    starts_at...(starts_at + rental_days(starts_on, ends_on).days)
  end

  # A time as a pickup time in the area's time: "08:30".
  def self.local_time(time)
    time.in_time_zone(RENTAL_TIME_ZONE).strftime("%H:%M")
  end

  # A short code a guest and a partner can quote, e.g. BK7F3K9Q2A.
  def self.new_reference
    "BK#{SecureRandom.alphanumeric(8).upcase}"
  end

  def days
    Booking.days_for(listing, starts_on, ends_on)
  end

  # The last day it is under way: a stay's last night, the one before check-out (a one-night
  # stay's is its check-in); a vehicle rental's return day. Not `days.last`, which is the
  # check-out for a stay's exclusive range.
  def last_day
    if listing.category.accommodation?
      [ ends_on - 1, starts_on ].max
    elsif listing.category.vehicle?
      starts_on + Booking.rental_days(starts_on, ends_on)
    else
      ends_on
    end
  end

  # A vehicle rental's pickup time ("08:30"); nil for anything else.
  def pickup_time
    starts_at && Booking.local_time(starts_at)
  end

  def holding?
    HOLDING.include?(status)
  end

  def pending?
    PENDING.include?(status)
  end

  private

  def assign_reference
    self.reference ||= Booking.new_reference
  end

  # A vehicle rental always has its period: the default pickup time when nothing set one.
  def assign_rental_period
    return unless starts_at.nil? && starts_on && ends_on && listing&.category&.vehicle?

    period = listing.rental_period(starts_on, ends_on, nil)
    self.starts_at = period.begin
    self.ends_at = period.end
  end
end
