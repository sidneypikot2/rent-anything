# One thing a partner offers in one area: a GoPro, a tour, a room, a van route. Its
# category-specific fields live in attrs, checked against the category's attribute_schema.
# Only active listings reach guests, and never with their exact location before a paid
# booking.
class Listing < ApplicationRecord
  STATUSES = %w[draft pending active].freeze
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
  # What TourSerializer reads, to preload (RAA-110).
  TOUR_ASSOCIATIONS = %i[tour_detail tour_dates tour_inclusions availability_blocks].freeze

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
  # Extra charges, for any category (RAA-104); the foreign keys cascade too.
  has_many :fees, -> { order(:position) }, class_name: "ListingFee", dependent: :delete_all, inverse_of: :listing
  # A tour's type, group size, schedule and price (RAA-110); every tour has one. Its extra
  # dates and what it includes come with it; the foreign keys cascade too.
  has_one :tour_detail, dependent: :delete, inverse_of: :listing
  has_many :tour_dates, -> { order(:date) }, dependent: :delete_all, inverse_of: :listing
  has_many :tour_inclusions, -> { order(:kind) }, dependent: :delete_all, inverse_of: :listing
  # Days it takes no bookings (RAA-110), for any category.
  has_many :availability_blocks, -> { order(:starts_on) }, dependent: :delete_all, inverse_of: :listing
  # Its photos in the partner's order (RAA-106), with those still uploading. Destroyed one by
  # one so each one's files are deleted from storage too.
  has_many :photos, -> { order(:position) }, class_name: "ListingPhoto", dependent: :destroy, inverse_of: :listing
  # What guests see: the ready ones (ListingPhotos::ResizeJob), the first the cover. Lists of
  # listings show only that.
  has_many :ready_photos, -> { ready.order(:position) }, class_name: "ListingPhoto", inverse_of: false
  has_one :cover_photo, -> { ready.order(:position) }, class_name: "ListingPhoto", inverse_of: false

  enum :status, STATUSES.index_with(&:itself), validate: true

  validates :title, :location, presence: true
  validates :title, length: { maximum: 120 }
  validates :description, length: { maximum: 5000 }
  validates :cancellation_policy, inclusion: { in: CANCELLATION_POLICIES.keys }
  # Every new listing has an address (RAA-41); ones made before it have none.
  validates :street, :city, :region, :postal_code, presence: true, on: :create
  validates :country, format: { with: /\A[A-Z]{2}\z/, message: "must be a two-letter country code" }
  validate :partner_is_a_partner
  validate :business_is_the_partners
  validate :category_is_a_leaf
  validate :attrs_match_category_schema

  # How many photos it can have (RAA-110): a tour's carousel takes fewer.
  def photo_limit
    category&.tour? ? ListingPhoto::MAX_PER_TOUR : ListingPhoto::MAX_PER_LISTING
  end

  private

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
