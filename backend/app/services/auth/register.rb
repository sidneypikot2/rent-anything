module Auth
  # Sign-up. A sign-up from / makes a guest and one from /partner a partner; nobody can ask
  # for admin (admin accounts are made by the team).
  class Register < ApplicationService
    def initialize(values)
      @values = values
    end

    def call
      user = User.new
      require_strings!(user, @values)

      role = @values.fetch(:role, "guest")
      user.assign_attributes(@values.except(:role))
      user.role = role if User::SELF_SERVE_ROLES.include?(role)
      user.validate
      user.errors.add(:role, :inclusion) unless User::SELF_SERVE_ROLES.include?(role)
      raise ActiveRecord::RecordInvalid, user if user.errors.any?

      ActiveRecord::Base.transaction do
        user.save!
        SessionIssuer.call(user)
      end
    rescue ActiveRecord::RecordNotUnique
      # Two sign-ups with the same email at once: the unique index catches the second.
      user.errors.add(:email, :taken)
      raise ActiveRecord::RecordInvalid, user
    end
  end
end
