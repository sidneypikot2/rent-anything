module ApplicationCable
  # A WebSocket connection, held by anycable-go (RAA-201). The client sends the API's
  # cable_token as a sub-protocol, and anycable-go identifies the user from it itself
  # (RAA-224, RAA-304), so `connect` is never called for it; with ANYCABLE_ENFORCE_JWT it
  # refuses a connection without a valid one. Anything that still reaches `connect` came
  # without an identity and is refused (the `?token=` access token is no longer taken).
  # Cable::CloseExpiredJob closes a connection when its token expires, and signing out or
  # deleting the account closes it (UserChannel.disconnect); a message only names what
  # changed, and the API it sends the client back to checks the token again.
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      reject_unauthorized_connection
    end
  end
end
