# No listing is live without a price (RAA-270): "Price to be agreed" is going away, and water
# activities now need an offer. A live listing of any kind still without a price goes back to
# draft, for its partner to price and make live again, as DraftIncompleteLiveListings did for
# the RAA-115 rules. Only the price is checked here.
class DraftUnpricedLiveListings < ActiveRecord::Migration[8.1]
  def up
    listings = Listing.active.includes({ category: :parent }, :stay_rate, :tour_detail, :vehicle_rate, :flat_rate, :offers)
    drafted = listings.find_each.select { |listing| listing.live_blockers.include?("price") }
    Listing.where(id: drafted.map(&:id)).update_all(status: "draft", updated_at: Time.current)
    say "#{drafted.size} unpriced live #{drafted.size == 1 ? 'listing' : 'listings'} moved back to draft"
  end

  # Which listings were live isn't kept, so they stay drafts.
  def down; end
end
