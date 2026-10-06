module Auth
  # Email + password sign-up. Admins are never self-made.
  class Register < Base
    def initialize(params, role:)
      @params = params
      @role = role
    end

    def call
      check_role!(@role, User::SELF_SERVE_ROLES)
      require_string!(@params[:email], "Email")
      require_string!(@params[:password], "Password")
      require_string!(@params[:name], "Name") unless @params[:name].nil?
      require_string!(@params[:phone], "Phone") unless @params[:phone].nil?
      user = User.new(@params.slice(:email, :name, :phone, :password).merge(role: @role))
      user.save!(context: :password_signup)
      IssueTokens.call(user)
    rescue ActiveRecord::RecordNotUnique
      invalid!("Email has already been taken")
    end
  end
end
