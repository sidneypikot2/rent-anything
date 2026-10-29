# One thing a partner offers in one area: a GoPro, a tour, a room, a van route. Its
# category-specific fields live in attrs, checked against the category's attribute_schema.
# Only active listings reach guests, and never with their exact location before a paid
# booking. The partner moves it between draft, active (live), paused and delisted
# (Listings::ChangeStatus, RAA-115); the column is the listing_status Postgres enum.
class Listing < ApplicationRecord
  STATUSES = %w[draft active paused delisted].freeze
  # What a listing needs before it can go live (RAA-115), beyond what saving it checks, with
  # how a message names it.
  LIVE_BLOCKERS = {
    "photo" => "a photo",
    "description" => "a description of at least 50 characters",
    "price" => "a price",
    "route" => "a landmark on its route"
  }.freeze
  # What a guest gets back on cancelling (RAA-88), chosen by the partner; refunds follow it in M4.
  CANCELLATION_POLICIES = {
    "free_cancellation" => { name: "Free cancellation",
      description: "Guests can cancel for free any time before the booking starts." },
    "non_refundable" => { name: "Non-refundable", description: "Guests get no refund if they cancel." },
    "seven_days" => { name: "7-day cancellation",
      description: "Free to cancel at least 7 days before the booking starts; non-refundable within 7 days." },
    "fourteen_days" => { name: "14-day cancellation",
      description: "Free to cancel at least 14 days before the booking starts; non-refundable within 14 days." }
  }.freeze
  # How guests book it (RAA-132): at once, or by asking the partner, who accepts or declines
  # within Booking::REQUEST_TTL. Instant-book listings show a pill to guests.
  BOOKING_MODES = {
    "instant" => { name: "Instant book",
      description: "Guests book and pay straight away, without waiting for you. Keep your calendar up to date." },
    "request" => { name: "Request to book",
      description: "Guests send a request and you accept or decline it within 24 hours. Their dates are held meanwhile." }
  }.freeze
  # What a partner can pick (RAA-134): every listing is request to book, so a partner answers
  # every booking. Instant book stays a mode a listing can have, for when it is offered again.
  OFFERED_BOOKING_MODES = BOOKING_MODES.slice("request").freeze
  # How long a title and a description can be (RAA-149), and how long a description must be
  # to go live.
  TITLE_LENGTH = 10..80
  DESCRIPTION_MAX = 2000
  LIVE_DESCRIPTION_MIN = 50
  # What TourSerializer reads, to preload (RAA-110).
  TOUR_ASSOCIATIONS = %i[tour_detail tour_inclusions].freeze

  belongs_to :area
  belongs_to :partner, class_name: "User"
  # One of the partner's businesses (RAA-100); a foreign key also keeps it the partner's own.
  belongs_to :business
  belongs_to :category
  has_many :listing_landmarks, dependent: :delete_all
  has_many :landmarks, through: :listing_landmarks
  # The landmarks a tour or activity visits (RAA-70); a transfer will serve others.
  has_many :landmark_visits, -> { visits }, class_name: "ListingLandmark", inverse_of: :listing
  has_many :visited_landmarks, through: :landmark_visits, source: :landmark
  # Guests' unbooked trip items (RAA-64) go with the listing; the foreign key cascades too.
  has_many :trip_items, dependent: :delete_all
  # Its identical items, rooms or vehicles (RAA-98); the foreign key cascades too.
  has_many :units, -> { order(:position) }, class_name: "ListingUnit", dependent: :delete_all, inverse_of: :listing
  # Accommodation's nightly pricing (RAA-104); every accommodation listing has one.
  has_one :stay_rate, dependent: :delete, inverse_of: :listing
  # A vehicle rental's pricing (RAA-149); every vehicle listing has one.
  has_one :vehicle_rate, dependent: :delete, inverse_of: :listing
  # Gear's and a transfer's price (RAA-191).
  has_one :flat_rate, dependent: :delete, inverse_of: :listing
  # Extra charges, for any category (RAA-104); the foreign keys cascade too.
  has_many :fees, -> { order(:position) }, class_name: "ListingFee", dependent: :delete_all, inverse_of: :listing
  # A tour's type, group size and price (RAA-110); every tour has one. What it includes comes
  # with it; the foreign keys cascade too.
  has_one :tour_detail, dependent: :delete, inverse_of: :listing
  has_many :tour_inclusions, -> { order(:kind) }, dependent: :delete_all, inverse_of: :listing
  # Its photos in the partner's order (RAA-106), with those still uploading. Destroyed one by
  # one so each one's files are deleted from storage too.
  has_many :photos, -> { order(:position) }, class_name: "ListingPhoto", dependent: :destroy, inverse_of: :listing
  # What guests see: the ready ones (ListingPhotos::ResizeJob), the first the cover. Lists of
  # listings show only that.
  # The partner calendar (RAA-118): blocked days, per-day changes and bookings. A listing with
  # bookings isn't deleted: delisting takes it off the marketplace.
  has_many :availability_blocks, -> { order(:starts_on) }, dependent: :delete_all, inverse_of: :listing
  has_many :days, class_name: "ListingDay", dependent: :delete_all, inverse_of: :listing
  has_many :bookings, dependent: :restrict_with_error, inverse_of: :listing
  has_many :ready_photos, -> { ready.order(:position) }, class_name: "ListingPhoto", inverse_of: false
  has_one :cover_photo, -> { ready.order(:position) }, class_name: "ListingPhoto", inverse_of: false

  enum :status, STATUSES.index_with(&:itself), validate: true

  # A pet-friendly browse or search (RAA-185): of the stays, those whose attrs allow pets;
  # anything that isn't a stay is left in, as pets don't concern it.
  scope :pet_friendly, -> {
    where("listings.attrs->>'pets_allowed' = 'true' OR listings.category_id NOT IN (?)",
      Category.where(booking_type: "stay").select(:id))
  }

  before_destroy :keep_if_booked, prepend: true

  validates :title, :location, presence: true
  # Checked when they change (RAA-149), so a listing made under the old 120 / 5,000 limits
  # still saves until its partner edits them.
  validates :title, length: { in: TITLE_LENGTH }, if: :title_changed?
  validates :description, length: { maximum: DESCRIPTION_MAX }, if: :description_changed?
  validates :cancellation_policy, inclusion: { in: CANCELLATION_POLICIES.keys }
  validates :booking_mode, inclusion: { in: BOOKING_MODES.keys }
  # Every new listing has an address (RAA-41); ones made before it have none.
  validates :street, :city, :region, :postal_code, presence: true, on: :create
  validates :country, format: { with: /\A[A-Z]{2}\z/, message: "must be a two-letter country code" }
  validate :partner_is_a_partner
  validate :business_is_the_partners
  validate :category_is_a_leaf
  validate :attrs_match_category_schema

  def instant_book?
    booking_mode == "instant"
  end

  # Accommodation: the most guests it sleeps, every unit together, as Booking.units_for fills
  # them (a shared room's beds, one guest each; otherwise the guests each unit sleeps). Nil for
  # anything else, or a stay that doesn't say. Reads category and units.
  def sleeps
    return unless category.accommodation?
    return units.size if attrs["place_type"] == "shared_room"

    per_unit = attrs["guests"]
    per_unit * units.size if per_unit.is_a?(Integer) && per_unit.positive?
  end

  # The most guests one trip item (one booking) can be for: a tour's group, the guests a stay
  # sleeps, every vehicle of a rental's fleet together (RAA-191), or the seats of the one
  # vehicle a transfer books (Booking.units_for). Nil when the listing doesn't say. Reads
  # tour_detail, category and units.
  def max_guests
    return tour_detail.max_guests if tour_detail
    return sleeps if category.accommodation?
    return vehicle_seats * units.size if vehicle_seats

    seats = attrs["seats"]
    seats if seats.is_a?(Integer) && seats.positive?
  end

  # A rental vehicle's seats, rider or driver included (RAA-191): how many one of its units
  # carries. Nil for anything else, or one that doesn't say. Reads category.
  def vehicle_seats
    seats = attrs["seats"]
    seats if category.vehicle? && seats.is_a?(Integer) && seats.positive?
  end

  # A vehicle rental's period from starts_on to ends_on (RAA-195, Booking.rental_period), from
  # the pickup time or the shop's default. Nil for anything else. Reads category and vehicle_rate.
  def rental_period(starts_on, ends_on, pickup_time)
    return unless category.vehicle?

    Booking.rental_period(starts_on, ends_on, pickup_time || vehicle_rate&.default_pickup_time)
  end

  # The most one trip item's quantity can be: for gear, booked by the count, the units it has;
  # otherwise its guests (max_guests). Reads category: :parent and units.
  def max_quantity
    category.gear? ? units.size : max_guests
  end

  # How many photos it can have (RAA-110): a tour's carousel takes fewer.
  def photo_limit
    category&.tour? ? ListingPhoto::MAX_PER_TOUR : ListingPhoto::MAX_PER_LISTING
  end

  # What it still lacks to go live (LIVE_BLOCKERS' keys): a ready photo, a description of
  # LIVE_DESCRIPTION_MIN characters, a price (a stay's, a tour's, a vehicle's, or gear's and a
  # transfer's flat one, RAA-191), and a landmark on an activity's route. Reads photos, stay_rate,
  # tour_detail, vehicle_rate, flat_rate and visited_landmarks.
  def live_blockers
    [
      ("photo" unless photos.any?(&:ready?)),
      ("description" if description.strip.length < LIVE_DESCRIPTION_MIN),
      ("price" if needs_price?),
      ("route" if category.activity? && visited_landmarks.empty?)
    ].compact
  end

  # Refuses a change that takes from a live listing something it needs to be live (RAA-115);
  # what it lacked already (a listing made live before the rule) doesn't block the change.
  def check_still_live!(blockers_before)
    added = active? ? live_blockers - blockers_before : []
    return if added.empty?

    errors.add(:base, "A live listing needs #{added.map { LIVE_BLOCKERS[_1] }.to_sentence}: pause it first")
    raise ActiveRecord::RecordInvalid, self
  end

  private

  def keep_if_booked
    return unless bookings.exists?

    errors.add(:base, "A listing with bookings can't be deleted: delist it instead")
    throw :abort
  end

  def needs_price?
    (category.accommodation? && !stay_rate&.nightly_price_cents&.positive?) ||
      (category.tour? && !tour_detail&.base_price_cents&.positive?) ||
      (category.vehicle? && !vehicle_rate&.priced?) ||
      (category.flat_priced? && !flat_rate&.priced?)
  end

  def partner_is_a_partner
    errors.add(:partner, "must be a partner") if partner && !partner.partner?
  end

  def business_is_the_partners
    errors.add(:business, "must be one of the partner's businesses") if business && business.partner_id != partner_id
  end

  def category_is_a_leaf
    errors.add(:category, "must be a bookable category") if category && !category.leaf?
  end

  def attrs_match_category_schema
    return unless category&.leaf?

    JSONSchemer.schema(category.attribute_schema).validate(attrs).each do |error|
      errors.add(:attrs, error["error"])
    end
  end
end
