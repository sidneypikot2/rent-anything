# A guest's trip (RAA-64): a named group of items from any area, which is what the cart
# shows. Its dates, when set, always cover its dated items: adding or re-dating an item
# extends them (#cover). Its items are booked through checkout (RAA-132); a trip with a
# booked item isn't deleted, and its booked items stay as they are.
class Trip < ApplicationRecord
  include DateRange

  belongs_to :user
  has_many :items, -> { order(Arel.sql("trip_items.starts_on ASC NULLS LAST"), :id) },
    class_name: "TripItem", inverse_of: :trip, dependent: :delete_all

  validates :name, presence: true, length: { maximum: 80 }
  validates :guests, numericality: { only_integer: true, in: 1..50 }
  # Of the guests, how many are children and infants (RAA-182): the rest are adults, at
  # least one. Pets aren't guests.
  validates :children, :infants, numericality: { only_integer: true, in: 0..49 }
  validates :pets, numericality: { only_integer: true, in: 0..20 }
  validate :has_an_adult
  validate :user_is_a_guest
  validate :dates_cover_items, if: :dates_changed?
  before_save :follow_dates_in_name, if: -> { dates_changed? && !name_changed? }
  after_save { @covering = false }
  before_destroy :keep_if_booked, prepend: true

  # Days a trip shows its deletion notice in the cart before Trips::Cleanup deletes its
  # unbooked items (decision 10). The notice starts the day after a trip ends.
  CLEANUP_DAYS = 7
  # Days without an edit after which an undated trip gets the same notice.
  STALE_DAYS = 60
  # Days after it ends that an unregistered guest's trip is deleted, booked items and all
  # (Guests::Purge, RAA-175); an undated one's, after its last edit.
  PURGE_DAYS = 60

  # Trips a guest is still planning: not yet ended, or undated and not past their deletion
  # date. Suggestions use these.
  scope :current, -> { where(ends_on: Date.current..).or(where(ends_on: nil, updated_at: undated_cutoff..)) }
  # What the cart lists: every trip whose deletion date (#deletes_on) hasn't come.
  scope :in_cart, -> { where(ends_on: ended_cutoff..).or(where(ends_on: nil, updated_at: undated_cutoff..)) }
  # The rest: what Trips::Cleanup deletes.
  scope :due_for_cleanup, -> { where(ends_on: ...ended_cutoff).or(where(ends_on: nil, updated_at: ...undated_cutoff)) }
  # The Trips page (RAA-139): trips with a booked item, which Trips::Cleanup keeps.
  scope :with_bookings, -> { where(TripItem.booked.where("trip_items.trip_id = trips.id").arel.exists) }
  # Trips of guests with no password and no Google or Facebook sign-in (User.unregistered).
  scope :of_unregistered_guests, -> { where(user_id: User.unregistered.select(:id)) }
  # Those whose #purge_on has come by `today`.
  scope :due_for_purge, ->(today = Date.current) {
    where(ends_on: ..(today - PURGE_DAYS)).or(where(ends_on: nil, updated_at: ...(today - PURGE_DAYS + 1).beginning_of_day))
  }
  scope :with_items, -> { includes(items: [ :booking, { listing: [ :area, :business, { category: :parent }, :cover_photo, :units, :stay_rate, :tour_detail ] } ]) }

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

  # A new view-only share link (RAA-176), ending the old one. Not an edit: updated_at, which
  # the undated trip's deletion dates count from, stays.
  def share!
    update_columns(share_token: SecureRandom.urlsafe_base64(32))
    share_token
  end

  def unshare!
    update_columns(share_token: nil)
  end

  # The day Guests::Purge deletes this trip if its guest is unregistered (RAA-175).
  def purge_on
    (dated? ? ends_on : updated_at.to_date) + PURGE_DAYS
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

  def booked?
    items.booked.exists?
  end

  # The destinations its items are in (Trips::Destination), in the order the trip reaches
  # them: items go in date order, undated last.
  def places
    items = self.items.reload.includes(listing: :area).to_a
    destinations = Trips::Destination.for_areas(items.map { _1.listing.area_id }.uniq)
    items.map { |item| destinations[item.listing.area_id]&.name || item.listing.area.name }.uniq
  end

  # After its items change (an add, a move, a re-date, a removal, a merge), a name the trip
  # was given from its places names the places it has now; a typed name is left alone.
  def follow_places_in_name!
    renamed = Trips::Destination.for_places(name, places, starts_on, ends_on)
    update!(name: renamed) if renamed
  end

  private

  def keep_if_booked
    return unless booked?

    errors.add(:base, "A trip with bookings can't be deleted: cancel them first")
    throw :abort
  end

  def has_an_adult
    return unless [ guests, children, infants ].all?(Integer) && children + infants >= guests

    errors.add(:base, "A trip needs at least one adult among its guests")
  end

  def user_is_a_guest
    errors.add(:user, "must be a guest") if user && !user.guest?
  end

  def dates_are_not_past
    super unless @covering
  end

  # A name made from the destination and dates keeps saying the trip's dates, whichever way
  # they change (an item extending them, Edit trip, a merge); a typed name is left alone.
  def follow_dates_in_name
    redated = Trips::Destination.redated(name, [ starts_on_was, ends_on_was ], [ starts_on, ends_on ])
    self.name = redated if redated
  end

  def dates_cover_items
    return if new_record?

    dated_items = items.where.not(starts_on: nil)
    outside = dated? ? dated_items.where("starts_on < ? OR ends_on > ?", starts_on, ends_on) : dated_items
    return unless outside.exists?

    errors.add(:base, "The trip's dates must cover the dates of its items")
  end
end
