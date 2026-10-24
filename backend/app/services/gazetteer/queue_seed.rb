module Gazetteer
  # Queues an area's seeding run (RAA-168) unless one is already queued or running. The
  # check and the claim are one UPDATE, so two clicks can't queue two runs.
  class QueueSeed < ApplicationService
    class AlreadyRunning < StandardError; end

    def initialize(area)
      @area = area
    end

    def call
      claimed = Area.where(id: @area.id).where.not(seed_status: %w[queued running]).update_all(seed_status: "queued")
      raise AlreadyRunning if claimed.zero?

      SeedAreaJob.perform_later(@area)
      @area.reload
    end
  end
end
