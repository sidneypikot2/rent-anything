module Partners
  # The signed-in partner saves their profile (RAA-40): legal name, phone and business
  # address are all required. display_name and the address's province are optional (Metro
  # Manila and many countries have no province), and a blank one is stored as nil. The
  # phone is saved on the user, under the user's phone rule, in the same transaction.
  class UpdateProfile < ApplicationService
    REQUIRED = { legal_first_name: "First name", legal_last_name: "Last name", phone: "Phone" }.freeze
    ADDRESS = { street: "Street", city: "City", region: "Region", postal_code: "ZIP code", country: "Country" }.freeze

    def initialize(user, params)
      @user = user
      @params = params
      @errors = []
    end

    def call
      address = @params[:address]
      @errors << "Address must be an object" unless address.respond_to?(:key?)
      address = {} unless address.respond_to?(:key?)

      values = REQUIRED.to_h { |key, label| [ key, required_string(@params, key, label) ] }
      address_values = ADDRESS.to_h { |key, label| [ key, required_string(address, key, label) ] }
      display_name = optional_string(@params, :display_name, "Display name")
      province = optional_string(address, :province, "Province")

      profile = @user.partner_profile || @user.build_partner_profile
      if @errors.any?
        @errors.each { |message| profile.errors.add(:base, message) }
        raise ActiveRecord::RecordInvalid, profile
      end

      profile.assign_attributes(address_values.merge(values.slice(:legal_first_name, :legal_last_name),
                                                     display_name: display_name, province: province))
      ActiveRecord::Base.transaction do
        @user.update!(phone: values[:phone])
        profile.save!
      end
      @user
    end

    private

    def required_string(source, key, label)
      value = source[key]
      return value.strip if value.is_a?(String) && value.present?

      @errors << "#{label} is required"
      nil
    end

    def optional_string(source, key, label)
      value = source[key]
      return nil if value.nil?
      return value.strip.presence if value.is_a?(String)

      @errors << "#{label} must be text"
      nil
    end
  end
end
