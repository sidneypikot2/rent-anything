# A place a guest stays in or around: a tree from region down to a city, town or island
# (Cebu City sits under Cebu, under Central Visayas). A single point a guest visits is a
# Landmark instead. The gazetteer import (RAA-59) brings in every province, city and town
# as a draft; only published areas reach guests.
class Area < ApplicationRecord
  include SearchTermSource

  KINDS = %w[region province city town island].freeze
  STATUSES = %w[draft published].freeze
  # Top-level web paths an area slug would collide with.
  RESERVED_SLUGS = %w[partner admin search login register dashboard profile settings nearby cart trips listings].freeze

  belongs_to :parent, class_name: "Area", optional: true
  has_many :children, class_name: "Area", foreign_key: :parent_id, inverse_of: :parent,
    dependent: :restrict_with_error
  has_many :landmarks, dependent: :restrict_with_error
  has_many :listings, dependent: :restrict_with_error
  # Read both ends through DestinationLink.for; these only clean up.
  has_many :destination_links_as_source, class_name: "DestinationLink", as: :source, dependent: :delete_all
  has_many :destination_links_as_target, class_name: "DestinationLink", as: :target, dependent: :delete_all

  enum :kind, KINDS.index_with(&:itself), validate: true
  enum :status, STATUSES.index_with(&:itself), validate: true

  validates :slug, presence: true, uniqueness: true, format: { with: /\A[a-z0-9]+(-[a-z0-9]+)*\z/ },
    exclusion: { in: RESERVED_SLUGS, message: "is reserved" }
  validates :name, :center, presence: true

  # Published areas with something to book: at least one active listing in the area itself.
  scope :bookable, -> { published.where(id: Listing.active.select(:area_id)) }

  # The bookable areas and every published area above them: Cebu shows when Cebu City has
  # a listing.
  scope :browsable, -> {
    where(<<~SQL.squish)
      areas.id IN (
        WITH RECURSIVE browsable(id, parent_id) AS (
          SELECT bookable.id, bookable.parent_id FROM areas bookable
          WHERE bookable.status = 'published'
            AND EXISTS (SELECT 1 FROM listings WHERE listings.area_id = bookable.id AND listings.status = 'active')
          UNION
          SELECT parents.id, parents.parent_id FROM areas parents JOIN browsable ON browsable.parent_id = parents.id
          WHERE parents.status = 'published'
        )
        SELECT id FROM browsable
      )
    SQL
  }

  # The area and every area under it, at any depth.
  scope :subtree_of, ->(area) {
    where(<<~SQL.squish, area.id)
      areas.id IN (
        WITH RECURSIVE subtree(id) AS (
          SELECT ?::bigint
          UNION
          SELECT children.id FROM areas children JOIN subtree ON children.parent_id = subtree.id
        )
        SELECT id FROM subtree
      )
    SQL
  }

  # The area and every area above it, nearest first: Santa Fe, Bantayan Island, Cebu, ...
  def lineage
    Area.find_by_sql([ <<~SQL.squish, id ])
      WITH RECURSIVE lineage(id, parent_id, depth) AS (
        SELECT id, parent_id, 0 FROM areas WHERE id = ?
        UNION ALL
        SELECT parents.id, parents.parent_id, lineage.depth + 1 FROM areas parents JOIN lineage ON parents.id = lineage.parent_id
      )
      SELECT areas.* FROM areas JOIN lineage USING (id) ORDER BY lineage.depth
    SQL
  end

  # Guests see a published area only under published ones, so the whole lineage goes live.
  def publish!
    Area.where(id: lineage.map(&:id)).update_all(status: "published", updated_at: Time.current)
    reload
  end

  # The published island this area is, or the nearest one above it: Malapascua for
  # Malapascua, though it sits under Daanbantayan on Cebu. Explore keeps everything on an
  # island to that island.
  def island
    lineage.find { |area| area.island? && area.published? }
  end
end
