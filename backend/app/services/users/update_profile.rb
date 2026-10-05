module Users
  # The signed-in user edits their own name and phone. Keys left out stay as they are;
  # a blank or null phone clears it. Email and password changes need verification and
  # are not done here.
  class UpdateProfile < ApplicationService
    def initialize(user, params)
      @user = user
      @params = params
    end

    def call
      @user.name = @params[:name] if check_name!
      @user.phone = @params[:phone].presence if check_phone!
      @user.save!
      @user
    end

    private

    def check_name!
      return false unless @params.key?(:name)

      invalid!("Name is required") unless @params[:name].is_a?(String) && @params[:name].present?
      true
    end

    def check_phone!
      return false unless @params.key?(:phone)

      invalid!("Phone must be text") unless @params[:phone].nil? || @params[:phone].is_a?(String)
      true
    end

    def invalid!(message)
      @user.errors.add(:base, message)
      raise ActiveRecord::RecordInvalid, @user
    end
  end
end
