# Missing, expired or wrong credentials. ApplicationController renders it as 401.
class NotAuthenticatedError < StandardError
end
