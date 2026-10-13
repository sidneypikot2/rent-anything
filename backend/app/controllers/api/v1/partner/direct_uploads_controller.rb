module Api
  module V1
    module Partner
      # Starting a listing photo upload (RAA-106, ListingPhotos::DirectUpload): where the
      # browser sends the file, and the id a listing's photos take afterwards.
      class DirectUploadsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def create
          blob = ListingPhotos::DirectUpload.call(current_user, params.slice(:filename, :byte_size, :checksum, :content_type))
          render json: {
            signed_id: blob.signed_id,
            upload: { url: blob.service_url_for_direct_upload, headers: blob.service_headers_for_direct_upload }
          }, status: :created
        end
      end
    end
  end
end
