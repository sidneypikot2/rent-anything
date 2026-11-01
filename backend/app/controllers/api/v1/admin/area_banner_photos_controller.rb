module Api
  module V1
    module Admin
      # Deprecated (RAA-210): an area's banner as RAA-164 had it, one photo, which is now the first
      # of its photos (AreaPhotosController). Kept only until the admin console moves to those,
      # RAA-211: setting one replaces the first photo, confirming and removing act on it.
      class AreaBannerPhotosController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("admin") }
        before_action :set_area

        def create
          old = @area.photos.first
          photo, upload = GalleryPhotos::Create.call(@area, params.slice(:filename, :byte_size, :checksum, :content_type))
          GalleryPhotos::Update.call(@area, photo, { position: 1 })
          GalleryPhotos::Destroy.call(@area, old) if old
          render json: { id: photo.id, upload: }, status: :created
        end

        def update
          photo = ListingPhotos::Update.call(banner_photo, params.slice(:uploaded))
          render json: AdminAreaSerializer.banner_photo(photo)
        end

        def destroy
          GalleryPhotos::Destroy.call(@area, banner_photo)
          head :no_content
        end

        private

        def set_area
          @area = Area.find_by!(slug: params[:area_slug])
        end

        def banner_photo
          @area.photos.first || raise(ActiveRecord::RecordNotFound, "No banner photo")
        end
      end
    end
  end
end
