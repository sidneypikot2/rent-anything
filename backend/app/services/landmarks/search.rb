module Landmarks
  # The admin console's landmark list: every landmark, drafts included, published first and
  # then by name. q matches part of the name, the slug or an alias, ignoring case; status
  # narrows it, and area (a slug) keeps the landmarks in that area or any area inside it.
  # Returns a relation for the controller to page.
  class Search < ApplicationService
    def initialize(params)
      @params = params
    end

    def call
      errors = []
      status = status_filter(errors)
      area = area_filter(errors)
      q = @params[:q]
      errors << "Q must be text" unless q.nil? || q.is_a?(String)
      raise_invalid!(errors) if errors.any?

      landmarks = Landmark.all
      landmarks = landmarks.where(status:) if status
      landmarks = landmarks.where(area_id: Area.subtree_of(area).select(:id)) if area
      landmarks = matching(landmarks, q.strip) if q.present?
      landmarks.order(Arel.sql("landmarks.status = 'published' DESC"), :name, :id)
    end

    private

    def status_filter(errors)
      value = @params[:status]
      return nil if value.blank?
      return value if Landmark::STATUSES.include?(value)

      errors << "Status must be one of #{Landmark::STATUSES.join(', ')}"
      nil
    end

    def area_filter(errors)
      value = @params[:area]
      return nil if value.blank?

      area = Area.find_by(slug: value) if value.is_a?(String)
      errors << "Area must be an existing area" unless area
      area
    end

    def matching(landmarks, q)
      pattern = "%#{Landmark.sanitize_sql_like(q)}%"
      landmarks.where("landmarks.name ILIKE :pattern OR landmarks.slug ILIKE :pattern OR " \
        "EXISTS (SELECT 1 FROM unnest(landmarks.aliases) AS alias WHERE alias ILIKE :pattern)", pattern:)
    end

    def raise_invalid!(errors)
      landmark = Landmark.new
      errors.each { |message| landmark.errors.add(:base, message) }
      raise ActiveRecord::RecordInvalid, landmark
    end
  end
end
