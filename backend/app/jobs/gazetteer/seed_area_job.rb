module Gazetteer
  # Seeds an area in the background (RAA-168): a run makes a few Wikidata queries, each of
  # which may wait out a rate limit, so the admin console polls the area instead of waiting.
  # An unexpected error still marks the run failed, so the console never shows it running.
  class SeedAreaJob < ApplicationJob
    queue_as :default

    def perform(area)
      SeedArea.call(area)
    rescue StandardError => e
      area.update_columns(seed_status: "failed", seeded_at: Time.current, seed_report: { error: e.class.name })
      raise
    end
  end
end
