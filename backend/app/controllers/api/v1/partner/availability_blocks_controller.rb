module Api
  module V1
    module Partner
      # The blocked days of one of the signed-in partner's listings (RAA-118): those ending
      # today or later, and adding, changing and removing one (Availability::SaveBlock).
      # Another partner's listing or block is a 404.
      class AvailabilityBlocksController < ApplicationController
        BLOCK_PARAMS = %i[starts_on ends_on reason].freeze

        before_action :authenticate_user!
        before_action -> { require_role!("partner") }
        before_action :set_listing
        before_action :set_block, only: %i[update destroy]

        def index
          blocks = @listing.availability_blocks.where(ends_on: Date.current..)
          render json: blocks.map { PartnerCalendarSerializer.block(_1) }
        end

        def create
          block = Availability::SaveBlock.call(@listing, params.slice(*BLOCK_PARAMS))
          render json: PartnerCalendarSerializer.block(block), status: :created
        end

        def update
          block = Availability::SaveBlock.call(@listing, params.slice(*BLOCK_PARAMS), @block)
          render json: PartnerCalendarSerializer.block(block)
        end

        def destroy
          @block.destroy!
          head :no_content
        end

        private

        def set_listing
          @listing = current_user.listings.find(params[:listing_id])
        end

        def set_block
          @block = @listing.availability_blocks.find(params[:id])
        end
      end
    end
  end
end
