module Api
  module V1
    module Admin
      # A place to see's photos (RAA-210), as a destination's (AreaPhotosController): the first is
      # its card's photo; the order is the landmark's `photos`.
      class LandmarkPhotosController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("admin") }
        before_action :set_landmark

        def create
          photo, upload = GalleryPhotos::Create.call(@landmark, params.slice(:filename, :byte_size, :checksum, :content_type))
          render json: { id: photo.id, upload: }, status: :created
        end

        def update
          photo = GalleryPhotos::Update.call(@landmark, @landmark.photos.find(params[:id]), params.slice(:uploaded, :position))
          render json: AdminAreaSerializer.photo(photo)
        end

        def destroy
          GalleryPhotos::Destroy.call(@landmark, @landmark.photos.find(params[:id]))
          head :no_content
        end

        private

        def set_landmark
          @landmark = Landmark.find_by!(slug: params[:landmark_slug])
        end
      end
    end
  end
end
