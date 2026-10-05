# What a listing is (tour, action camera, van). A tree: only leaves carry a booking_type,
# which decides pricing and availability, and listings belong to leaves only. The
# attribute_schema (JSON Schema) checks a listing's attrs.
class Category < ApplicationRecord
  BOOKING_TYPES = %w[rental stay activity transfer].freeze

  belongs_to :parent, class_name: "Category", optional: true
  has_many :children, class_name: "Category", foreign_key: :parent_id, inverse_of: :parent,
    dependent: :restrict_with_error
  has_many :listings, dependent: :restrict_with_error
  has_many :category_tags, dependent: :delete_all
  has_many :tags, through: :category_tags

  enum :booking_type, BOOKING_TYPES.index_with(&:itself), validate: { allow_nil: true }

  validates :slug, presence: true, uniqueness: true
  validates :name, presence: true
  validate :attribute_schema_is_valid

  def leaf?
    booking_type.present?
  end

  private

  def attribute_schema_is_valid
    errors.add(:attribute_schema, "is not a valid JSON Schema") unless JSONSchemer.valid_schema?(attribute_schema)
  end
end
