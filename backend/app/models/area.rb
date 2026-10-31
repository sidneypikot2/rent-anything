# A place a guest stays in or around: a tree from region down to a city, town or island
# (Cebu City sits under Cebu, under Central Visayas). A single point a guest visits is a
# Landmark instead. The gazetteer import (RAA-59) brings in every province, city and town
# as a draft; only published areas reach guests.
class Area < ApplicationRecord
  include SearchTermSource

  KINDS = %w[region province city town island].freeze
  STATUSES = %w[draft published].freeze
  # Seeding from the admin console (RAA-168, Gazetteer::SeedArea).
  SEED_STATUSES = %w[idle queued running done failed].freeze
  # Top-level web paths an area slug would collide with.
  # The areas a pin can be served by, and how far a center reaches without a boundary.
  SERVING_KINDS = %w[city town island].freeze
  SERVING_RADIUS_METERS = 50_000
  RESERVED_SLUGS = %w[partner admin search login register dashboard profile settings nearby cart trips listings about privacy terms partner-terms refunds].freeze

  belongs_to :parent, class_name: "Area", optional: true
  has_many :children, class_name: "Area", foreign_key: :parent_id, inverse_of: :parent,
    dependent: :restrict_with_error
  has_many :landmarks, dependent: :restrict_with_error
  has_many :listings, dependent: :restrict_with_error
  # Read both ends through DestinationLink.for; these only clean up.
  has_many :destination_links_as_source, class_name: "DestinationLink", as: :source, dependent: :delete_all
  has_many :destination_links_as_target, class_name: "DestinationLink", as: :target, dependent: :delete_all
  # What the team writes about it in the admin console (RAA-164): tags picked for the area
  # itself (its activities elsewhere come from its landmarks' tags) and its photos in their
  # order, the first being the banner (RAA-210). Destroyed one by one so their files go too.
  has_many :area_tags, dependent: :delete_all
  has_many :tags, through: :area_tags
  has_many :photos, -> { order(:position) }, class_name: "AreaPhoto", dependent: :destroy, inverse_of: :area
  has_many :ready_photos, -> { ready.order(:position) }, class_name: "AreaPhoto", inverse_of: false

  enum :kind, KINDS.index_with(&:itself), validate: true
  enum :status, STATUSES.index_with(&:itself), validate: true
  enum :seed_status, SEED_STATUSES.index_with(&:itself), prefix: :seed, validate: true

  validates :slug, presence: true, uniqueness: true, format: { with: /\A[a-z0-9]+(-[a-z0-9]+)*\z/ },
    exclusion: { in: RESERVED_SLUGS, message: "is reserved" }
  validates :name, :center, presence: true
  validates :name, length: { maximum: 120 }
  validates :tagline, length: { maximum: 120 }
  validates :description, length: { maximum: 5_000 }
  validates :getting_there, length: { maximum: 2_000 }
  validates :best_time_to_visit, length: { maximum: 200 }
  validates :psgc_code, format: { with: /\A\d{10}\z/, message: "must be 10 digits" }, uniqueness: true, allow_nil: true
  validates :wikidata_id, format: { with: /\AQ\d+\z/, message: "must look like Q123" }, uniqueness: true, allow_nil: true
  validate :parent_outside_subtree, if: -> { persisted? && parent_id_changed? && parent_id }

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

  # The destination guests find a pin (a WKT point) under, for a listing or a landmark: the
  # smallest published city, town or island whose boundary covers it, or, where none has a
  # boundary there yet, the one whose center is nearest. Both use the areas' GiST indexes.
  def self.serving(point)
    geography = "ST_GeogFromText(#{connection.quote("SRID=4326;#{point}")})"
    areas = published.where(kind: SERVING_KINDS)
    areas.where("ST_Covers(boundary, #{geography})").order(Arel.sql("ST_Area(boundary)")).first ||
      areas.where("ST_DWithin(center, #{geography}, #{SERVING_RADIUS_METERS})")
        .order(Arel.sql("ST_Distance(center, #{geography})")).first
  end

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

  private

  # An area can't sit under itself or under any area inside it.
  def parent_outside_subtree
    errors.add(:parent, "can't be this area or one inside it") if Area.subtree_of(self).exists?(parent_id)
  end
end
