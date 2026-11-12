class ApplicationController < ActionController::API
  include Paginated

  rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
  rescue_from NotAuthenticatedError, with: :render_unauthorized
  rescue_from NotAuthorizedError, with: :render_forbidden
  rescue_from EmailUnconfirmedError, with: :render_email_unconfirmed
  rescue_from CodeRequiredError, with: :render_conflict
  rescue_from OpenBookingsError, with: :render_conflict
  rescue_from TripLinkLockedError, with: :render_locked
  rescue_from ActiveRecord::RecordInvalid, with: :render_unprocessable
  rescue_from Didit::Error, with: :render_bad_gateway
  rescue_from Didit::NotConfiguredError, with: :render_service_unavailable
  rescue_from Paymongo::Error, with: :render_payments_unavailable
  rescue_from Paymongo::NotConfiguredError, with: :render_service_unavailable

  # Request limits, counted per IP and per endpoint in config.cache_store (solid_cache in
  # staging and production). Over a limit, a 429 with Retry-After (render_too_many_requests).
  # Sign-in and sign-up attempts, and a guest setting a password.
  AUTH_RATE_LIMIT = { to: 10, within: 3.minutes }.freeze
  # Password sign-ins per email, from any IP: one account can't be guessed at from many.
  SIGN_IN_PER_EMAIL_LIMIT = { to: 10, within: 15.minutes }.freeze
  # Refreshing an access token: every open tab refreshes every 15 minutes.
  REFRESH_RATE_LIMIT = { to: 30, within: 1.minute }.freeze
  # Didit and PayMongo webhooks: signed, so this only keeps a flood from tying up the workers.
  WEBHOOK_RATE_LIMIT = { to: 120, within: 1.minute }.freeze
  # Public search, explore and stay quotes. The web app's search box waits 250ms after the
  # last key, so typing stays well under it.
  BROWSE_RATE_LIMIT = { to: 60, within: 1.minute }.freeze

  def self.limit_requests(limit, **options)
    rate_limit(**limit, with: -> { render_too_many_requests(retry_after: limit[:within]) }, **options)
  end

  def self.limit_auth_attempts(**options)
    limit_requests(AUTH_RATE_LIMIT, **options)
  end

  # The web app renders public pages on its server, which calls the API inside Docker
  # (API_INTERNAL_URL), so all those calls come from its one private address: limited per
  # IP, one busy minute would refuse every visitor. Browsers reach the API through Caddy,
  # which sets X-Forwarded-For to their own address (it ignores one the client sends), and
  # Rails trusts private addresses as proxies, so their remote_ip is public and limited.
  def self.limit_browsing(**options)
    limit_requests(BROWSE_RATE_LIMIT, unless: :internal_request?, **options)
  end

  private

  attr_reader :current_user

  # `before_action :authenticate_user!` on any endpoint that needs a signed-in user: reads
  # the access token from `Authorization: Bearer <token>`.
  def authenticate_user!
    raise NotAuthenticatedError unless authenticate_user
  end

  # The same, for an endpoint that also takes signed-out requests: current_user stays nil.
  def authenticate_user
    token = request.authorization.to_s[/\ABearer (.+)\z/, 1]
    payload = token && JsonWebToken.decode(token)
    @current_user = payload && User.find_by(id: payload[:sub])
    # Sentry gets the id only, never the email or name (config/initializers/sentry.rb).
    Sentry.set_user(id: @current_user.id) if @current_user
    @current_user
  end

  def require_role!(role)
    raise NotAuthorizedError unless current_user.role == role
  end

  def render_not_found
    render json: { error: "Not found" }, status: :not_found
  end

  def render_unauthorized(exception)
    render json: { error: error_message(exception, "Unauthorized") }, status: :unauthorized
  end

  def render_forbidden(exception)
    render json: { error: error_message(exception, "Forbidden") }, status: :forbidden
  end

  def render_email_unconfirmed(exception)
    render json: { error: exception.message, code: EmailUnconfirmedError::CODE }, status: :forbidden
  end

  def render_conflict(exception)
    render json: { error: exception.message }, status: :conflict
  end

  def render_locked(exception)
    render json: { error: exception.message }, status: :locked
  end

  def render_unprocessable(exception)
    render json: { errors: exception.record.errors.full_messages }, status: :unprocessable_content
  end

  # Didit failures are handled here, so Sentry would never see them; report them.
  def render_bad_gateway(exception)
    Sentry.capture_exception(exception)
    render json: { error: "ID verification is unavailable right now. Try again shortly." }, status: :bad_gateway
  end

  def render_payments_unavailable(exception)
    Sentry.capture_exception(exception)
    render json: { error: "Payments are unavailable right now. Try again shortly." }, status: :bad_gateway
  end

  def render_service_unavailable(exception)
    Sentry.capture_exception(exception)
    render json: { error: exception.message }, status: :service_unavailable
  end

  def render_too_many_requests(retry_after:)
    response.set_header("Retry-After", retry_after.to_i.to_s)
    render json: { error: "Too many attempts. Try again in a few minutes." }, status: :too_many_requests
  end

  def internal_request?
    ip = IPAddr.new(request.remote_ip)
    ip.private? || ip.loopback?
  rescue IPAddr::InvalidAddressError
    false
  end

  # An exception raised without a message carries its class name; show the generic text.
  def error_message(exception, fallback)
    exception.message == exception.class.name ? fallback : exception.message
  end
end
