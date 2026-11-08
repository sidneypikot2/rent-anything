# A business's logo (RAA-281): at most one, shown square on its shop page. Adding one replaces
# the one before (BusinessLogos::Create). Stored and readied as StoredPhoto describes, at
# <root>/business_logos/<id>/image.png.
class BusinessLogo < ApplicationRecord
  include StoredPhoto

  belongs_to :business
end
