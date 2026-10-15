# A booking of a listing (RAA-118): `quantity` of its units (a tour's groups) on the days it
# takes. A stay's dates are check-in and check-out, so it takes the nights between; any other
# booking takes every day from starts_on to ends_on. Until checkout (M4) every booking is one
# the partner took offline (Bookings::CreateOffline), with the total the guest paid them; a
# cancelled one frees its days. Capacity is counted per day under a lock on the listing row.
class Booking < ApplicationRecord
  STATUSES = %w[confirmed cancelled].freeze
  SOURCES = %w[offline checkout].freeze
  GUEST_NAME_LENGTH = 80
  NOTES_LENGTH = 500
  MAX_QUANTITY = 99

  belongs_to :listing, inverse_of: :bookings
  belongs_to :user, optional: true

  enum :status, STATUSES.index_with(&:itself), validate: true
  enum :source, SOURCES.index_with(&:itself), validate: true, prefix: true

  # Those that may take a day from `from` to `to`; a stay's last date is its check-out.
  scope :overlapping, ->(from, to) { where(starts_on: ..to, ends_on: from..) }

  def self.days_for(stay, starts_on, ends_on)
    stay ? (starts_on...ends_on) : (starts_on..ends_on)
  end

  def days
    Booking.days_for(listing.category.accommodation?, starts_on, ends_on)
  end
end
