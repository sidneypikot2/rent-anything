module Users
  # A user's own profile edit: name and phone. Email, role and password change elsewhere.
  class UpdateProfile < ApplicationService
    def initialize(user, values)
      @user = user
      @values = values
    end

    def call
      require_strings!(@user, @values)
      @user.update!(@values)
      @user
    end
  end
end
