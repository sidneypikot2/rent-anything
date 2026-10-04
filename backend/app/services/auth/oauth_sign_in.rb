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
      user = User.transaction { find_or_create_user(profile) }
      IssueTokens.call(user)
    end

    private

    def find_or_create_user(profile)
      identity = OauthIdentity.find_by(provider: @provider, uid: profile[:uid])
      if identity
        check_role_matches!(identity.user, @role)
        return identity.user
      end

      invalid!("Your #{@provider.capitalize} account didn't share an email address") if profile[:email].blank?

      user = User.find_by(email: profile[:email].downcase)
      if user
        unless profile[:email_verified]
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
