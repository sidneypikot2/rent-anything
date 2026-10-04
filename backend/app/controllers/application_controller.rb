class ApplicationController < ActionController::API
  # Sets ActiveStorage::Current.url_options from the request; only auto-wired for
  # ActionController::Base. Listing photo URLs need it.
  include ActiveStorage::SetCurrent

  rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
  rescue_from NotAuthenticatedError, with: :render_unauthorized
  rescue_from NotAuthorizedError, with: :render_forbidden
  rescue_from ActiveRecord::RecordInvalid, with: :render_unprocessable

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

  # An exception raised without a message carries its class name; show the generic text.
  def error_message(exception, fallback)
    exception.message == exception.class.name ? fallback : exception.message
  end
end
