# Photos in Cloudflare R2, through its S3 API (RAA-106): the only place that talks to the
# bucket. Every environment uses the same bucket; keys start with the environment's folder
# (root), so development never writes over staging's, nor one local stack over another's.
# The R2_* values are an R2 API token's keys, the bucket and its public address
# (backend/.env.example). Guests load photos from R2_PUBLIC_URL, never through this API.
# Specs stub the client (spec/support).
module PhotoStorage
  UPLOAD_EXPIRES_IN = 10.minutes

  module_function

  # Where the browser PUTs a photo: a URL signed for exactly this type, size and MD5, and the
  # headers it must send with the bytes.
  def upload_url(key, content_type:, byte_size:, checksum:)
    url = Aws::S3::Presigner.new(client:).presigned_url(
      :put_object, bucket:, key:, expires_in: UPLOAD_EXPIRES_IN.to_i,
      content_type:, content_length: byte_size, content_md5: checksum, whitelist_headers: [ "content-length" ]
    )
    { url:, headers: { "Content-Type" => content_type, "Content-MD5" => checksum } }
  end

  def exist?(key)
    client.head_object(bucket:, key:)
    true
  rescue Aws::S3::Errors::NotFound, Aws::S3::Errors::NoSuchKey
    false
  end

  # The object's bytes, in a binary Tempfile the caller closes.
  def download(key)
    file = Tempfile.new([ "photo", File.extname(key) ], binmode: true)
    client.get_object(bucket:, key:, response_target: file)
    file.rewind
    file
  end

  def upload(key, io, content_type:)
    client.put_object(bucket:, key:, body: io, content_type:)
  end

  # Keys that aren't there are skipped: S3 reports them deleted.
  def delete(keys)
    return if keys.empty?

    client.delete_objects(bucket:, delete: { objects: keys.map { |key| { key: } }, quiet: true })
  end

  # The folder every key starts with: the environment's name, and in development also the
  # local stack's (DEV_STORAGE_FOLDER, set by docker-compose.yml to the developer and the
  # Compose project). Every local database numbers its rows from 1, so without it two stacks
  # would write over, and delete, each other's files.
  def root
    return Rails.env.to_s unless Rails.env.development?

    folder = ENV["DEV_STORAGE_FOLDER"].to_s.downcase.gsub(/[^a-z0-9_-]+/, "-").delete_prefix("-").delete_suffix("-")
    "development/#{folder.presence || 'unnamed'}"
  end

  def public_url(key)
    "#{ENV.fetch('R2_PUBLIC_URL', '').chomp('/')}/#{key}"
  end

  def bucket
    ENV.fetch("R2_BUCKET", "unset")
  end

  # R2 refuses an upload carrying more than one checksum: the SDK's default CRC32 is only
  # sent when an operation requires it.
  def client
    @client ||= Aws::S3::Client.new(
      endpoint: "https://#{ENV['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
      access_key_id: ENV["R2_ACCESS_KEY_ID"],
      secret_access_key: ENV["R2_SECRET_ACCESS_KEY"],
      region: "auto",
      request_checksum_calculation: "when_required",
      response_checksum_validation: "when_required"
    )
  end
end
