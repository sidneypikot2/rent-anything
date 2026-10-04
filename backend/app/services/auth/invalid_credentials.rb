module Auth
  # Wrong email or password, or a refresh token that can't be used. Rendered as 401.
  class InvalidCredentials < StandardError; end
end
