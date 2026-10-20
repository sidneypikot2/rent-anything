module Auth
  # Makes an admin (RAA-141; `bin/rails admin:grant`). Admins are never self-made, and a guest
  # or partner can't just have their role changed: their profiles, Google links and listings
  # hold composite foreign keys to users (id, role). Email is unique per role, so the admin is
  # a separate user with the same email, taking the name and password of an existing account
  # with that email, or the password given. Run again, it returns the admin, setting the
  # password given.
  class GrantAdmin < Base
    def initialize(email:, password: nil)
      @email = email
      @password = password
    end

    def call
      require_string!(@email, "EMAIL")
      email = @email.strip.downcase
      admin = User.find_by(email:, role: "admin")
      return admin.tap { set_password!(_1) } if admin

      source = User.where(email:).where.not(password_digest: nil).order(:created_at).first
      invalid!("PASSWORD is needed: no account with this email has a password") unless source || @password

      admin = User.new(email:, role: "admin", name: source&.name.presence || email)
      @password ? admin.password = @password : admin.password_digest = source.password_digest
      admin.save!
      admin
    end

    private

    def set_password!(admin)
      admin.update!(password: @password) if @password
    end
  end
end
