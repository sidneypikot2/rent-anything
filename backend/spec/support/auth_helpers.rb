# `Authorization` header value for a signed-in user in request specs.
module AuthHelpers
  def bearer_for(user)
    "Bearer #{Auth::IssueTokens.call(user)[:access_token]}"
  end

  # The test cache is a null store, so the counter behind `rate_limit` never counts.
  # `rate_limit` captured the controller's store at class load: stub that one.
  def exceed_auth_rate_limit(controller)
    allow(controller.cache_store).to receive(:increment).and_return(ApplicationController::AUTH_RATE_LIMIT[:to] + 1)
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
