# The refresh token as an HttpOnly cookie (RAA-306), so JavaScript, and any XSS, can't read it.
#
# Opt-in: a client that sends `X-Refresh-Cookie: 1` (the web app) gets the refresh token as the
# `raa_refresh` cookie and none in the JSON body, and refreshes and signs out with the cookie.
# Without the header nothing changes: native apps and the web app's trip-link sessions, which
# live in one tab, keep the token in the body.
#
# The cookie is host-only on the API's host, SameSite=Strict, Path=/api/v1 and Secure outside
# development and test. The web and API hosts are same-site (staging.tripkonext.com and
# api.staging.tripkonext.com; localhost:8100 and :3100), so the web app's credentialed fetches
# send it. CSRF: a cross-site request never carries the cookie (SameSite=Strict); the custom
# header forces a CORS preflight, which only FRONTEND_ORIGIN passes; and in cookie mode a request
# with an Origin other than FRONTEND_ORIGIN's gets a 403. A request with no Origin passes: browsers
# send one on every POST and DELETE, and a client that sends none has no one else's cookie.
#
# The client must never send the header from a trip link's tab-only session: the cookie is the
# browser's, so it would replace (or sign out) the browser's own session.
module RefreshCookie
  extend ActiveSupport::Concern
  include ActionController::Cookies

  COOKIE = :raa_refresh
  HEADER = "X-Refresh-Cookie".freeze
  PATH = "/api/v1".freeze

  included do
    before_action :verify_cookie_origin!, if: :refresh_cookie_mode?
  end

  private

  def refresh_cookie_mode?
    request.headers[HEADER] == "1"
  end

  def verify_cookie_origin!
    origin = request.origin
    return if origin.nil? || Rails.configuration.x.frontend_origins.include?(origin)

    raise NotAuthorizedError, "Origin not allowed"
  end

  # Renders Auth::IssueTokens' result; in cookie mode the refresh token goes into the cookie.
  def render_tokens(tokens, status: :ok)
    if refresh_cookie_mode?
      tokens = tokens.dup
      set_refresh_cookie(tokens.delete(:refresh_token))
    end
    render json: tokens, status:
  end

  # The body's token when one is sent, else in cookie mode the cookie. A body token in cookie mode
  # is a session from before the cookie (localStorage), which this refresh moves into the cookie,
  # even over a dead cookie left from an earlier session.
  def refresh_token_from_request
    return params[:refresh_token] if params.key?(:refresh_token)

    cookies[COOKIE].presence if refresh_cookie_mode?
  end

  # Only in cookie mode: a trip-link tab signing out must not end the browser's own session.
  def clear_refresh_cookie
    cookies.delete(COOKIE, path: PATH) if refresh_cookie_mode?
  end

  def set_refresh_cookie(token)
    cookies[COOKIE] = {
      value: token,
      expires: RefreshToken.find_by_token(token)&.expires_at,
      path: PATH,
      httponly: true,
      secure: !Rails.env.local?,
      same_site: :strict
    }
  end
end
