# The user as the API returns it (the `user` schema in spec/swagger_helper.rb).
module UserSerializer
  def self.call(user)
    user.slice(:id, :email, :name, :phone, :role)
  end
end
