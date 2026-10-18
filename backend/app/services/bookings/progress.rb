module Bookings
  # Moves confirmed bookings along by their dates (RAA-132): one starts (in_progress) on its
  # first day and completes once its last day has passed (a stay on its check-out day). Run
  # daily by Bookings::ProgressJob, on the UTC date as the calendar's dates are. The pickup and
  # return checklists (M7) will start and complete rentals instead. Returns how many it moved.
  class Progress < ApplicationService
    def initialize(today = Date.current)
      @today = today
    end

    def call
      due = Booking.where(status: %w[confirmed in_progress], starts_on: ..@today).includes(listing: :category)
      due.find_each.count do |booking|
        started = booking.confirmed? && Transition.call(booking, "in_progress", actor: "system")
        finished = booking.last_day < @today && Transition.call(booking, "completed", actor: "system")
        started || finished
      end
    end
  end
end
