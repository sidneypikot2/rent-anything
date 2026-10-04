module Api
  module V1
    class RegistrationsController < ApplicationController
      def create
        tokens = Auth::Register.call(params.permit(:email, :name, :phone, :password), role: params[:role])
        render json: tokens, status: :created
      end
    end
  end
end
