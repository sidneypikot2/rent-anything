module SearchTerms
  # An admin adds a search term to an area, landmark or tag (RAA-60), usually a query from
  # SearchTerms::Queue: it becomes one of the place's aliases, and saving queues the index
  # refresh (SearchTermSource). An alias the place already has, ignoring case and accents,
  # is not added twice.
  class Add < ApplicationService
    include RequestPlaces

    TARGET_TYPES = %w[area landmark tag].freeze

    def initialize(params)
      @params = params
      @errors = []
    end

    def call
      term = term_param(@params[:query], "Query")
      key = place_key(@params[:target], "Target", TARGET_TYPES)
      raise_if_invalid!

      model, lookup = key
      record = model.constantize.find_by!(lookup)
      record.update!(aliases: record.aliases + [ term ]) unless known?(record, term)
      place_json(record).merge(aliases: record.aliases)
    end

    private

    def known?(record, term)
      normalized = SearchTerm.normalize(term)
      [ record.name, *record.aliases ].any? { |existing| SearchTerm.normalize(existing) == normalized }
    end
  end
end
