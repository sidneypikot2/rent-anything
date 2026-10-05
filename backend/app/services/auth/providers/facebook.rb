module Auth
  module Providers
    # Verifies a Facebook Login user access token with the Graph API: debug_token confirms
    # it is valid and was issued to our app (FACEBOOK_APP_ID), then /me reads the profile.
    # Facebook's email is not treated as verified, so it never links to an existing account.
    class Facebook
      GRAPH_URL = "https://graph.facebook.com/v21.0".freeze

      def self.verify(token)
        app_id = ENV["FACEBOOK_APP_ID"].presence
        app_secret = ENV["FACEBOOK_APP_SECRET"].presence
        raise NotAuthenticatedError, "Facebook sign-in is not configured" unless app_id && app_secret

        debug = get("/debug_token", input_token: token, access_token: "#{app_id}|#{app_secret}")["data"]
        unless debug.is_a?(Hash) && debug["is_valid"] == true && debug["app_id"] == app_id
          raise NotAuthenticatedError, "Facebook sign-in failed"
        end

        me = get("/me", fields: "id,name,email", access_token: token,
          appsecret_proof: OpenSSL::HMAC.hexdigest("SHA256", app_secret, token))
        raise NotAuthenticatedError, "Facebook sign-in failed" unless me["id"].present? && me["id"] == debug["user_id"]

        { uid: me["id"], email: me["email"], email_verified: false, name: me["name"] }
      end

      def self.get(path, params)
        uri = URI("#{GRAPH_URL}#{path}")
        uri.query = URI.encode_www_form(params)
        response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 5) do |http|
          http.get(uri.request_uri)
        end
        body = JSON.parse(response.body)
        body.is_a?(Hash) ? body : {}
      rescue JSON::ParserError, SocketError, SystemCallError, Net::OpenTimeout, Net::ReadTimeout, OpenSSL::SSL::SSLError
        raise NotAuthenticatedError, "Facebook sign-in failed"
      end
    end
  end
end
