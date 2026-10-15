module Api
  module V1
    module Partner
      # The photos of one of the signed-in partner's listings (RAA-106): adding one (where the
      # browser sends the file), confirming its upload and deleting it. The order is the
      # listing's `photos`. Another partner's listing is a 404.
      class ListingPhotosController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }
        before_action :set_listing

        def create
          photo, upload = ListingPhotos::Create.call(@listing, params.slice(:filename, :byte_size, :checksum, :content_type))
          render json: { id: photo.id, upload: }, status: :created
        end

        def update
          photo = ListingPhotos::Update.call(@listing.photos.find(params[:id]), params.slice(:uploaded))
          render json: ListingPhotoSerializer.partner(photo)
        end

        def destroy
          ListingPhotos::Destroy.call(@listing, @listing.photos.find(params[:id]))
          head :no_content
        end

        private

        def set_listing
          @listing = current_user.listings.find(params[:listing_id])
        end
      end
    end
  end
end
