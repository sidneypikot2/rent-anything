module Api
  module V1
    module Admin
      # A destination's photos (RAA-210, over RAA-164's one banner): adding one (where the browser
      # sends the file), confirming its upload or moving it, and deleting it. The first is the
      # banner; the order is the area's `photos`.
      class AreaPhotosController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("admin") }
        before_action :set_area

        def create
          photo, upload = GalleryPhotos::Create.call(@area, params.slice(:filename, :byte_size, :checksum, :content_type))
          render json: { id: photo.id, upload: }, status: :created
        end

        def update
          photo = GalleryPhotos::Update.call(@area, @area.photos.find(params[:id]), params.slice(:uploaded, :position))
          render json: AdminAreaSerializer.photo(photo)
        end

        def destroy
          GalleryPhotos::Destroy.call(@area, @area.photos.find(params[:id]))
          head :no_content
        end

        private

        def set_area
          @area = Area.find_by!(slug: params[:area_slug])
        end
      end
    end
  end
end
