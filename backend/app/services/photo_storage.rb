# Photos in Cloudflare R2, through its S3 API (RAA-106): the only place that talks to the
# bucket. Every environment uses the same bucket; keys start with the environment's folder
# (root), so development never writes over staging's, nor one local stack over another's.
# The R2_* values are an R2 API token's keys, the bucket and its public address
# (backend/.env.example). Guests load photos from R2_PUBLIC_URL, never through this API.
# A local stack whose backend/.env leaves R2_BUCKET blank keeps its photos on disk instead
# (PhotoStorage::Disk), behind the same methods.
# Specs stub the client (spec/support).
module PhotoStorage
  UPLOAD_EXPIRES_IN = 10.minutes

  module_function

  # Where the browser PUTs a photo: a URL signed for exactly this type, size and MD5, and the
  # headers it must send with the bytes.
  def upload_url(key, content_type:, byte_size:, checksum:)
    return Disk.upload_url(key, content_type:, byte_size:, checksum:) if disk?

    url = Aws::S3::Presigner.new(client:).presigned_url(
      :put_object, bucket:, key:, expires_in: UPLOAD_EXPIRES_IN.to_i,
      content_type:, content_length: byte_size, content_md5: checksum, whitelist_headers: [ "content-length" ]
    )
    { url:, headers: { "Content-Type" => content_type, "Content-MD5" => checksum } }
  end

  def exist?(key)
    return Disk.exist?(key) if disk?

    client.head_object(bucket:, key:)
    true
  rescue Aws::S3::Errors::NotFound, Aws::S3::Errors::NoSuchKey
    false
  end

  # The object's bytes, in a binary Tempfile the caller closes.
  def download(key)
    return Disk.download(key) if disk?

    file = Tempfile.new([ "photo", File.extname(key) ], binmode: true)
    client.get_object(bucket:, key:, response_target: file)
    file.rewind
    file
  end

  def upload(key, io, content_type:)
    return Disk.upload(key, io, content_type:) if disk?

    client.put_object(bucket:, key:, body: io, content_type:)
  end

  # Copies every object under one root to another, skipping keys the destination already
  # has, so it can run again safely. Returns how many were copied and skipped. Used once when
  # staging stopped running as production (RAA-172): bin/rails photos:copy_root.
  def copy_root(from:, to:)
    raise ArgumentError, "the roots must differ" if from == to

    existing = keys_under(to).to_set
    copied = skipped = 0
    keys_under(from).each do |key|
      target = "#{to}/#{key.delete_prefix("#{from}/")}"
      if existing.include?(target)
        skipped += 1
      else
        client.copy_object(bucket:, copy_source: "#{bucket}/#{key}", key: target)
        copied += 1
      end
    end
    { copied:, skipped: }
  end

  def keys_under(root)
    client.list_objects_v2(bucket:, prefix: "#{root}/").flat_map { |page| page.contents.map(&:key) }
  end

  # Keys that aren't there are skipped: S3 reports them deleted.
  def delete(keys)
    return if keys.empty?
    return Disk.delete(keys) if disk?

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
    return Disk.public_url(key) if disk?

    "#{ENV.fetch('R2_PUBLIC_URL', '').chomp('/')}/#{key}"
  end

  # The local stack without R2 keys in backend/.env.
  def disk?
    Rails.env.development? && ENV["R2_BUCKET"].blank?
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
