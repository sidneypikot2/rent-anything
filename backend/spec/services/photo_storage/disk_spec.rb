require "rails_helper"

RSpec.describe PhotoStorage::Disk do
  include ActiveSupport::Testing::TimeHelpers

  let(:root) { Pathname(Dir.mktmpdir) }

  before { allow(described_class).to receive(:root).and_return(root) }
  after { FileUtils.rm_rf(root) }

  let(:key) { "development/me/listing_photos/1/image.jpg" }

  it "stores, reads back and deletes a file by its key" do
    described_class.upload(key, StringIO.new("bytes"), content_type: "image/jpeg")
    expect(described_class.exist?(key)).to be(true)

    file = described_class.download(key)
    expect(file.read).to eq("bytes")
    file.close!

    described_class.delete([ key, "development/me/listing_photos/1/image_card.jpg" ])
    expect(described_class.exist?(key)).to be(false)
  end

  it "signs an upload URL for exactly the photo's key, type, size and MD5" do
    upload = described_class.upload_url(key, content_type: "image/jpeg", byte_size: 5, checksum: "abc")

    expect(upload[:headers]).to eq("Content-Type" => "image/jpeg", "Content-MD5" => "abc")
    token = upload[:url].split("/").last
    expect(described_class.verify(token)).to eq(
      "key" => key, "content_type" => "image/jpeg", "byte_size" => 5, "checksum" => "abc"
    )
    expect(described_class.verify("#{token}x")).to be_nil
  end

  it "refuses an upload URL once it has expired" do
    upload = described_class.upload_url(key, content_type: "image/jpeg", byte_size: 5, checksum: "abc")
    token = upload[:url].split("/").last

    travel PhotoStorage::UPLOAD_EXPIRES_IN + 1.second do
      expect(described_class.verify(token)).to be_nil
    end
  end
end
