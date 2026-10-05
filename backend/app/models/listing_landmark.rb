# A tour that visits a landmark, or a transfer that serves it.
class ListingLandmark < ApplicationRecord
  RELATIONS = %w[visits serves].freeze

  belongs_to :listing
  belongs_to :landmark

  enum :relation, RELATIONS.index_with(&:itself), validate: true
end
