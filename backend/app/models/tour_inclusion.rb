# Something a tour includes (RAA-110), at most one of each kind: accommodation, transport by
# the vehicles it uses, meals by which ones. On a private tour each is an add-on the group
# picks, at price_per_head; on a joiner tour each is bundled in the base price, at 0.
class TourInclusion < ApplicationRecord
  # The options each kind takes; accommodation takes none, only a note.
  KINDS = {
    "accommodation" => [],
    "transport" => %w[van tricycle boat motorbike car other],
    "meal" => %w[snack breakfast lunch dinner]
  }.freeze
  NOTE_LENGTH = 120

  belongs_to :listing, inverse_of: :tour_inclusions

  validates :kind, inclusion: { in: KINDS.keys }, uniqueness: { scope: :listing_id }
  validates :note, length: { maximum: NOTE_LENGTH }
  validates :price_per_head_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :options_for_kind

  private

  def options_for_kind
    allowed = KINDS[kind]
    return if allowed.nil?

    errors.add(:options, "must be one of #{allowed.join(', ')}") unless (options - allowed).empty?
    errors.add(:options, "must name at least one") if allowed.any? && options.empty?
  end
end
