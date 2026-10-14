module Dev
  # On the local stack without R2 (PhotoStorage::Disk), the browser PUTs a photo's bytes here
  # instead of to the bucket. It does what R2 does with a signed URL: the token says where the
  # file goes, and the body must have the type, size and MD5 it was signed for. Routed only in
  # development and test, and not part of the API.
  class PhotoUploadsController < ApplicationController
    def update
      upload = PhotoStorage::Disk.verify(params[:token])
      return head :not_found unless upload

      body = request.raw_post
      unless request.media_type == upload["content_type"] && body.bytesize == upload["byte_size"] &&
          Digest::MD5.base64digest(body) == upload["checksum"]
        return head :bad_request
      end

      PhotoStorage::Disk.upload(upload["key"], StringIO.new(body), content_type: upload["content_type"])
      head :ok
    end
  end
end
