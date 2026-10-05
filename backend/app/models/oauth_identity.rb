# A Google or Facebook account linked to a user, keyed by the provider's user id and the
# user's role: the same provider account can sign in to one guest and one partner account.
class OauthIdentity < ApplicationRecord
  PROVIDERS = %w[google facebook].freeze

  belongs_to :user

  # Kept equal to the user's by a composite foreign key to users (id, role).
  before_validation { self.role = user&.role }

  validates :provider, inclusion: { in: PROVIDERS }
  validates :uid, presence: true, uniqueness: { scope: [ :provider, :role ] }
end
