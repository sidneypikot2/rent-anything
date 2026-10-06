# How much a category helps with a tag, 1 to 3: an action camera is a 3 for snorkelling.
# Set by admins, never by partners.
class CategoryTag < ApplicationRecord
  belongs_to :category
  belongs_to :tag

  validates :weight, inclusion: { in: 1..3 }
end
