module Bookings
  # Moves a booking to another status (RAA-132): the only place one changes. It locks the
  # booking, refuses a move the lifecycle doesn't allow (ALLOWED, after Airbnb's and
  # Booking.com's), sets the times that go with the new status and records a BookingEvent
  # saying who made it and why. Moving a booking to the status it has changes nothing.
  #
  #   Transition.call(booking, "cancelled", actor: "guest", user: guest, reason: "Plans changed")
  #
  # `attributes` are saved with the change (a cancellation's refund, a payment). Call it inside
  # the caller's transaction when the change goes with other writes.
  class Transition < ApplicationService
    ALLOWED = {
      "requested" => %w[accepted declined cancelled expired],
      # Back to requested: the guest changed it (Bookings::Change), so the partner answers again.
      "accepted" => %w[awaiting_payment cancelled expired requested],
      "awaiting_payment" => %w[confirmed cancelled expired requested],
      "confirmed" => %w[in_progress completed cancelled requested],
      "in_progress" => %w[completed],
      "completed" => [],
      "declined" => [],
      "cancelled" => [],
      "expired" => []
    }.freeze
    # How a refusal names the move.
    VERBS = {
      "requested" => "changed", "accepted" => "accepted", "awaiting_payment" => "held for payment", "confirmed" => "confirmed",
      "in_progress" => "started", "completed" => "completed", "declined" => "declined",
      "cancelled" => "cancelled", "expired" => "expired"
    }.freeze

    # Records a new booking's first status, with no status before it.
    def self.record_start(booking, actor:, user: nil, reason: nil)
      booking.events.create!(from_status: nil, to_status: booking.status, actor:, user:, reason:)
    end

    def self.allowed?(from, to)
      ALLOWED.fetch(from).include?(to)
    end

    def initialize(booking, to, actor:, user: nil, reason: nil, metadata: {}, attributes: {})
      @booking = booking
      @to = to
      @actor = actor
      @user = user
      @reason = reason
      @metadata = metadata
      @attributes = attributes
    end

    def call
      Booking.transaction do
        @booking.lock!
        from = @booking.status
        next @booking if from == @to

        refuse!(from) unless self.class.allowed?(from, @to)
        @booking.update!(status: @to, **times, **@attributes)
        @booking.events.create!(from_status: from, to_status: @to, actor: @actor, user: @user, reason: @reason,
          metadata: @metadata)
        @booking
      end
    end

    private

    def times
      now = Time.current
      case @to
      when "requested" then { responded_at: nil, confirmed_at: nil }
      when "accepted", "declined" then { responded_at: now, expires_at: nil }
      when "awaiting_payment" then { expires_at: now + Booking::PAYMENT_TTL }
      when "confirmed" then { confirmed_at: now, expires_at: nil }
      when "cancelled" then { cancelled_at: now, expires_at: nil }
      when "expired" then { expires_at: [ @booking.expires_at, now ].compact.min }
      else {}
      end
    end

    def refuse!(from)
      @booking.errors.add(:base, "A booking that is #{from.humanize(capitalize: false)} can't be #{VERBS.fetch(@to)}")
      raise ActiveRecord::RecordInvalid, @booking
    end
  end
end
