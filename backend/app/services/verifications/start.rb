module Verifications
  # Starts a partner's ID check, or resumes the unfinished one (RAA-44), and returns the
  # URL of Didit's hosted page. Didit hands back the unfinished session for the same
  # vendor_data, so a partner who double-clicks gets one session. Refused once approved,
  # while Didit reviews a check, and for COOLDOWN after MAX_DECLINES declines, after which
  # the count starts again.
  #
  # A finished session is only replaced once its outcome is recorded, or a partner could
  # skip past a decline (and the cooldown) by starting again before the webhook arrives:
  # the stored session is synced first, and synced again if Didit hands out a new one.
  class Start < ApplicationService
    Result = Data.define(:verification, :url)

    def initialize(partner)
      @partner = partner
    end

    def call
      verification = PartnerVerification.create_or_find_by!(user: @partner)
      Sync.call(verification) if verification.pending?
      check_allowed(verification)

      session = Didit.create_session(vendor_data: @partner.id.to_s, callback: callback_url)
      session_id, url = session.values_at("session_id", "url")
      raise Didit::Error, "Didit returned no session" unless session_id.is_a?(String) && url.is_a?(String)

      Sync.call(verification) if session_id != verification.didit_session_id && verification.pending?
      verification.with_lock do
        check_allowed(verification)
        if session_id != verification.didit_session_id
          verification.declined_count = 0 if verification.declined_count >= PartnerVerification::MAX_DECLINES
          verification.status = PartnerVerification.from_didit(session["status"]) || "not_started"
          verification.didit_session_id = session_id
        end
        verification.save!
      end
      Result.new(verification:, url:)
    end

    private

    def check_allowed(verification)
      refuse(verification, "Your ID is already verified") if verification.approved?
      refuse(verification, "Your ID check is being reviewed") if verification.in_review?
      retry_at = verification.retry_at
      raise CoolingDownError, retry_at if retry_at
    end

    # Didit sends the partner back here when they finish.
    def callback_url
      "#{ENV.fetch('FRONTEND_ORIGIN', 'http://localhost:8100')}/partner/verify"
    end

    def refuse(verification, message)
      verification.errors.add(:base, message)
      raise ActiveRecord::RecordInvalid, verification
    end
  end
end
