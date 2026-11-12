module Auth
  # Email + password sign-in on one entry point: guest (/login), partner (/partner/login)
  # or admin (/admin). Email is unique per role, so the entry point picks the account; one of
  # another role is simply not found. A guest with no account yet signing in (current_user,
  # RAA-175) brings their trips into the account (Guests::Absorb).
  #
  # An unknown email, or an account with no password (Google, Facebook, a guest without an
  # account), still runs bcrypt against DUMMY_DIGEST, so the answer takes as long as a wrong
  # password and its timing doesn't tell which emails have accounts (RAA-220).
  class SignIn < Base
    # Made once at load, at the cost has_secure_password uses for real digests (the minimum in test).
    DUMMY_DIGEST = BCrypt::Password.create(SecureRandom.hex(32),
      cost: ActiveModel::SecurePassword.min_cost ? BCrypt::Engine::MIN_COST : BCrypt::Engine.cost)

    def initialize(email:, password:, role:, current_user: nil)
      @email = email
      @password = password
      @role = role
      @current_user = current_user
    end

    def call
      check_role!(@role, User::ROLES)
      require_string!(@email, "Email")
      require_string!(@password, "Password")

      user = User.find_by(email: @email.strip.downcase, role: @role)
      raise NotAuthenticatedError, "Wrong email or password" unless authenticated?(user)

      Guests::Absorb.call(from: @current_user, into: user) if @current_user
      IssueTokens.call(user)
    end

    private

    def authenticated?(user)
      return user.authenticate(@password).present? if user&.password_digest.present?

      DUMMY_DIGEST.is_password?(@password) # never true; spends the same time as a real check
      false
    end
  end
end
