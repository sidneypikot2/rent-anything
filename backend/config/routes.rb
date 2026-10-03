Rails.application.routes.draw do
  # 200 when the app boots, for load balancers and uptime monitors.
  get "up" => "rails/health#show", as: :rails_health_check

  # The OpenAPI document generated from the request specs (swagger/v1/openapi.yaml).
  mount Rswag::Api::Engine => "/api-docs"

  namespace :api do
    namespace :v1 do
      resource :health, only: :show, controller: "health"
    end
  end
end
