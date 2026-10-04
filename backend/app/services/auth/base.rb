module Auth
  # Shared request checks for the auth services. A missing or wrong-typed value is a 422,
  # never coerced (see .claude/rules/backend.md).
  class Base < ApplicationService
    private

    def check_role!(role, allowed)
      invalid!("Role must be one of: #{allowed.join(', ')}") unless allowed.include?(role)
    end

    def require_string!(value, name)
      invalid!("#{name} is required") unless value.is_a?(String) && value.present?
    end

    # The role comes from the entry point the client is on (/login, /partner/login,
    # /admin), so a guest can't sign in on /partner/login and vice versa.
    def check_role_matches!(user, role)
      return if user.role == role

      raise NotAuthorizedError, "This is a #{user.role} account. Sign in from the #{user.role} page."
    end

    def invalid!(message)
      record = User.new
      record.errors.add(:base, message)
      raise ActiveRecord::RecordInvalid, record
    end
  end
end
