module Api
  module V1
    module Partner
      # A business's cover photos (RAA-281), as a destination's (Admin::AreaPhotosController):
      # adding one (where the browser sends the file), confirming its upload or moving it, and
      # deleting it. The first leads its shop page. Another partner's business is a 404.
      class BusinessPhotosController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }
        before_action :set_business

        def create
          photo, upload = GalleryPhotos::Create.call(@business, params.slice(:filename, :byte_size, :checksum, :content_type))
          render json: { id: photo.id, upload: }, status: :created
        end

        def update
          photo = GalleryPhotos::Update.call(@business, @business.photos.find(params[:id]), params.slice(:uploaded, :position))
          render json: ListingPhotoSerializer.partner(photo)
        end

        def destroy
          GalleryPhotos::Destroy.call(@business, @business.photos.find(params[:id]))
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
