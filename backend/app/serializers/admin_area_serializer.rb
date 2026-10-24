# An area and its landmarks as the admin console's Areas tab shows them (the `admin_area`
# and `admin_landmark` schemas in spec/swagger_helper.rb, RAA-168).
module AdminAreaSerializer
  # The areas with their parent's name and landmark counts, in one query.
  def self.scope(areas)
    areas.left_joins(:parent).select(
      "areas.*", "parents_areas.name AS parent_name",
      "(SELECT COUNT(*) FROM landmarks WHERE landmarks.area_id = areas.id AND landmarks.status = 'published') AS landmarks_published",
      "(SELECT COUNT(*) FROM landmarks WHERE landmarks.area_id = areas.id AND landmarks.status = 'draft') AS landmarks_draft"
    )
  end

  # An area loaded through .scope.
  def self.call(area)
    {
      id: area.id, slug: area.slug, name: area.name, kind: area.kind, status: area.status, parent_name: area.parent_name,
      landmarks_published: area.landmarks_published, landmarks_draft: area.landmarks_draft, wikidata_id: area.wikidata_id,
      seed_status: area.seed_status, seeded_at: area.seeded_at, seed_report: report(area.seed_report)
    }
  end

  def self.report(report)
    { landmarks_added: report["landmarks_added"], enriched: report["enriched"], skipped: report["skipped"] || [],
      error: report["error"] }
  end

  def self.landmark(landmark)
    {
      id: landmark.id, slug: landmark.slug, name: landmark.name, status: landmark.status, wikidata_id: landmark.wikidata_id,
      lng: landmark.location.x, lat: landmark.location.y
    }
  end
end
