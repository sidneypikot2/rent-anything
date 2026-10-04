Rails.application.routes.draw do
  # 200 when the app boots, for load balancers and uptime monitors.
  get "up" => "rails/health#show", as: :rails_health_check

  # The OpenAPI document generated from the request specs (swagger/v1/openapi.yaml).
  mount Rswag::Api::Engine => "/api-docs"

  namespace :api do
    namespace :v1 do
      resource :health, only: :show, controller: "health"

      # Auth (RAA-22)
      resources :registrations, only: :create
      resources :sessions, only: :create
      post "sessions/refresh", to: "sessions#refresh"
      delete "sessions", to: "sessions#destroy"
      resource :me, only: %i[show update], controller: "me"
    end
  end
end
