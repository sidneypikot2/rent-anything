module Cable
  # Closes a user's open WebSocket connections when a token of theirs expires (RAA-224): a
  # token is checked only when a connection opens, by anycable-go (the cable token, RAA-304).
  # Auth::IssueTokens queues it for each token pair's expiry. anycable-go closes connections by
  # identifiers, which are only the user, so this closes all of theirs; each reconnects at once
  # and is let back in only with a token that is still valid.
  class CloseExpiredJob < ApplicationJob
    queue_as :default

    # Deleting the account already closed them (Users::DeleteAccount).
    discard_on ActiveJob::DeserializationError

    def perform(user)
      UserChannel.disconnect(user, reconnect: true)
    end
  end
end
