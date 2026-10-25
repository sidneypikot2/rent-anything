module Auth
  # Email + password sign-up. Admins are never self-made. A guest with no account yet signing
  # up (current_user, RAA-175) brings their trips into the new account (Guests::Absorb).
  class Register < Base
    def initialize(params, role:, current_user: nil)
      @params = params
      @role = role
      @current_user = current_user
    end

    def call
      check_role!(@role, User::SELF_SERVE_ROLES)
      require_string!(@params[:email], "Email")
      require_string!(@params[:password], "Password")
      require_string!(@params[:name], "Name") unless @params[:name].nil?
      require_string!(@params[:phone], "Phone") unless @params[:phone].nil?
      user = User.new(@params.slice(:email, :name, :phone, :password).merge(role: @role))
      user.save!(context: :password_signup)
      Guests::Absorb.call(from: @current_user, into: user) if @current_user
      IssueTokens.call(user)
    rescue ActiveRecord::RecordNotUnique
      invalid!("Email has already been taken")
    end
  end
end
