# Signs and verifies the API's access tokens. Short-lived on purpose: web and the future
# mobile app renew them with a refresh token (M1).
class JsonWebToken
  ALGORITHM = "HS256"

  def self.encode(expires_in: 15.minutes, **payload)
    payload[:exp] = expires_in.from_now.to_i
    JWT.encode(payload, Rails.application.secret_key_base, ALGORITHM)
  end

  def self.decode(token)
    decoded = JWT.decode(token, Rails.application.secret_key_base, true, algorithm: ALGORITHM)
    ActiveSupport::HashWithIndifferentAccess.new(decoded.first)
  rescue JWT::DecodeError
    nil
  end
end
