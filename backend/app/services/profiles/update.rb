module Profiles
  # What saving any profile shares (RAA-40): legal first and last name, phone and a full
  # address are required; the address's province is optional (Metro Manila and many
  # countries have none) and a blank one is stored as nil. The phone is saved on the user,
  # under the user's phone rule, in the same transaction as the profile. Subclasses say
  # which profile and add their own fields (Partners::UpdateProfile, Guests::UpdateProfile).
  class Update < ApplicationService
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
      attributes = ADDRESS.to_h { |key, label| [ key, required_string(address, key, label) ] }
        .merge(values.slice(:legal_first_name, :legal_last_name))
        .merge(province: optional_string(address, :province, "Province"))
        .merge(own_attributes)

      record = profile
      if @errors.any?
        @errors.each { |message| record.errors.add(:base, message) }
        raise ActiveRecord::RecordInvalid, record
      end

      record.assign_attributes(attributes)
      ActiveRecord::Base.transaction do
        @user.update!(phone: values[:phone])
        record.save!
      end
      @user
    end

    private

    # The user's profile record, existing or new.
    def profile
      raise NotImplementedError
    end

    # Fields only this kind of profile has, read with the helpers below.
    def own_attributes
      {}
    end

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
