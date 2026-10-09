Rails.application.routes.draw do
  # 200 when the app boots, for load balancers and uptime monitors.
  get "up" => "rails/health#show", as: :rails_health_check

  # The OpenAPI document generated from the request specs (swagger/v1/openapi.yaml).
  mount Rswag::Api::Engine => "/api-docs"

  namespace :api do
    namespace :v1 do
      resource :health, only: :show, controller: "health"

      # Accounts and auth (RAA-23)
      resources :registrations, only: :create
      resource :session, only: %i[create destroy]
      post "oauth/:provider", to: "oauth#create", as: :oauth
      post "tokens/refresh", to: "tokens#refresh"
      resource :me, only: %i[show update], controller: "me"
      put "me/complete_profile", to: "me/complete_profiles#update", as: :me_complete_profile
      get "me/profile", to: "me/profiles#show", as: :me_profile
      put "me/profile", to: "me/profiles#update"

      # Guest discovery (RAA-33): public, no sign-in.
      get "search", to: "search#index"
      resources :areas, only: %i[index show], param: :slug
      resources :activities, only: :index
      # Map pins for the guest nearby map (RAA-52).
      resources :listings, only: :index
      resources :landmarks, only: :index
      # One destination's listings, nearby destinations and recommendations (RAA-56).
      get "explore", to: "explore#index"
      # What guests search for and pick (RAA-60).
      resources :search_events, only: :create

      # A guest's trips, which the cart lists (RAA-64). Guest-only.
      resources :trips, only: %i[index show create update destroy] do
        get :suggestion, on: :collection
        post :merge, on: :member
      end
      resources :trip_items, only: %i[create update destroy]

      # Admin-only (RAA-60): the search-term and destination-link queues.
      namespace :admin do
        resource :search_term_queue, only: :show
        resources :search_terms, only: :create
        resources :link_suggestions, only: :index
        resources :destination_links, only: :create
      end

      namespace :partner do
        resource :me, only: :show, controller: "me"
        resource :profile, only: %i[show update]
        resources :listings, only: %i[index show create update destroy]
        resource :listing_options, only: :show
        resource :verification, only: %i[show create]
      end

      # Called by third parties, signed by them (RAA-44).
      namespace :webhooks do
        post "didit", to: "didit#create"
      end
    end
  end
end
