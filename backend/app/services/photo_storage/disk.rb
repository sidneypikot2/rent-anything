module PhotoStorage
  # The local stack's photos on disk instead of R2, when backend/.env leaves R2_BUCKET blank
  # (PhotoStorage.disk?). Files are under backend/public/dev-photos at their usual keys, so
  # Rails serves them as static files. The browser uploads them as it would to R2: a PUT to a
  # signed URL, here Dev::PhotoUploadsController's, with the same headers. DEV_BACKEND_URL
  # (docker-compose.yml) is the backend's address as the browser sees it.
  module Disk
    module_function

    def upload_url(key, content_type:, byte_size:, checksum:)
      token = verifier.generate({ key:, content_type:, byte_size:, checksum: },
        purpose: :photo_upload, expires_in: UPLOAD_EXPIRES_IN)
      { url: "#{base_url}/dev/photo_uploads/#{token}",
        headers: { "Content-Type" => content_type, "Content-MD5" => checksum } }
    end

    # What a token from upload_url was signed for, with string keys; nil if it is forged or
    # expired.
    def verify(token)
      verifier.verified(token, purpose: :photo_upload)&.stringify_keys
    end

    def exist?(key)
      root.join(key).file?
    end

    def download(key)
      file = Tempfile.new([ "photo", File.extname(key) ], binmode: true)
      IO.copy_stream(root.join(key).to_s, file)
      file.rewind
      file
    end

    def upload(key, io, content_type:)
      path = root.join(key)
      FileUtils.mkdir_p(path.dirname)
      File.open(path, "wb") { |file| IO.copy_stream(io, file) }
    end

    def delete(keys)
      keys.each { |key| FileUtils.rm_f(root.join(key)) }
    end

    def public_url(key)
      "#{base_url}/dev-photos/#{key}"
    end

    def root
      Rails.root.join("public/dev-photos")
    end

    def base_url
      ENV.fetch("DEV_BACKEND_URL", "http://localhost:3100").chomp("/")
    end

    def verifier
      @verifier ||= ActiveSupport::MessageVerifier.new(
        Rails.application.key_generator.generate_key("photo_upload"), url_safe: true
      )
    end
  end
end
