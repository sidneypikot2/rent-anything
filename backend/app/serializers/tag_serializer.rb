# A tag as the API returns it (the `tag` schema in spec/swagger_helper.rb).
module TagSerializer
  def self.call(tag)
    { slug: tag.slug, name: tag.name, kind: tag.kind }
  end
end
