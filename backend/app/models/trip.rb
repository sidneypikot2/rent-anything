# A guest's trip (RAA-64): a named group of items from any area, which is what the cart
# shows. Its dates, when set, always cover its dated items: adding or re-dating an item
# extends them (#cover). Status (planning, partly booked, booked) comes with checkout;
# until then every item is unbooked.
class Trip < ApplicationRecord
  include DateRange

  belongs_to :user
  has_many :items, -> { order(Arel.sql("trip_items.starts_on ASC NULLS LAST"), :id) },
    class_name: "TripItem", inverse_of: :trip, dependent: :delete_all

  validates :name, presence: true, length: { maximum: 80 }
  validates :guests, numericality: { only_integer: true, in: 1..50 }
  validate :user_is_a_guest
  validate :dates_cover_items, if: :dates_changed?

  # Days an ended trip stays in the cart, with its deletion notice, before the cleanup job
  # deletes its unbooked items (decision 10).
  CLEANUP_DAYS = 7

  # Trips a guest is still planning: undated, or not yet ended. Suggestions use these.
  scope :current, -> { where(ends_on: nil).or(where(ends_on: Date.current..)) }
  # What the cart lists: current trips and ones ended within CLEANUP_DAYS.
  scope :in_cart, -> { where(ends_on: nil).or(where(ends_on: (Date.current - CLEANUP_DAYS)..)) }
  scope :with_items, -> { includes(items: { listing: %i[area category] }) }

  # Row-locks the trips (and reloads them) in id order inside a transaction, so two requests
  # changing the same trips can't break the dates-cover-items rule or deadlock.
  def self.lock_all(*trips)
    trips.uniq.sort_by(&:id).each(&:lock!)
  end

  # Widens the dates to take in the range; sets them on an undated trip.
  def cover(from, to)
    return if from.nil?

    self.starts_on = [ starts_on, from ].compact.min
    self.ends_on = [ ends_on, to ].compact.max
  end

  private

  def user_is_a_guest
    errors.add(:user, "must be a guest") if user && !user.guest?
  end

  def dates_cover_items
    dated_items = items.where.not(starts_on: nil)
    return if new_record? || !dated_items.exists?
    return if dated? && dated_items.where("starts_on < ? OR ends_on > ?", starts_on, ends_on).none?

    errors.add(:base, "The trip's dates must cover the dates of its items")
  end
end
