# A model whose names and aliases are in the search_terms view (RAA-60): queues a refresh of
# the view when a change could add, remove or rename a term. Bulk writes (update_all,
# upsert_all) skip this; the gazetteer tasks refresh at the end instead, and a nightly
# refresh catches anything else.
module SearchTermSource
  extend ActiveSupport::Concern

  SEARCHED_ATTRIBUTES = %w[name aliases status].freeze

  included do
    after_commit :queue_search_terms_refresh, if: :search_terms_changed?
  end

  private

  def search_terms_changed?
    destroyed? || previous_changes.keys.intersect?(SEARCHED_ATTRIBUTES)
  end

  def queue_search_terms_refresh
    SearchTerms::RefreshJob.perform_later
  end
end
