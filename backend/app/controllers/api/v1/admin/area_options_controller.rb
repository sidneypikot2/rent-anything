module Api
  module V1
    module Admin
      # What a destination's form offers (RAA-164): the area kinds and every tag.
      class AreaOptionsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("admin") }

        def show
          render json: { kinds: Area::KINDS, tags: Tag.order(:name).map { |tag| TagSerializer.call(tag) } }
        end
      end
    end
  end
end
