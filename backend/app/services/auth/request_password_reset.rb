module Auth
  # Emails the link to choose a new password (POST /password_reset, RAA-214) to the account of
  # that email and role (the page's, as at sign-in). Says nothing about whether it exists: the
  # endpoint answers 202 either way, and only an account with a password gets a link (one made
  # with Google or Facebook, or a guest without one, signs in another way).
  class RequestPasswordReset < Base
    def initialize(email, role)
      @email = email
      @role = role
    end

    def call
      require_string!(@email, "Email")
      check_role!(@role, User::SELF_SERVE_ROLES)
      user = User.where.not(password_digest: nil).find_by(email: @email.strip.downcase, role: @role)
      AccountMailer.password_reset(user, user.generate_token_for(:password_reset)).deliver_later if user
      nil
    end
  end
end
