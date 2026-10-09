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
  after_save { @covering = false }

  # Days a trip shows its deletion notice in the cart before Trips::Cleanup deletes its
  # unbooked items (decision 10). The notice starts the day after a trip ends.
  CLEANUP_DAYS = 7
  # Days without an edit after which an undated trip gets the same notice.
  STALE_DAYS = 60

  # Trips a guest is still planning: not yet ended, or undated and not past their deletion
  # date. Suggestions use these.
  scope :current, -> { where(ends_on: Date.current..).or(where(ends_on: nil, updated_at: undated_cutoff..)) }
  # What the cart lists: every trip whose deletion date (#deletes_on) hasn't come.
  scope :in_cart, -> { where(ends_on: ended_cutoff..).or(where(ends_on: nil, updated_at: undated_cutoff..)) }
  # The rest: what Trips::Cleanup deletes.
  scope :due_for_cleanup, -> { where(ends_on: ...ended_cutoff).or(where(ends_on: nil, updated_at: ...undated_cutoff)) }
  scope :with_items, -> { includes(items: { listing: %i[area category] }) }

  # The cart keeps a trip that ended on or after this date (#deletes_on is still to come)...
  def self.ended_cutoff(today = Date.current)
    today - CLEANUP_DAYS
  end

  # ...and an undated trip last edited at or after this time.
  def self.undated_cutoff(today = Date.current)
    (today - STALE_DAYS - CLEANUP_DAYS + 1).beginning_of_day
  end

  # Row-locks the trips (and reloads them) in id order inside a transaction, so two requests
  # changing the same trips can't break the dates-cover-items rule or deadlock.
  def self.lock_all(*trips)
    trips.uniq.sort_by(&:id).each(&:lock!)
  end

  # The day Trips::Cleanup deletes this trip's unbooked items, once its deletion notice
  # shows: CLEANUP_DAYS after the notice starts, which is the day after the trip ends, or
  # STALE_DAYS after the last edit of an undated trip. Nil before then. `updated_at` is the
  # last edit because items touch their trip.
  def deletes_on(today = Date.current)
    notice_from = dated? ? ends_on + 1 : updated_at&.to_date&.+(STALE_DAYS)
    return if notice_from.nil? || notice_from > today

    notice_from + CLEANUP_DAYS
  end

  # Widens the dates to take in the range; sets them on an undated trip.
  # An item already under way may take the dates into the past; only dates a guest sets
  # are checked against today.
  def cover(from, to)
    return if from.nil?

    @covering = true

    self.starts_on = [ starts_on, from ].compact.min
    self.ends_on = [ ends_on, to ].compact.max
  end

  private

  def user_is_a_guest
    errors.add(:user, "must be a guest") if user && !user.guest?
  end

  def dates_are_not_past
    super unless @covering
  end

  def dates_cover_items
    return if new_record?

    dated_items = items.where.not(starts_on: nil)
    outside = dated? ? dated_items.where("starts_on < ? OR ends_on > ?", starts_on, ends_on) : dated_items
    return unless outside.exists?

    errors.add(:base, "The trip's dates must cover the dates of its items")
  end
end
