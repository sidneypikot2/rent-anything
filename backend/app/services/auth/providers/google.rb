module Auth
  module Providers
    # Verifies a Google Identity Services ID token: signature, issuer, expiry and that it
    # was issued for our client id (GOOGLE_CLIENT_ID).
    class Google
      def self.verify(token)
        client_id = ENV["GOOGLE_CLIENT_ID"].presence
        raise NotAuthenticatedError, "Google sign-in is not configured" unless client_id

        payload = ::Google::Auth::IDTokens.verify_oidc(token, aud: client_id)
        {
          uid: payload["sub"],
          email: payload["email"],
          email_verified: payload["email_verified"] == true,
          name: payload["name"]
        }
      rescue ::Google::Auth::IDTokens::VerificationError, ::Google::Auth::IDTokens::KeySourceError
        raise NotAuthenticatedError, "Google sign-in failed"
      end
    end
  end
end
