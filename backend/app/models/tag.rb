# What a place is good for. The kind keeps apart what a guest does (activity: snorkelling),
# what a place has (feature: white sand) and what it is about (theme: history).
# Admin-managed; listings get tags only through their category (CategoryTag).
class Tag < ApplicationRecord
  include SearchTermSource

  KINDS = %w[activity feature theme].freeze

  has_many :landmark_tags, dependent: :delete_all
  has_many :landmarks, through: :landmark_tags
  has_many :category_tags, dependent: :delete_all
  has_many :categories, through: :category_tags

  enum :kind, KINDS.index_with(&:itself), validate: true

  validates :slug, presence: true, uniqueness: true
  validates :name, presence: true
end
