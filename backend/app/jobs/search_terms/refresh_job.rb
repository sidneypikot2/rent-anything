module SearchTerms
  # Rebuilds the search_terms view (RAA-60) without blocking searches. Queued after a name,
  # alias or status change (SearchTermSource) and nightly (config/recurring.yml), which also
  # brings popularity up to date.
  class RefreshJob < ApplicationJob
    queue_as :default

    def perform
      SearchTerm.refresh(concurrently: true)
    end
  end
end
