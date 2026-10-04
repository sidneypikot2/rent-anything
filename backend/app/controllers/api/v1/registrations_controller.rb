module Api
  module V1
    class RegistrationsController < ApplicationController
      # Per IP, counted in the cache store (a null store in test).
      rate_limit to: 10, within: 3.minutes, only: :create

      def create
        session = Auth::Register.call(request_values(:name, :email, :password, :phone, :role, scope: :user))
        render json: session, status: :created
      end
    end
  end
end
