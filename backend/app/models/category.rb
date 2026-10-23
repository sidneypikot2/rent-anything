# What a listing is (tour, action camera, van). A tree: only leaves carry a booking_type,
# which decides pricing and availability, and listings belong to leaves only. The
# attribute_schema (JSON Schema) checks a listing's attrs. unit_name and unit_name_plural say
# what one of a listing's units is called (RAA-100); blank means "unit".
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

  # A property type under Accommodation (RAA-82): only these are priced by StayRate (RAA-104).
  def accommodation?
    parent&.slug == "accommodation"
  end

  # The Tour category (RAA-110): only its listings have tour details.
  def tour?
    slug == "tour" && activity?
  end

  # A motorcycle, car, van, tricycle or multicab (RAA-88): its schema asks for make, model and
  # engine size, as the web app's isVehicle checks. Only these are priced by VehicleRate (RAA-149).
  def vehicle?
    properties = attribute_schema.is_a?(Hash) ? attribute_schema["properties"] : nil
    properties.is_a?(Hash) && %w[make model engine_cc].all? { properties.key?(_1) }
  end

  # How many units a listing has, in this category's words (RAA-100): "5 rooms", "1 motorcycle".
  def units_label(count)
    noun = count == 1 ? unit_name.presence || "unit" : unit_name_plural.presence || "units"
    "#{count} #{noun}"
  end

  private

  def attribute_schema_is_valid
    errors.add(:attribute_schema, "is not a valid JSON Schema") unless JSONSchemer.valid_schema?(attribute_schema)
  end
end
