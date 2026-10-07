# A partner's ID check as the partner sees it (the `partner_verification` schema in
# spec/swagger_helper.rb). A partner who never started one reads as not_started.
module PartnerVerificationSerializer
  def self.call(verification)
    verification ||= PartnerVerification.new
    {
      status: verification.status,
      verified_at: verification.verified_at,
      attempts_left: verification.attempts_left,
      retry_at: verification.retry_at
    }
  end
end
