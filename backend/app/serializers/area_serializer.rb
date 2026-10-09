# An area as the API returns it (the `area` schema in spec/swagger_helper.rb).
module AreaSerializer
  def self.call(area)
    { slug: area.slug, name: area.name, kind: area.kind, parent_name: area.parent&.name, parent_slug: area.parent&.slug }
  end
end
