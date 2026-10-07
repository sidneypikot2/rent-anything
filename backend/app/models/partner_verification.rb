# A partner's ID check (RAA-44), done by Didit: ID document, selfie liveness and face
# match on Didit's hosted page. We store only the outcome, never the images. A partner can
# add listings once approved. After MAX_DECLINES declined checks they wait COOLDOWN from
# the last one, and then get MAX_DECLINES more tries.
class PartnerVerification < ApplicationRecord
  STATUSES = %w[not_started in_progress in_review approved declined expired].freeze
  # Still waiting on the partner or on Didit: worth asking Didit for news.
  PENDING = %w[not_started in_progress in_review].freeze
  MAX_DECLINES = 3
  COOLDOWN = 1.hour

  # Didit's session statuses (docs.didit.me, "Verification statuses"), normalised by
  # .from_didit so "In Review" and "IN_REVIEW" both match.
  DIDIT_STATUSES = {
    "notstarted" => "not_started",
    "inprogress" => "in_progress",
    "resubmitted" => "in_progress",
    "awaitinguser" => "in_progress",
    "inreview" => "in_review",
    "approved" => "approved",
    "declined" => "declined",
    "expired" => "expired",
    "abandoned" => "expired",
    "kycexpired" => "expired"
  }.freeze

  belongs_to :user

  enum :status, STATUSES.index_with(&:itself), validate: true

  validate :user_is_a_partner

  # Our status for a Didit status string, or nil for one we don't know.
  def self.from_didit(status)
    DIDIT_STATUSES[status.to_s.downcase.delete("^a-z")]
  end

  def pending?
    PENDING.include?(status)
  end

  # When a partner who has used up their tries may start again; nil when they may now.
  def retry_at
    return unless declined_count >= MAX_DECLINES && last_declined_at

    (last_declined_at + COOLDOWN).then { |time| time if time.future? }
  end

  # Tries left before the cooldown starts. Back to MAX_DECLINES once a cooldown has passed.
  def attempts_left
    return MAX_DECLINES if declined_count >= MAX_DECLINES && retry_at.nil?

    [ MAX_DECLINES - declined_count, 0 ].max
  end

  private

  def user_is_a_partner
    errors.add(:user, "must be a partner") if user && !user.partner?
  end
end
