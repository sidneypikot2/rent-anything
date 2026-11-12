# `Authorization` header value for a signed-in user in request specs.
module AuthHelpers
  def bearer_for(user)
    "Bearer #{Auth::IssueTokens.call(user)[:access_token]}"
  end

  # The test cache is a null store, so the counter behind `rate_limit` never counts.
  # `rate_limit` captured the controller's store at class load: stub that one.
  def exceed_auth_rate_limit(controller)
    exceed_rate_limit(controller, ApplicationController::AUTH_RATE_LIMIT)
  end

  # The same for any limit; `name:` picks one of a controller's limits ("per_email") and
  # leaves the others counting nothing.
  def exceed_rate_limit(controller, limit, name: nil)
    store = controller.cache_store
    if name
      allow(store).to receive(:increment).and_call_original
      allow(store).to receive(:increment).with(/\Arate-limit:#{controller.controller_path}:#{name}:/, any_args).and_return(limit[:to] + 1)
    else
      allow(store).to receive(:increment).and_return(limit[:to] + 1)
    end
  end

  # Requests come from 127.0.0.1, which the browsing limit leaves alone as the web app's
  # own server (ApplicationController#internal_request?); this makes them a visitor's.
  def from_public_ip
    integration_session.remote_addr = "203.0.113.7"
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
