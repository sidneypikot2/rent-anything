module Areas
  # The team adds a destination or changes one in the admin console (RAA-164). A new area needs
  # a name, slug, kind and centre; on a change, every field left out is kept. Publishing
  # publishes every area above it too (Area#publish!), since guests only see an area under
  # published ones; going back to draft is refused while guests could still reach something
  # through it (an active listing in it, or a published area inside it). A new Wikidata item
  # drops the terms and popularity read from the old one until `bin/rails gazetteer:wikidata`
  # runs again. The boundary, which places listings in an area, comes only from the gazetteer.
  class Save < ApplicationService
    include RequestValues

    FIELDS = %i[name slug kind status parent_slug aliases center psgc_code tagline description getting_there
      best_time_to_visit tag_slugs wikidata_id].freeze
    TEXTS = { tagline: "Tagline", description: "Description", getting_there: "Getting there",
      best_time_to_visit: "Best time to visit" }.freeze
    MAX_ALIASES = 20
    MAX_ALIAS_LENGTH = 60

    def initialize(area, params)
      @area = area
      @params = params
      @errors = []
    end

    def call
      attributes = area_attributes
      tags = tags_from(@params[:tag_slugs]) if @params.key?(:tag_slugs)
      status = status_from(@params[:status]) if @params.key?(:status)
      raise_invalid! if @errors.any?

      Area.transaction do
        @area.assign_attributes(attributes)
        @area.status = "draft" if @area.new_record?
        @area.tags = tags if tags
        change_status(status) if status
        @area.save!
        @area.publish! if status == "published"
      end
      @area
    end

    private

    def area_attributes
      attributes = {}
      attributes[:name] = required_string(@params, :name, "Name") if new_or_given?(:name)
      attributes[:slug] = required_string(@params, :slug, "Slug") if new_or_given?(:slug)
      attributes[:kind] = required_string(@params, :kind, "Kind") if new_or_given?(:kind)
      attributes[:center] = point_from(@params[:center]) if new_or_given?(:center)
      attributes[:parent] = parent_from(@params[:parent_slug]) if @params.key?(:parent_slug)
      attributes[:aliases] = aliases_from(@params[:aliases]) if @params.key?(:aliases)
      attributes[:psgc_code] = optional_string(@params, :psgc_code, "PSGC code") if @params.key?(:psgc_code)
      TEXTS.each do |key, label|
        attributes[key] = text(key, label) if @params.key?(key)
      end
      attributes.merge!(wikidata_attributes) if @params.key?(:wikidata_id)
      attributes
    end

    def new_or_given?(key)
      @area.new_record? || @params.key?(key)
    end

    def parent_from(slug)
      return nil if slug.nil?

      parent = Area.find_by(slug:) if slug.is_a?(String)
      @errors << "Parent must be an existing area" unless parent
      parent
    end

    def aliases_from(value)
      unless value.is_a?(Array) && value.all?(String)
        @errors << "Aliases must be a list of text"
        return nil
      end

      aliases = value.map(&:strip).compact_blank.uniq
      if aliases.size > MAX_ALIASES || aliases.any? { it.length > MAX_ALIAS_LENGTH }
        @errors << "Aliases must be at most #{MAX_ALIASES}, each at most #{MAX_ALIAS_LENGTH} characters"
      end
      aliases
    end

    def text(key, label)
      value = @params[key]
      return value.strip if value.is_a?(String)

      @errors << "#{label} must be text"
      nil
    end

    # A changed item clears what was read from the old one.
    def wikidata_attributes
      id = optional_string(@params, :wikidata_id, "Wikidata")
      return { wikidata_id: id } if id == @area.wikidata_id

      { wikidata_id: id, wikidata_aliases: [], wikidata_popularity: 0 }
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

    def status_from(value)
      return value if Area::STATUSES.include?(value)

      @errors << "Status must be one of #{Area::STATUSES.join(', ')}"
      nil
    end

    # Publishing happens after the save, through Area#publish!, so the areas above go live too.
    def change_status(status)
      return unless status == "draft" && @area.persisted? && @area.status_in_database == "published"

      if Listing.active.exists?(area_id: @area.id) || @area.children.published.exists?
        @errors << "Status can't go back to draft while it has active listings or published areas inside it"
        raise_invalid!
      end
      @area.status = "draft"
    end

    def raise_invalid!
      @errors.each { |message| @area.errors.add(:base, message) }
      raise ActiveRecord::RecordInvalid, @area
    end
  end
end
