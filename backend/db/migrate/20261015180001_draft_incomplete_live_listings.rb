# Live listings must be complete (RAA-115): one made live before the rule that still lacks
# something going live needs (Listing#live_blockers) goes back to draft, for its partner to
# finish and make live again. The sample listings were completed first
# (CompleteSampleListings).
class DraftIncompleteLiveListings < ActiveRecord::Migration[8.1]
  def up
    listings = Listing.active.includes(:photos, :category, :stay_rate, :tour_detail, :visited_landmarks)
    drafted = listings.find_each.select { |listing| listing.live_blockers.any? }
    Listing.where(id: drafted.map(&:id)).update_all(status: "draft", updated_at: Time.current)
    say "#{drafted.size} incomplete live #{drafted.size == 1 ? 'listing' : 'listings'} moved back to draft"
  end

  # Which listings were live isn't kept, so they stay drafts.
  def down; end
end
