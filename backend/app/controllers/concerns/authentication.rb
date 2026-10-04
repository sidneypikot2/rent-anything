# Who is calling: the user whose access token is in `Authorization: Bearer <token>`.
# Endpoints that need a signed-in user add `before_action :authenticate_user!` (401 means
# "sign in"); a check of the user's role or ownership after it is a 403 ("not for you").
module Authentication
  extend ActiveSupport::Concern

  included do
    rescue_from Auth::InvalidCredentials, with: :render_unauthorized
  end

  private

  attr_reader :current_user

  def authenticate_user!
    payload = JsonWebToken.decode(bearer_token) if bearer_token
    @current_user = User.find_by(id: payload[:sub]) if payload
    render_unauthorized unless @current_user
  end

  def bearer_token
    request.authorization.to_s[/\ABearer (.+)\z/, 1]
  end

  def render_unauthorized(exception = nil)
    message = exception&.message || "Unauthorized"
    render json: { error: message }, status: :unauthorized
  end
end
