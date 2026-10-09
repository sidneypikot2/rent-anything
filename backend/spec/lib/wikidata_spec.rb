require "rails_helper"

RSpec.describe Wikidata do
  def respond_with(body, response_class: Net::HTTPOK, code: "200")
    response = response_class.new("1.1", code, "")
    allow(response).to receive(:body).and_return(body.to_json)
    allow(Net::HTTP).to receive(:start).and_return(response)
  end

  def binding_row(**values)
    values.transform_values { |value| { "value" => value } }.transform_keys(&:to_s)
  end

  describe ".entities" do
    it "groups the labels and aliases per item, with the sitelink count and the English article" do
      respond_with({ "results" => { "bindings" => [
        binding_row(item: "http://www.wikidata.org/entity/Q2", sitelinks: "20",
          article: "https://en.wikipedia.org/wiki/Moalboal%2C_Cebu", label: "Moalboal"),
        binding_row(item: "http://www.wikidata.org/entity/Q2", sitelinks: "20",
          article: "https://en.wikipedia.org/wiki/Moalboal%2C_Cebu", label: "Munisipyo sa Moalboal"),
        binding_row(item: "http://www.wikidata.org/entity/Q3", sitelinks: "0")
      ] } })

      expect(described_class.entities(%w[Q2 Q3])).to eq(
        "Q2" => { terms: [ "Moalboal", "Munisipyo sa Moalboal" ], sitelinks: 20, enwiki: "Moalboal,_Cebu" },
        "Q3" => { terms: [], sitelinks: 0, enwiki: nil }
      )
    end

    it "refuses an id that isn't an item, before calling Wikidata" do
      allow(Net::HTTP).to receive(:start)

      expect { described_class.entities([ "Q1 } DELETE" ]) }.to raise_error(ArgumentError)
      expect(Net::HTTP).not_to have_received(:start)
    end
  end

  describe ".monthly_pageviews" do
    it "averages the monthly views" do
      respond_with({ "items" => [ { "views" => 300 }, { "views" => 500 } ] })

      expect(described_class.monthly_pageviews("Moalboal")).to eq(400)
    end

    it "is 0 for an article without pageviews" do
      respond_with({ "title" => "Not found." }, response_class: Net::HTTPNotFound, code: "404")

      expect(described_class.monthly_pageviews("Nowhere")).to eq(0)
    end
  end

  it "waits as long as Retry-After says when rate-limited, then tries again" do
    limited = Net::HTTPTooManyRequests.new("1.1", "429", "")
    limited["Retry-After"] = "7"
    ok = Net::HTTPOK.new("1.1", "200", "")
    allow(ok).to receive(:body).and_return({ "results" => { "bindings" => [] } }.to_json)
    allow(Net::HTTP).to receive(:start).and_return(limited, ok)
    allow(described_class).to receive(:pause)

    expect(described_class.find_by_psgc("072233000")).to eq([])
    expect(described_class).to have_received(:pause).with(7).once
  end

  it "raises Wikidata::Error when the service stays down" do
    respond_with({}, response_class: Net::HTTPServiceUnavailable, code: "503")
    allow(described_class).to receive(:pause)

    expect { described_class.find_by_psgc("072237000") }.to raise_error(Wikidata::Error, /answered 503/)
    expect(Net::HTTP).to have_received(:start).exactly(Wikidata::ATTEMPTS).times
  end
end
