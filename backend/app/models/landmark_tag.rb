class LandmarkTag < ApplicationRecord
  belongs_to :landmark
  belongs_to :tag
end
