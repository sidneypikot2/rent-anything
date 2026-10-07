# Didit (didit.me), which runs partners' ID checks (RAA-44): ID document, passive liveness
# and face match on its hosted page. We create a session for a partner, send them to its
# URL, and read the outcome back, from a signed webhook or when the partner returns.
# API reference: docs.didit.me (Sessions API v3, Webhooks).
#
# DIDIT_API_KEY and DIDIT_WORKFLOW_ID come from the Didit console application (a sandbox
# application on staging); DIDIT_WEBHOOK_SECRET from its webhook destination.
module Didit
  BASE_URL = "https://verification.didit.me".freeze
  # Didit's guidance: refuse a webhook whose X-Timestamp is more than 5 minutes off.
  SIGNATURE_TOLERANCE = 300

  # Didit couldn't be reached or answered with something unusable.
  class Error < StandardError; end
  # A DIDIT_* variable isn't set.
  class NotConfiguredError < Error
    def initialize(message = "ID verification is not set up")
      super
    end
  end

  # A new session for the user, or Didit's unfinished one for the same vendor_data.
  # Returns Didit's body: "session_id", "url", "status" and more.
  def self.create_session(vendor_data:, callback:)
    request(Net::HTTP::Post, "/v3/session/",
      workflow_id: setting("DIDIT_WORKFLOW_ID"), vendor_data: vendor_data, callback: callback)
  end

  # The session's decision; its "status" is authoritative.
  def self.decision(session_id)
    request(Net::HTTP::Get, "/v3/session/#{ERB::Util.url_encode(session_id)}/decision/")
  end

  # X-Signature is the hex HMAC-SHA256 of the raw body, keyed with the webhook secret.
  def self.valid_signature?(raw_body, signature, timestamp, now: Time.current)
    secret = setting("DIDIT_WEBHOOK_SECRET")
    return false unless signature.is_a?(String) && timestamp.is_a?(String) && timestamp.match?(/\A\d+\z/)
    return false if (now.to_i - timestamp.to_i).abs > SIGNATURE_TOLERANCE

    ActiveSupport::SecurityUtils.secure_compare(OpenSSL::HMAC.hexdigest("SHA256", secret, raw_body), signature)
  end

  def self.setting(name)
    ENV[name].presence || raise(NotConfiguredError)
  end

  def self.request(request_class, path, body = nil)
    uri = URI("#{BASE_URL}#{path}")
    http_request = request_class.new(uri)
    http_request["x-api-key"] = setting("DIDIT_API_KEY")
    http_request["Accept"] = "application/json"
    if body
      http_request["Content-Type"] = "application/json"
      http_request.body = body.to_json
    end

    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 10) do |http|
      http.request(http_request)
    end
    raise Error, "Didit answered #{response.code}" unless response.is_a?(Net::HTTPSuccess)

    parsed = JSON.parse(response.body)
    parsed.is_a?(Hash) ? parsed : raise(Error, "Didit answered with something unexpected")
  rescue JSON::ParserError, SocketError, SystemCallError, IOError, Net::OpenTimeout, Net::ReadTimeout,
    Net::WriteTimeout, Net::HTTPBadResponse, OpenSSL::SSL::SSLError => e
    raise Error, "Didit request failed (#{e.class})"
  end
  private_class_method :setting, :request
end
