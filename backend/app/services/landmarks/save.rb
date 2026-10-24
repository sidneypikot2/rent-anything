module Landmarks
  # The team adds a landmark (a place to see) or changes one in the admin console. A new one
  # needs a name, slug and pin, and starts as a draft unless told otherwise; on a change,
  # every field left out is kept. The area is never sent: it is the one listings at that pin
  # would be in (Area.serving), so a moved pin can move the landmark to another destination.
  # The Wikidata columns are only written by `bin/rails gazetteer:wikidata`.
  class Save < ApplicationService
    include RequestValues

    FIELDS = %i[name slug status description aliases location tag_slugs].freeze
    MAX_ALIASES = 20
    MAX_ALIAS_LENGTH = 60

    def initialize(landmark, params)
      @landmark = landmark
      @params = params
      @errors = []
    end

    def call
      attributes = landmark_attributes
      tags = tags_from(@params[:tag_slugs]) if @params.key?(:tag_slugs)
      raise_invalid! if @errors.any?

      Landmark.transaction do
        @landmark.assign_attributes(attributes)
        @landmark.tags = tags if tags
        @landmark.save!
      end
      @landmark
    end

    private

    def landmark_attributes
      attributes = {}
      attributes[:name] = required_string(@params, :name, "Name") if new_or_given?(:name)
      attributes[:slug] = required_string(@params, :slug, "Slug") if new_or_given?(:slug)
      attributes.merge!(location_attributes) if new_or_given?(:location)
      attributes[:status] = status_from(@params[:status]) if @params.key?(:status)
      attributes[:description] = description_from(@params[:description]) if @params.key?(:description)
      attributes[:aliases] = aliases_from(@params[:aliases]) if @params.key?(:aliases)
      attributes
    end

    def new_or_given?(key)
      @landmark.new_record? || @params.key?(key)
    end

    def location_attributes
      point = point_from(@params[:location])
      return {} unless point

      area = Area.serving(point)
      @errors << "No published destination near this pin yet" unless area
      { location: point, area: }
    end

    def status_from(value)
      return value if Landmark::STATUSES.include?(value)

      @errors << "Status must be one of #{Landmark::STATUSES.join(', ')}"
      nil
    end

    def description_from(value)
      return value.strip if value.is_a?(String)

      @errors << "Description must be text"
      nil
    end

    def aliases_from(value)
      unless value.is_a?(Array) && value.all?(String)
        @errors << "Aliases must be a list of text"
        return nil
      end

      aliases = value.map(&:strip).compact_blank.uniq(&:downcase)
      if aliases.size > MAX_ALIASES || aliases.any? { it.length > MAX_ALIAS_LENGTH }
        @errors << "Aliases must be at most #{MAX_ALIASES}, each at most #{MAX_ALIAS_LENGTH} characters"
      end
      aliases
    end

    def tags_from(value)
      unless value.is_a?(Array) && value.all?(String)
        @errors << "Tags must be a list of tag slugs"
        return nil
      end

      tags = Tag.where(slug: value.uniq).order(:name).to_a
      @errors << "Tags must be existing tag slugs" unless tags.size == value.uniq.size
      tags
    end

    def raise_invalid!
      @errors.each { |message| @landmark.errors.add(:base, message) }
      raise ActiveRecord::RecordInvalid, @landmark
    end
  end
end
