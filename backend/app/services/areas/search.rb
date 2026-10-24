module Areas
  # The admin console's destination list (RAA-164): every area, drafts included, published
  # first and then by name. q matches part of the name, the slug or an alias, ignoring case;
  # status and kind narrow it. Returns a relation for the controller to page.
  class Search < ApplicationService
    def initialize(params)
      @params = params
    end

    def call
      errors = []
      status = filter(:status, Area::STATUSES, errors)
      kind = filter(:kind, Area::KINDS, errors)
      q = @params[:q]
      errors << "Q must be text" unless q.nil? || q.is_a?(String)
      raise_invalid!(errors) if errors.any?

      areas = Area.all
      areas = areas.where(status:) if status
      areas = areas.where(kind:) if kind
      areas = matching(areas, q.strip) if q.present?
      areas.order(Arel.sql("areas.status = 'published' DESC"), :name, :id)
    end

    private

    def filter(key, allowed, errors)
      value = @params[key]
      return nil if value.blank?
      return value if allowed.include?(value)

      errors << "#{key.to_s.capitalize} must be one of #{allowed.join(', ')}"
      nil
    end

    def matching(areas, q)
      pattern = "%#{Area.sanitize_sql_like(q)}%"
      areas.where("areas.name ILIKE :pattern OR areas.slug ILIKE :pattern OR " \
        "EXISTS (SELECT 1 FROM unnest(areas.aliases) AS alias WHERE alias ILIKE :pattern)", pattern:)
    end

    def raise_invalid!(errors)
      area = Area.new
      errors.each { |message| area.errors.add(:base, message) }
      raise ActiveRecord::RecordInvalid, area
    end
  end
end
