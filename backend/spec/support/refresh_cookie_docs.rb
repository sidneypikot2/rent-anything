# The refresh token as an HttpOnly cookie (RAA-306, RefreshCookie): in an rswag operation that
# issues, reads or ends a session, `refresh_cookie_header` documents the opt-in header (left
# unsent, so the operation's own responses describe the body-token behaviour).
module RefreshCookieDocs
  DESCRIPTION = "`1` (the web app): the refresh token is the HttpOnly `raa_refresh` cookie (Path=/api/v1, " \
    "SameSite=Strict) instead of `refresh_token` in the body, and an Origin other than FRONTEND_ORIGIN " \
    "is a 403. Never from a trip link's tab-only session, whose token stays in the body."

  def refresh_cookie_header(description = DESCRIPTION)
    parameter name: "X-Refresh-Cookie", in: :header, required: false, schema: { type: :string, enum: %w[1] },
      description:
  end
end

RSpec.configure { |config| config.extend RefreshCookieDocs, type: :request }
