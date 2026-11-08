module Businesses
  # Reading a business from a request (RAA-100), shared by adding one and changing one. The
  # name is required; the model checks its length and that it is unique among the partner's
  # businesses, ignoring case. The description is optional and kept when left out. The
  # address and the map pin, which a new listing can copy, are required on a new business;
  # on a change each is kept when left out, so a business made before them (the RAA-100
  # backfill) can be given them later. The payout account (RAA-145) is optional, kept when left
  # out, and null clears it.
  module BusinessValues
    include RequestValues

    private

    def business_attributes(business)
      attributes = { name: required_string(@params, :name, "Name") }
      description = @params[:description]
      if description.is_a?(String)
        attributes[:description] = description.strip
      elsif !description.nil?
        @errors << "Description must be text"
      end
      if business.new_record? || @params.key?(:address)
        attributes.merge!(address_attributes(@params[:address]))
      end
      if business.new_record? || @params.key?(:location)
        attributes[:location] = point_from(@params[:location])
      end
      attributes[:payout_account] = payout_account_from(business, @params[:payout_account_id]) if @params.key?(:payout_account_id)
      attributes.merge(shop_attributes)
    end

    # What the shop page shows (RAA-281). Each part is kept when left out and cleared by null;
    # the model checks the values themselves (half-hour times, known languages and rules,
    # question lengths).
    def shop_attributes
      attributes = {}
      if @params.key?(:hours)
        hours = object_or_nil(@params[:hours], "Hours")
        attributes.merge!(opens_at: time_value(hours, :opens_at, "Opening time"), closes_at: time_value(hours, :closes_at, "Closing time"),
          closed_days: integer_list(hours, :closed_days, "Closed days"))
      end
      attributes[:languages] = string_list(@params, :languages, "Languages") if @params.key?(:languages)
      if @params.key?(:host)
        host = object_or_nil(@params[:host], "Host")
        attributes.merge!(host_name: optional_string(host, :name, "Host name"), host_intro: optional_string(host, :intro, "Host intro"))
      end
      if @params.key?(:stay_rules)
        rules = object_or_nil(@params[:stay_rules], "Stay rules")
        attributes.merge!(check_in_from: time_value(rules, :check_in_from, "Check-in from"),
          check_in_until: time_value(rules, :check_in_until, "Check-in until"),
          check_out_by: time_value(rules, :check_out_by, "Check-out by"),
          house_rules: string_list(rules, :house_rules, "House rules"),
          quiet_from: time_value(rules, :quiet_from, "Quiet from"),
          rules_note: optional_string(rules, :note, "Rules note"))
      end
      attributes[:faqs] = faqs_from(@params[:faqs]) if @params.key?(:faqs)
      attributes
    end

    # A part sent as an object, or null for none (read as empty).
    def object_or_nil(value, label)
      return {} if value.nil?
      return value.to_unsafe_h.with_indifferent_access if value.respond_to?(:to_unsafe_h)
      return value.with_indifferent_access if value.is_a?(Hash)

      @errors << "#{label} must be an object"
      {}
    end

    def time_value(source, key, label)
      value = source[key]
      return nil if value.nil?
      return value if value.is_a?(String)

      @errors << "#{label} must be a time like 08:30"
      nil
    end

    def string_list(source, key, label)
      value = source[key]
      return [] if value.nil?
      return value.uniq if value.is_a?(Array) && value.all?(String)

      @errors << "#{label} must be a list of text"
      []
    end

    def integer_list(source, key, label)
      value = source[key]
      return [] if value.nil?
      return value.uniq.sort if value.is_a?(Array) && value.all?(Integer)

      @errors << "#{label} must be a list of whole numbers"
      []
    end

    def faqs_from(value)
      return [] if value.nil?

      items = value.is_a?(Array) ? value.map { |item| object_or_nil(item, "Each question") } : nil
      unless items
        @errors << "Good to know must be a list of questions"
        return []
      end
      items.map do |item|
        question, answer = item.values_at(:question, :answer)
        unless question.is_a?(String) && answer.is_a?(String)
          @errors << "Each question needs a question and an answer as text"
          next {}
        end
        { "question" => question.strip, "answer" => answer.strip }
      end
    end

    # One of the partner's payout accounts (RAA-145), or null for none.
    def payout_account_from(business, id)
      return nil if id.nil?

      account = business.partner.payout_accounts.find_by(id:) if id.is_a?(Integer)
      @errors << "Payout account must be one of your payout accounts" unless account
      account
    end

    def save_business!(business)
      attributes = business_attributes(business)
      if @errors.any?
        @errors.each { |message| business.errors.add(:base, message) }
        raise ActiveRecord::RecordInvalid, business
      end

      business.update!(attributes)
      business
    end
  end
end
