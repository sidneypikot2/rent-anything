# A booking of a listing (RAA-118, RAA-132): `quantity` of its units (a private tour's groups,
# a joiner tour's joiners) on the days it takes. A stay's dates are check-in and check-out, so
# it takes the nights between; any other booking takes every day from starts_on to ends_on.
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
  SOURCES = %w[offline checkout].freeze
  BOOKING_MODES = %w[instant request].freeze
  CANCELLED_BY = %w[guest partner system].freeze
  GUEST_NAME_LENGTH = 80
  NOTES_LENGTH = 500
  REASON_LENGTH = 500
  MAX_QUANTITY = 100
  # How long a partner has to answer a request, and a guest to pay for a hold.
  REQUEST_TTL = 24.hours
  PAYMENT_TTL = 15.minutes

  belongs_to :listing, inverse_of: :bookings
  belongs_to :user, optional: true
  belongs_to :checkout, optional: true, inverse_of: :bookings
  belongs_to :payment, optional: true, inverse_of: :bookings
  belongs_to :trip_item, optional: true, inverse_of: :bookings
  has_many :events, -> { order(:created_at, :id) }, class_name: "BookingEvent", inverse_of: :booking

  enum :status, STATUSES.index_with(&:itself), validate: true
  enum :source, SOURCES.index_with(&:itself), validate: true, prefix: true

  before_validation :assign_reference, on: :create

  scope :holding, -> { where(status: HOLDING) }
  # Those that may take a day from `from` to `to`; a stay's last date is its check-out.
  scope :overlapping, ->(from, to) { where(starts_on: ..to, ends_on: from..) }

  def self.days_for(stay, starts_on, ends_on)
    stay ? (starts_on...ends_on) : (starts_on..ends_on)
  end

  # A short code a guest and a partner can quote, e.g. BK7F3K9Q2A.
  def self.new_reference
    "BK#{SecureRandom.alphanumeric(8).upcase}"
  end

  def days
    Booking.days_for(listing.category.accommodation?, starts_on, ends_on)
  end

  # The last day it takes: a stay's last night, the one before check-out (a one-night stay's
  # is its check-in). Not `days.last`, which is the check-out for a stay's exclusive range.
  def last_day
    listing.category.accommodation? ? [ ends_on - 1, starts_on ].max : ends_on
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
end
