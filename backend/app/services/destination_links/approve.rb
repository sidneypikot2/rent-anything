module DestinationLinks
  # An admin links two areas or landmarks (RAA-60), usually a pair from
  # DestinationLinks::Suggestions. The model keeps the pair in order and unique.
  class Approve < ApplicationService
    include RequestPlaces

    END_TYPES = %w[area landmark].freeze
    WEIGHTS = 1..3

    def initialize(params)
      @params = params
      @errors = []
    end

    def call
      source_key = place_key(@params[:source], "Source", END_TYPES)
      target_key = place_key(@params[:target], "Target", END_TYPES)
      kind = kind_param
      weight = weight_param
      raise_if_invalid!

      link = DestinationLink.create!(source: find(source_key), target: find(target_key), kind:, weight:)
      { source: place_json(link.source), target: place_json(link.target), kind: link.kind, weight: link.weight }
    end

    private

    def find((model, lookup))
      model.constantize.find_by!(lookup)
    end

    def kind_param
      value = @params[:kind]
      return value if DestinationLink::KINDS.include?(value)

      @errors << "Kind must be one of #{DestinationLink::KINDS.join(', ')}"
      nil
    end

    def weight_param
      value = @params[:weight]
      return WEIGHTS.min if value.nil?
      return value if value.is_a?(Integer) && WEIGHTS.cover?(value)

      @errors << "Weight must be a whole number from #{WEIGHTS.min} to #{WEIGHTS.max}"
      nil
    end
  end
end
