module Verifications
  # The partner's ID check as it stands (RAA-44), or nil if they never started one. While
  # it is pending, Didit is asked first; if Didit can't answer, the last known status is
  # returned rather than failing the page.
  #
  # On a local stack, where Didit can't be passed, SKIP_ID_CHECK=true approves the check
  # instead (RAA-91). Only in development: test and production (staging included) ignore it.
  class Current < ApplicationService
    def self.skip_id_check?
      Rails.env.development? && ENV["SKIP_ID_CHECK"] == "true"
    end

    def initialize(partner)
      @partner = partner
    end

    def call
      verification = @partner.partner_verification
      return approve(verification) if self.class.skip_id_check? && !verification&.approved?
      return verification unless verification&.pending?

      Sync.call(verification)
    rescue Didit::Error => e
      Rails.logger.warn("Didit sync failed for partner verification #{verification.id}: #{e.message}")
      verification
    end

    private

    def approve(verification)
      verification ||= @partner.build_partner_verification
      verification.update!(status: "approved", verified_at: Time.current)
      verification
    end
  end
end
