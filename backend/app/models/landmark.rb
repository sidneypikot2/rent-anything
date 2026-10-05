# A single point a guest visits (Kawasan Falls, Magellan's Cross), inside the area that
# serves it. Content, not inventory: an admin writes it, no partner needed. Only published
# landmarks reach guests.
class Landmark < ApplicationRecord
  STATUSES = %w[draft published].freeze

  belongs_to :area
  has_many :landmark_tags, dependent: :delete_all
  has_many :tags, through: :landmark_tags
  has_many :listing_landmarks, dependent: :delete_all
  has_many :listings, through: :listing_landmarks

  enum :status, STATUSES.index_with(&:itself), validate: true

  validates :slug, presence: true, uniqueness: true
  validates :name, :location, presence: true
end
