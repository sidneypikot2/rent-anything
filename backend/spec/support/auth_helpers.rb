# `Authorization` header value for a signed-in user in request specs.
module AuthHelpers
  def bearer_for(user)
    "Bearer #{Auth::IssueTokens.call(user)[:access_token]}"
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
