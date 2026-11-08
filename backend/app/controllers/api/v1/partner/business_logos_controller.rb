module Api
  module V1
    module Partner
      # A business's logo (RAA-281): adding one replaces the one before, then the browser sends
      # the file and confirms it, as for a cover photo. Another partner's business is a 404.
      class BusinessLogosController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }
        before_action :set_business

        def create
          logo, upload = BusinessLogos::Create.call(@business, params.slice(:filename, :byte_size, :checksum, :content_type))
          render json: { id: logo.id, upload: }, status: :created
        end

        def update
          logo = @business.logo || raise(ActiveRecord::RecordNotFound, "This business has no logo")
          ListingPhotos::Update.call(logo, params.slice(:uploaded))
          render json: ListingPhotoSerializer.partner(logo.reload)
        end

        def destroy
          @business.logo&.destroy!
          head :no_content
        end

        private

        def set_business
          @business = current_user.businesses.find(params[:business_id])
        end
      end
    end
  end
end
