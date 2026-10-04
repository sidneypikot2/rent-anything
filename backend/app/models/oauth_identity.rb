# A Google or Facebook account linked to a user, keyed by the provider's user id.
class OauthIdentity < ApplicationRecord
  PROVIDERS = %w[google facebook].freeze

  belongs_to :user

  validates :provider, inclusion: { in: PROVIDERS }
  validates :uid, presence: true, uniqueness: { scope: :provider }
end
