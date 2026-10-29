Rails.application.routes.draw do
  # 200 when the app boots, for load balancers and uptime monitors.
  get "up" => "rails/health#show", as: :rails_health_check

  # The OpenAPI document generated from the request specs (swagger/v1/openapi.yaml).
  mount Rswag::Api::Engine => "/api-docs"

  # The local stack's stand-in for R2's signed photo uploads (PhotoStorage::Disk, RAA-106).
  put "dev/photo_uploads/:token", to: "dev/photo_uploads#update" if Rails.env.local?

  namespace :api do
    namespace :v1 do
      resource :health, only: :show, controller: "health"

      # Accounts and auth (RAA-23)
      resources :registrations, only: :create
      resource :session, only: %i[create destroy]
      post "oauth/:provider", to: "oauth#create", as: :oauth
      post "tokens/refresh", to: "tokens#refresh"
      resource :me, only: %i[show update destroy], controller: "me"
      put "me/complete_profile", to: "me/complete_profiles#update", as: :me_complete_profile
      get "me/profile", to: "me/profiles#show", as: :me_profile
      put "me/profile", to: "me/profiles#update"

      # Guests without an account (RAA-175): made on the first add, back through a trip link
      # and PIN or an emailed code, and registered with a password to keep their trips.
      resources :guest_sessions, only: :create
      post "trip_access/unlock", to: "trip_access#unlock"
      post "trip_access/rotate", to: "trip_access#rotate"
      resources :sign_in_codes, only: :create do
        post :verify, on: :collection
      end
      post "me/register", to: "me/registrations#create", as: :me_register

      # Guest discovery (RAA-33): public, no sign-in.
      get "search", to: "search#index"
      resources :areas, only: %i[index show], param: :slug
      resources :activities, only: :index
      # Map pins for the guest nearby map (RAA-52), and one listing's page (RAA-86).
      resources :listings, only: %i[index show]
      resources :landmarks, only: :index
      # What a stay at an accommodation listing costs (RAA-104).
      get "quotes", to: "quotes#show"
      # Mixes of one business's room types for a party (RAA-187).
      get "stay_mixes", to: "stay_mixes#index"
      # A business's listings, with what is free on some dates: the shop pop-up (RAA-191).
      get "businesses/:business_id/listings", to: "business_listings#index", as: :business_listings
      # What adding a listing to a trip would cost, for any kind of listing (RAA-191).
      get "listings/:listing_id/price", to: "listing_prices#show", as: :listing_price
      # One destination's listings, nearby destinations and recommendations (RAA-56).
      get "explore", to: "explore#index"
      # What guests search for and pick (RAA-60).
      resources :search_events, only: :create

      # A guest's trips, which the cart lists (RAA-64). Guest-only.
      resources :trips, only: %i[index show create update destroy] do
        get :suggestion, on: :collection
        post :merge, on: :member
        # Plan a trip again, and what its items would cost now (RAA-139).
        post :copy, on: :member
        get :quote, on: :member
        # Its view-only share link (RAA-176).
        resource :share, only: %i[show create destroy], controller: "trip_shares"
      end
      # A trip as its share link shows it to anyone (RAA-176).
      resources :shared_trips, only: :show, param: :token
      resources :trip_items, only: %i[create update destroy]
      # Booking a trip's items, and the guest's bookings (RAA-132), which a guest can change
      # (RAA-134) and pay for once accepted (RAA-143). Guest-only.
      resources :checkouts, only: :create
      resources :bookings, only: %i[index show update] do
        post :pay, on: :collection
        post :cancel, on: :member
      end
      # A payment on PayMongo's checkout, read when the guest comes back from it.
      resources :payments, only: :show

      # Admin-only (RAA-60): the search-term and destination-link queues; and every partner's
      # bookings, whose requests the team answers on partners' behalf (RAA-141).
      namespace :admin do
        resources :bookings, only: %i[index update]
        resource :search_term_queue, only: :show
        resources :search_terms, only: :create
        resources :link_suggestions, only: :index
        resources :destination_links, only: :create
        # Destinations, their details and banner photo (RAA-164).
        resources :areas, only: %i[index show create update], param: :slug do
          resource :banner_photo, only: %i[create update destroy], controller: "area_photos"
          # Make it a destination from Wikidata in the background (RAA-168).
          post :seed, on: :member
        end
        resource :area_options, only: :show
        # Landmarks, the places to see; their tags come from area_options.
        resources :landmarks, only: %i[index show create update], param: :slug
      end

      namespace :partner do
        resource :me, only: :show, controller: "me"
        resource :profile, only: %i[show update]
        # The businesses a partner runs; each listing belongs to one (RAA-100).
        resources :businesses, only: %i[index show create update]
        # Where payouts go — a bank, GCash or Maya; each business picks one (RAA-145).
        resources :payout_accounts, only: %i[index create update destroy]
        resource :payout_options, only: :show
        resources :listings, only: %i[index show create update destroy] do
          # Its photos (RAA-106); the files go straight to storage.
          resources :photos, only: %i[create update destroy], controller: "listing_photos"
          # Go live, pause, resume, delist (RAA-115).
          resource :status, only: :update, controller: "listing_statuses"
          # The partner calendar (RAA-118): a run of days' price, units on sale and minimum
          # stay, blocked days, and bookings taken offline (update cancels).
          resource :calendar_days, only: :update
          resources :availability_blocks, only: %i[index create update destroy]
          resources :bookings, only: %i[index create update]
        end
        # Every booking of the partner's listings, newest first, by status (RAA-132).
        resources :bookings, only: :index, controller: "all_bookings"
        # Every listing's days, blocks and bookings in a window (RAA-118).
        resource :calendar, only: :show, controller: "calendar"
        resource :listing_options, only: :show
        # The tour landmark picker (RAA-70).
        resources :landmarks, only: :index
        resource :verification, only: %i[show create]
      end

      # Called by third parties, signed by them (RAA-44).
      namespace :webhooks do
        post "didit", to: "didit#create"
        post "paymongo", to: "paymongo#create"
      end
    end
  end
end
