# A place a guest stays in or around: a tree from region down to a city, town or island
# (Cebu City sits under Cebu, under Central Visayas). A single point a guest visits is a
# Landmark instead.
class Area < ApplicationRecord
  KINDS = %w[region province city town island].freeze
  # Top-level web paths an area slug would collide with.
  RESERVED_SLUGS = %w[partner admin search login register dashboard].freeze

  belongs_to :parent, class_name: "Area", optional: true
  has_many :children, class_name: "Area", foreign_key: :parent_id, inverse_of: :parent,
    dependent: :restrict_with_error
  has_many :landmarks, dependent: :restrict_with_error
  has_many :listings, dependent: :restrict_with_error

  enum :kind, KINDS.index_with(&:itself), validate: true

  validates :slug, presence: true, uniqueness: true, format: { with: /\A[a-z0-9]+(-[a-z0-9]+)*\z/ },
    exclusion: { in: RESERVED_SLUGS, message: "is reserved" }
  validates :name, :center, presence: true

  # Areas with something to book: at least one active listing in the area itself.
  scope :bookable, -> { where(id: Listing.active.select(:area_id)) }

  # The bookable areas and every area above them: Cebu shows when Cebu City has a listing.
  scope :browsable, -> {
    where(<<~SQL.squish)
      areas.id IN (
        WITH RECURSIVE browsable(id, parent_id) AS (
          SELECT bookable.id, bookable.parent_id FROM areas bookable
          WHERE EXISTS (SELECT 1 FROM listings WHERE listings.area_id = bookable.id AND listings.status = 'active')
          UNION
          SELECT parents.id, parents.parent_id FROM areas parents JOIN browsable ON browsable.parent_id = parents.id
        )
        SELECT id FROM browsable
      )
    SQL
  }
end
