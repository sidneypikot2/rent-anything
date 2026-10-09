# One guest search (RAA-60): the normalized query, how many results it showed and what was
# picked, if anything. Kept RETENTION, then deleted by SearchEvents::PruneJob. Holds no
# personal data: the visit is only a keyed hash of a random browser id.
class SearchEvent < ApplicationRecord
  RETENTION = 90.days
  TARGET_TYPES = %w[Area Landmark Tag Listing].freeze

  belongs_to :target, polymorphic: true, optional: true

  scope :recent, -> { where(created_at: RETENTION.ago..) }

  validates :query_normalized, presence: true, length: { maximum: 100 }
  validates :result_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :target_type, inclusion: { in: TARGET_TYPES }, allow_nil: true
  validates :session_hash, format: { with: /\A\h{64}\z/ }

  # The browser's visit id as stored: an HMAC under a key derived from secret_key_base, so
  # it can't be reversed or matched against ids seen elsewhere.
  def self.hash_session(session_id)
    key = Rails.application.key_generator.generate_key("search_events/session", 32)
    OpenSSL::HMAC.hexdigest("SHA256", key, session_id)
  end
end
