module SearchEvents
  # Records one guest search (RAA-60): what was typed, how many results it showed, and the
  # result picked, if any. Only a place a guest can see can be picked: a published area or
  # landmark, a tag, an active listing.
  class Record < ApplicationService
    include RequestPlaces

    TARGET_TYPES = %w[area landmark tag listing].freeze
    SESSION_ID_LENGTH = 8..128
    VISIBLE = {
      "Area" => -> { Area.published }, "Landmark" => -> { Landmark.published },
      "Tag" => -> { Tag.all }, "Listing" => -> { Listing.active }
    }.freeze

    def initialize(params)
      @params = params
      @errors = []
    end

    def call
      query = term_param(@params[:q], "Query")
      result_count = result_count_param
      session_id = session_id_param
      key = place_key(@params[:target], "Target", TARGET_TYPES) unless @params[:target].nil?
      raise_if_invalid!

      SearchEvent.create!(
        query_normalized: SearchTerm.normalize(query), result_count:,
        target: key && find_target(*key), session_hash: SearchEvent.hash_session(session_id)
      )
    end

    private

    def result_count_param
      value = @params[:result_count]
      return value if value.is_a?(Integer) && value >= 0

      @errors << "Result count must be a whole number, 0 or more"
      nil
    end

    def session_id_param
      value = @params[:session_id]
      return value if value.is_a?(String) && SESSION_ID_LENGTH.cover?(value.length)

      @errors << "Session id must be #{SESSION_ID_LENGTH.min} to #{SESSION_ID_LENGTH.max} characters"
      nil
    end

    def find_target(model, lookup)
      VISIBLE.fetch(model).call.find_by(lookup) || begin
        @errors << "Target not found"
        raise_if_invalid!
      end
    end
  end
end
