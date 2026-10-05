# One thing a partner offers in one area: a GoPro, a tour, a room, a van route. Its
# category-specific fields live in attrs, checked against the category's attribute_schema.
# Only active listings reach guests, and never with their exact location before a paid
# booking.
class Listing < ApplicationRecord
  STATUSES = %w[draft pending active].freeze

  belongs_to :area
  belongs_to :partner, class_name: "User"
  belongs_to :category
  has_many :listing_landmarks, dependent: :delete_all
  has_many :landmarks, through: :listing_landmarks

  enum :status, STATUSES.index_with(&:itself), validate: true

  validates :title, :location, presence: true
  validate :partner_is_a_partner
  validate :category_is_a_leaf
  validate :attrs_match_category_schema

  private

  def partner_is_a_partner
    errors.add(:partner, "must be a partner") if partner && !partner.partner?
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
