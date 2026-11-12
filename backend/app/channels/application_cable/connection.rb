module ApplicationCable
  # A WebSocket connection, held by anycable-go, which asks Rails to approve it (RAA-201).
  # A client sending the API's cable_token (a sub-protocol) is identified by anycable-go
  # itself and never gets here (RAA-224). Until the web does (RAA-304), the access token comes
  # as the `token` query param; it is checked as `ApplicationController#authenticate_user`
  # checks the header, once, when the connection opens. Cable::CloseExpiredJob closes it when
  # the token expires, and signing out or deleting the account closes it
  # (UserChannel.disconnect); a message only names what changed, and the API it sends the
  # client back to checks the token again.
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      token = request.params[:token]
      payload = token.is_a?(String) && JsonWebToken.decode(token)
      self.current_user = payload && User.find_by(id: payload[:sub])
      reject_unauthorized_connection unless current_user
    end
  end
end
