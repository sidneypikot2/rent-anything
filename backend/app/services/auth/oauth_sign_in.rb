module Auth
  # Sign in or sign up with Google or Facebook. The browser gets a token from the provider;
  # it is verified here, then matched to a user: by the linked identity, else by email when
  # the provider vouches for it (Google's email_verified), else a new user with the entry
  # point's role.
  class OauthSignIn < Base
    PROVIDERS = { "google" => Providers::Google, "facebook" => Providers::Facebook }.freeze

    def initialize(provider:, token:, role:)
      @provider = provider
      @token = token
      @role = role
    end

    def call
      verifier = PROVIDERS.fetch(@provider) { raise ActiveRecord::RecordNotFound }
      check_role!(@role, User::SELF_SERVE_ROLES)
      require_string!(@token, "Token")

      profile = verifier.verify(@token)
      user = find_or_create_with_retry(profile)
      IssueTokens.call(user)
    end

    private

    # Two first sign-ins with the same account at once (double click, two tabs) race on
    # the unique indexes; the loser retries once and finds what the winner made.
    def find_or_create_with_retry(profile)
      attempts = 0
      begin
        User.transaction { find_or_create_user(profile) }
      rescue ActiveRecord::RecordNotUnique
        attempts += 1
        retry if attempts == 1
        raise
      end
    end

    def find_or_create_user(profile)
      identity = OauthIdentity.find_by(provider: @provider, uid: profile[:uid])
      if identity
        check_role_matches!(identity.user, @role)
        return identity.user
      end

      invalid!("Your #{@provider.capitalize} account didn't share an email address") if profile[:email].blank?

      user = User.find_by(email: profile[:email].downcase)
      if user
        # Email sign-ups don't prove they own the address, so a password account is never
        # linked: whoever registered victim@gmail.com with a password would otherwise share
        # the real owner's account once they used Google.
        unless profile[:email_verified] && user.password_digest.nil?
          invalid!("An account with this email already exists. Sign in with your password.")
        end
        check_role_matches!(user, @role)
      else
        user = User.create!(email: profile[:email], name: profile[:name].presence || profile[:email], role: @role)
      end

      user.oauth_identities.create!(provider: @provider, uid: profile[:uid])
      user
    end
  end
end
