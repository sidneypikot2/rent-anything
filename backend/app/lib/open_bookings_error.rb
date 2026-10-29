# A guest asked to delete their account while bookings are still open (requested, accepted,
# awaiting payment, confirmed or under way). Rendered as 409.
class OpenBookingsError < StandardError
  def initialize(count)
    super("You have #{count} open #{'booking'.pluralize(count)}. Cancel #{count == 1 ? 'it' : 'them'} or wait until #{count == 1 ? 'it ends' : 'they end'}, then delete your account.")
  end
end
