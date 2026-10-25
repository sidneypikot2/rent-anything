# Mail to guests who book without an account (RAA-175): their trip link and PIN, sign-in
# codes, and the reminder before an unregistered guest's trip is deleted. Links go to the
# web app's pages for them (RAA-177).
class GuestMailer < ApplicationMailer
  def sign_in_code(user, code)
    @code = code
    @minutes = SignInCode::LIFETIME.in_minutes.to_i
    mail(to: user.email, subject: "Your TripKoNext code: #{code}")
  end

  def trip_link(user, trip, token:, pin:)
    @user = user
    @trip = trip
    @link = web_url("/trips/open/#{token}")
    @pin = pin
    @purge_on = trip.purge_on
    @keep_link = web_url("/trips/keep")
    mail(to: user.email, subject: "Your trip link for #{trip.name}")
  end

  def trip_deletion_reminder(trip)
    @user = trip.user
    @trip = trip
    @purge_on = trip.purge_on
    @keep_link = web_url("/trips/keep")
    mail(to: @user.email, subject: "#{trip.name} will be deleted on #{@purge_on.to_fs(:long)}")
  end

  private

  def web_url(path)
    options = default_url_options
    port = options[:port] ? ":#{options[:port]}" : ""
    "#{options.fetch(:protocol, 'http')}://#{options.fetch(:host)}#{port}#{path}"
  end
end
