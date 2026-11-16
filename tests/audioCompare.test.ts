import { describe, it, expect } from "vitest";
import { estimateAudio, type AudioOffer } from "../src/shared/audioCompare";
const offer: AudioOffer = {
  id: "test",
  name: "",
  currency: "USD",
  unit: "characters",
  billing: "usage",
  amount: 0.02,
  unitSize: 1000,
  allowance: null,
  overage: null,
};
describe("TTS and music manual comparison", () => {
  it("normalizes per-thousand and per-million character prices", () => {
    expect(estimateAudio(offer, 100000, "characters").cost).toBe(2);
    expect(
      estimateAudio(
        { ...offer, amount: 20, unitSize: 1000000 },
        100000,
        "characters",
      ).cost,
    ).toBe(2);
  });
  it("does not convert characters to minutes or songs to generations", () => {
    expect(estimateAudio(offer, 10, "minute").reason).toBe("unit");
    expect(
      estimateAudio({ ...offer, unit: "song" }, 10, "generation").reason,
    ).toBe("unit");
  });
  it("requires known overage terms when a subscription quota is exceeded", () => {
    const monthly = {
      ...offer,
      billing: "monthly" as const,
      amount: 5,
      allowance: 10000,
    };
    expect(estimateAudio(monthly, 20000, "characters").reason).toBe("quota");
    expect(
      estimateAudio({ ...monthly, overage: 0.1 }, 20000, "characters").cost,
    ).toBe(6);
  });
  it("shows annual upfront cost alongside amortized monthly cost", () => {
    const result = estimateAudio(
      { ...offer, billing: "annual", amount: 120, allowance: 100000 },
      20000,
      "characters",
    );
    expect(result.cost).toBe(10);
    expect(result.upfront).toBe(120);
  });
  it("rounds music packages up and does not charge for zero package usage", () => {
    const pack = {
      ...offer,
      billing: "package" as const,
      unit: "song" as const,
      unitSize: 1,
      amount: 5,
      allowance: 3,
    };
    expect(estimateAudio(pack, 10, "song").cost).toBe(20);
    expect(estimateAudio(pack, 0, "song").cost).toBe(0);
  });
  it("never treats missing or negative input as a free price", () => {
    expect(
      estimateAudio({ ...offer, amount: null }, 1000, "characters").reason,
    ).toBe("missing");
    expect(estimateAudio(offer, -1, "characters").reason).toBe("missing");
    expect(
      estimateAudio({ ...offer, unitSize: 0 }, 1000, "characters").reason,
    ).toBe("missing");
    expect(
      estimateAudio(
        { ...offer, billing: "free", allowance: 100 },
        101,
        "characters",
      ).reason,
    ).toBe("quota");
  });
  it("keeps different currencies in separate comparison bases", () => {
    expect(estimateAudio(offer, 1000, "characters").basis).not.toBe(
      estimateAudio({ ...offer, currency: "CNY" }, 1000, "characters").basis,
    );
  });
});
