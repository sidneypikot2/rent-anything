# PayMongo (paymongo.com), which takes guests' payments on its hosted checkout page. We create
# a checkout session for the bookings a guest pays for, send them to its URL, and read the
# outcome back, from a signed webhook or when the guest returns (Payments::Sync).
# API reference: docs.paymongo.com (Checkout Sessions, Webhooks).
#
# Test mode only: until payments go live, a secret key that isn't a test key (sk_test_...) is
# refused, and only test-mode webhook signatures (te) are accepted, so no real money moves.
# PAYMONGO_SECRET_KEY comes from the dashboard's API keys; PAYMONGO_WEBHOOK_SECRET from the
# webhook endpoint (whsk_...).
module Paymongo
  BASE_URL = "https://api.paymongo.com".freeze
  # Refuse a webhook whose timestamp is more than 5 minutes off, as with Didit.
  SIGNATURE_TOLERANCE = 300
  TEST_KEY_PREFIX = "sk_test_".freeze

  # PayMongo couldn't be reached or answered with something unusable.
  class Error < StandardError
    attr_reader :status

    def initialize(message, status: nil)
      @status = status
      super(message)
    end
  end
  # A PAYMONGO_* variable isn't set, or the key is a live one.
  class NotConfiguredError < Error
    def initialize(message = "Payments are not set up")
      super
    end
  end

  # Returns the session: "id" (cs_...) and "attributes" with "checkout_url", "status" and more.
  def self.create_checkout_session(attributes)
    request(Net::HTTP::Post, "/v1/checkout_sessions", data: { attributes: })
  end

  # The session as it is now: "attributes" "status" (active, expired) and "payments".
  def self.checkout_session(id)
    request(Net::HTTP::Get, "/v1/checkout_sessions/#{ERB::Util.url_encode(id)}")
  end

  # Ends a session so it can't be paid any more. PayMongo answers 400 when it has been paid.
  def self.expire_checkout_session(id)
    request(Net::HTTP::Post, "/v1/checkout_sessions/#{ERB::Util.url_encode(id)}/expire")
  end

  # Paymongo-Signature is "t=<unix time>,te=<test signature>,li=<live signature>": the hex
  # HMAC-SHA256 of "<t>.<raw body>", keyed with the webhook secret. Only te counts (test mode).
  def self.valid_signature?(raw_body, header, now: Time.current)
    secret = ENV["PAYMONGO_WEBHOOK_SECRET"].presence || raise(NotConfiguredError)
    return false unless header.is_a?(String)

    parts = header.split(",").to_h { [ *_1.split("=", 2), nil ].first(2) }
    timestamp, signature = parts.values_at("t", "te")
    return false unless timestamp&.match?(/\A\d+\z/) && signature.present?
    return false if (now.to_i - timestamp.to_i).abs > SIGNATURE_TOLERANCE

    ActiveSupport::SecurityUtils.secure_compare(OpenSSL::HMAC.hexdigest("SHA256", secret, "#{timestamp}.#{raw_body}"), signature)
  end

  def self.configured?
    ENV["PAYMONGO_SECRET_KEY"].present?
  end

  def self.secret_key
    key = ENV["PAYMONGO_SECRET_KEY"].presence || raise(NotConfiguredError)
    raise NotConfiguredError, "PayMongo live keys aren't allowed yet" unless key.start_with?(TEST_KEY_PREFIX)

    key
  end

  def self.request(request_class, path, body = nil)
    uri = URI("#{BASE_URL}#{path}")
    http_request = request_class.new(uri)
    http_request.basic_auth(secret_key, "")
    http_request["Accept"] = "application/json"
    if body
      http_request["Content-Type"] = "application/json"
      http_request.body = body.to_json
    end

    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 15) do |http|
      http.request(http_request)
    end
    raise Error.new("PayMongo answered #{response.code}", status: response.code.to_i) unless response.is_a?(Net::HTTPSuccess)

    data = JSON.parse(response.body)["data"]
    data.is_a?(Hash) ? data : raise(Error, "PayMongo answered with something unexpected")
  rescue JSON::ParserError, SocketError, SystemCallError, IOError, Net::OpenTimeout, Net::ReadTimeout,
    Net::WriteTimeout, Net::HTTPBadResponse, OpenSSL::SSL::SSLError => e
    raise Error, "PayMongo request failed (#{e.class})"
  end
  private_class_method :secret_key, :request
end
