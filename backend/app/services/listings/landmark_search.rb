module Listings
  # The landmarks a partner can pick for a tour (RAA-70, trips proposal decision 6): every
  # published landmark, searched by name or alias, optionally kept to one destination and
  # ranked by distance from the listing's pin. `destinations` is every destination with a
  # published landmark, for the picker's area chips, whatever the filters.
  class LandmarkSearch < ApplicationService
    LIMIT = 50

    def initialize(params)
      @params = params
      @errors = []
    end

    def call
      point = pin
      raise_errors!

      # Every area with a published landmark, and its destination, in two queries.
      @counts = Landmark.published.group(:area_id).count
      @destinations = Trips::Destination.for_areas(@counts.keys)

      landmarks = Landmark.published.includes(:area).where(area_id: area_ids).merge(matching).limit(LIMIT)
      landmarks = point ? landmarks.order(Arel.sql(distance_from(point)), :name) : landmarks.order(:name)
      {
        landmarks: landmarks.map { |landmark| PartnerLandmarkSerializer.call(landmark, @destinations) },
        destinations: destination_counts
      }
    end

    private

    def matching
      query = @params[:q]
      return Landmark.all unless query.is_a?(String) && query.strip.present?

      pattern = "%#{Landmark.sanitize_sql_like(query.strip)}%"
      Landmark.where(<<~SQL.squish, pattern:)
        landmarks.name ILIKE :pattern OR EXISTS (
          SELECT 1 FROM unnest(landmarks.aliases || landmarks.wikidata_aliases) AS alias WHERE alias ILIKE :pattern
        )
      SQL
    end

    # The areas that have a published landmark, kept to those in the chosen destination. A
    # destination can be a draft town (Trips::Destination doesn't need its town published).
    def area_ids
      slug = @params[:area]
      return @counts.keys unless slug.is_a?(String) && slug.present?

      @counts.keys.select { |area_id| @destinations[area_id]&.slug == slug }
    end

    def destination_counts
      @counts.each_with_object(Hash.new(0)) do |(area_id, count), counts|
        destination = @destinations[area_id]
        counts[destination] += count if destination
      end
        .sort_by { |destination, _| destination.name }
        .map { |destination, count| { slug: destination.slug, name: destination.name, landmark_count: count } }
    end

    def distance_from(point)
      Landmark.sanitize_sql_array([ "ST_Distance(landmarks.location, ST_MakePoint(?, ?)::geography)", point[:lng], point[:lat] ])
    end

    # Query values arrive as strings: read them as numbers strictly, never coerce junk to 0.
    def pin
      return if @params[:lat].blank? && @params[:lng].blank?

      lat = coordinate(@params[:lat], 90, "Latitude")
      lng = coordinate(@params[:lng], 180, "Longitude")
      { lat:, lng: } if lat && lng
    end

    def coordinate(value, limit, label)
      number = value.is_a?(String) ? Float(value, exception: false) : value
      return number if number.is_a?(Numeric) && number.between?(-limit, limit)

      @errors << "#{label} must be a number between -#{limit} and #{limit}"
      nil
    end

    def raise_errors!
      return if @errors.empty?

      record = Landmark.new
      @errors.each { |message| record.errors.add(:base, message) }
      raise ActiveRecord::RecordInvalid, record
    end
  end
end
