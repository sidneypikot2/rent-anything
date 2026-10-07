class ApplicationController < ActionController::API
  # Sets ActiveStorage::Current.url_options from the request; only auto-wired for
  # ActionController::Base. Listing photo URLs need it.
  include ActiveStorage::SetCurrent

  rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
  rescue_from NotAuthenticatedError, with: :render_unauthorized
  rescue_from NotAuthorizedError, with: :render_forbidden
  rescue_from ActiveRecord::RecordInvalid, with: :render_unprocessable
  rescue_from Didit::Error, with: :render_bad_gateway
  rescue_from Didit::NotConfiguredError, with: :render_service_unavailable

  # Sign-in and sign-up attempts per IP, counted per endpoint in config.cache_store.
  AUTH_RATE_LIMIT = { to: 10, within: 3.minutes }.freeze

  def self.limit_auth_attempts(**options)
    rate_limit(**AUTH_RATE_LIMIT, with: :render_too_many_requests, **options)
  end

  private

  attr_reader :current_user

  # `before_action :authenticate_user!` on any endpoint that needs a signed-in user: reads
  # the access token from `Authorization: Bearer <token>`.
  def authenticate_user!
    token = request.authorization.to_s[/\ABearer (.+)\z/, 1]
    payload = token && JsonWebToken.decode(token)
    @current_user = payload && User.find_by(id: payload[:sub])
    raise NotAuthenticatedError unless @current_user
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

  def render_unprocessable(exception)
    render json: { errors: exception.record.errors.full_messages }, status: :unprocessable_content
  end

  def render_bad_gateway
    render json: { error: "ID verification is unavailable right now. Try again shortly." }, status: :bad_gateway
  end

  def render_service_unavailable(exception)
    render json: { error: exception.message }, status: :service_unavailable
  end

  def render_too_many_requests
    render json: { error: "Too many attempts. Try again in a few minutes." }, status: :too_many_requests
  end

  # An exception raised without a message carries its class name; show the generic text.
  def error_message(exception, fallback)
    exception.message == exception.class.name ? fallback : exception.message
  end
end
