module Api
  module V1
    module Admin
      # An area's banner photo (RAA-164): setting one (where the browser sends the file),
      # confirming its upload and removing it. Confirming goes through ListingPhotos::Update,
      # which only needs a StoredPhoto.
      class AreaPhotosController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("admin") }
        before_action :set_area

        def create
          photo, upload = AreaPhotos::Create.call(@area, params.slice(:filename, :byte_size, :checksum, :content_type))
          render json: { id: photo.id, upload: }, status: :created
        end

        def update
          photo = ListingPhotos::Update.call(banner_photo, params.slice(:uploaded))
          render json: AdminAreaSerializer.banner_photo(photo)
        end

        def destroy
          banner_photo.destroy!
          head :no_content
        end

        private

        def set_area
          @area = Area.find_by!(slug: params[:area_slug])
        end

        def banner_photo
          @area.banner_photo || raise(ActiveRecord::RecordNotFound, "No banner photo")
        end
      end
    end
  end
end
