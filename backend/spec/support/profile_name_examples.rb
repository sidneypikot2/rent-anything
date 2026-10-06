# The legal-name rule every profile shares (ProfileAddress, RAA-40): letters in any script,
# spaces, hyphens, apostrophes and periods, starting with a letter, at most 50 characters.
RSpec.shared_examples "a profile with a legal name" do |factory|
  [ "Ma. Cristina", "Dela Cruz", "O'Brien", "O’Neil", "Jean-Luc", "Sto. Niño", "José", "Peña" ].each do |name|
    it "accepts #{name.inspect}" do
      expect(build(factory, legal_first_name: name, legal_last_name: name)).to be_valid
    end
  end

  [ "J0hn", "Ana!", "a@b", "Ana_Reyes", "-Ana", " Ana", ".Ana", "Ana/Reyes", "😀" ].each do |name|
    it "refuses #{name.inspect}" do
      profile = build(factory, legal_first_name: name)

      expect(profile).not_to be_valid
      expect(profile.errors.full_messages)
        .to include("First name can only have letters, spaces, hyphens, apostrophes and periods")
    end
  end

  it "refuses a last name over 50 characters" do
    profile = build(factory, legal_last_name: "a" * 51)

    expect(profile).not_to be_valid
    expect(profile.errors.full_messages).to include("Last name is too long (maximum is 50 characters)")
  end
end
