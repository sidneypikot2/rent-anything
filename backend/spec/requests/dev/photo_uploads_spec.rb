require "rails_helper"

# The local stack's stand-in for R2's signed PUT (PhotoStorage::Disk). Not part of the API.
RSpec.describe "Dev photo uploads", type: :request do
  let(:root) { Pathname(Dir.mktmpdir) }

  before { allow(PhotoStorage::Disk).to receive(:root).and_return(root) }
  after { FileUtils.rm_rf(root) }

  let(:bytes) { file_fixture("photo.jpg").binread }
  let(:key) { "development/me/listing_photos/1/image.jpg" }
  let(:upload) do
    PhotoStorage::Disk.upload_url(key, content_type: "image/jpeg", byte_size: bytes.bytesize,
      checksum: Digest::MD5.base64digest(bytes))
  end

  def put_photo(body, url: upload[:url], headers: upload[:headers])
    put URI(url).path, params: body, headers:
  end

  it "writes the file at the signed key" do
    put_photo(bytes)

    expect(response).to have_http_status(:ok)
    expect(PhotoStorage::Disk.root.join(key).binread).to eq(bytes)
  end

  it "refuses a token that doesn't verify" do
    put_photo(bytes, url: "#{upload[:url]}x")

    expect(response).to have_http_status(:not_found)
    expect(PhotoStorage::Disk.exist?(key)).to be(false)
  end

  it "refuses bytes that don't match the signed MD5 and size" do
    put_photo("#{bytes}x")

    expect(response).to have_http_status(:bad_request)
    expect(PhotoStorage::Disk.exist?(key)).to be(false)
  end

  it "refuses another content type" do
    put_photo(bytes, headers: upload[:headers].merge("Content-Type" => "image/png"))

    expect(response).to have_http_status(:bad_request)
  end
end
