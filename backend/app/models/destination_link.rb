# Two places guests usually combine on one trip (bundled: Moalboal and Kawasan Falls) or
# that sit next door (adjacent: Bantayan Island and Malapascua). Curated, not computed:
# explore recommends the other end even across water, and a link never adds listings.
# Stored once with the lower (type, id) end as the source, and read in both directions.
class DestinationLink < ApplicationRecord
  KINDS = %w[bundled adjacent].freeze
  TYPES = %w[Area Landmark].freeze

  belongs_to :source, polymorphic: true
  belongs_to :target, polymorphic: true

  enum :kind, KINDS.index_with(&:itself), validate: true

  before_validation :put_ends_in_order
  before_save :put_ends_in_order

  validates :source_type, :target_type, inclusion: { in: TYPES }
  validates :weight, inclusion: { in: 1..3 }
  validates :target_id, uniqueness: { scope: %i[source_type source_id target_type], message: "is already linked" }
  validate :not_linked_to_itself

  # The links touching a record from either end.
  scope :for, ->(record) {
    where(source_type: record.class.name, source_id: record.id)
      .or(where(target_type: record.class.name, target_id: record.id))
  }

  # The far end of the link, seen from one of its ends.
  def other(record)
    source == record ? target : source
  end

  private

  def put_ends_in_order
    return unless source_type && target_type && source_id && target_id
    return unless ([ source_type, source_id ] <=> [ target_type, target_id ]) == 1

    self.source, self.target = target, source
  end

  def not_linked_to_itself
    errors.add(:target, "can't be the same place") if source_type == target_type && source_id == target_id
  end
end
