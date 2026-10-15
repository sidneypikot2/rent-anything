module Api
  module V1
    module Partner
      # A run of days on one of the signed-in partner's listings (RAA-118): its price, units
      # on sale and minimum stay (Availability::SetDays). Answers with the listing's calendar
      # for that run. Another partner's listing is a 404.
      class CalendarDaysController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def update
          listing = current_user.listings.includes(*Availability::Calendar::ASSOCIATIONS).find(params[:listing_id])
          from, to = Availability::SetDays.call(listing, params.slice(:starts_on, :ends_on, *Availability::SetDays::KEYS))
          ledger = Availability::Ledger.new([ listing ], from, to)
          render json: PartnerCalendarSerializer.listing(listing, ledger, from, to)
        end
      end
    end
  end
end
