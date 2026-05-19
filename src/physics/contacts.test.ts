import { describe, expect, it } from "vitest";
import {
  ohmicSurfacePhi,
  resolveContacts,
  schottkyBarrierHeights,
  schottkySurfacePhi,
  semiconductorWorkFunction,
} from "./contacts.ts";
import { layerDosParams } from "./carriers.ts";
import { boltzmannElectronDensity, boltzmannHoleDensity } from "./statistics.ts";
import { KB, Q } from "./constants.ts";
import { makeLayer, siSchottkyNStack } from "../presets/materials.ts";
import { perCm3ToPerM3, nmToM } from "./units.ts";
import { OHMIC_CONTACT } from "./types.ts";
import { solveStack } from "./gummel.ts";

const nSi = makeLayer({
  label: "n-Si",
  thicknessM: nmToM(500),
  NdM3: perCm3ToPerM3(1e16),
  NaM3: 0,
});

describe("contacts", () => {
  it("computes Schottky-Mott electron barrier Φ_m − χ", () => {
    const b = schottkyBarrierHeights(nSi, 4.8);
    expect(b.phiBnEv).toBeCloseTo(4.8 - 4.05, 3);
    expect(b.isNType).toBe(true);
  });

  it("computes hole barrier (χ + Eg) − Φ_m", () => {
    const b = schottkyBarrierHeights(nSi, 4.8);
    expect(b.phiBpEv).toBeCloseTo(4.05 + 1.12 - 4.8, 3);
  });

  it("sets Schottky surface potential from barrier", () => {
    const ecRef = -4.05;
    const phiS = schottkySurfacePhi(ecRef, nSi, 4.8);
    const eF = -4.8;
    const ecSurface = ecRef - phiS;
    expect(ecSurface - eF).toBeCloseTo(4.8 - 4.05, 3);
  });

  it("resolves ohmic contacts with common Fermi level", () => {
    const pSi = makeLayer({
      label: "p-Si",
      thicknessM: nmToM(500),
      NaM3: perCm3ToPerM3(1e16),
      NdM3: 0,
    });
    const pair = resolveContacts(
      pSi,
      nSi,
      -4.05,
      -5.17,
      -4.05,
      -5.17,
      300,
      OHMIC_CONTACT,
      OHMIC_CONTACT,
      0,
    );
    expect(pair.left.kind).toBe("ohmic");
    expect(pair.left.fermiEv).toBeCloseTo(pair.right.fermiEv, 4);
    expect(pair.left.phiV).toBeCloseTo(0, 8);
    expect(Math.abs(pair.right.phiV)).toBeGreaterThan(0.1);
  });

  it("ohmic surface phi yields n ≈ Nd for n-type", () => {
    const ecRef = 4.05;
    const evRef = 2.93;
    const dos = layerDosParams(nSi, 300);
    const kT = (KB * 300) / Q;
    const eF = ecRef - kT * Math.log(dos.NcM3 / nSi.NdM3);
    const phi = ohmicSurfacePhi(nSi, ecRef, evRef, 300, eF);
    const ec = ecRef - phi;
    const n = boltzmannElectronDensity(dos.NcM3, ec, eF, kT);
    expect(n / nSi.NdM3).toBeCloseTo(1, 4);
    expect(eF).toBeLessThan(ec);
  });

  it("ohmic surface phi yields p ≈ Na with E_F above Ev for p-type", () => {
    const pSi = makeLayer({
      label: "p-Si",
      thicknessM: nmToM(500),
      NaM3: perCm3ToPerM3(1e16),
      NdM3: 0,
    });
    const ecRef = 4.05;
    const evRef = 2.93;
    const dos = layerDosParams(pSi, 300);
    const kT = (KB * 300) / Q;
    const eF = evRef + kT * Math.log(dos.NvM3 / pSi.NaM3);
    const phi = ohmicSurfacePhi(pSi, ecRef, evRef, 300, eF);
    const ev = evRef - phi;
    const p = boltzmannHoleDensity(dos.NvM3, ev, eF, kT);
    expect(p / pSi.NaM3).toBeCloseTo(1, 4);
    expect(eF).toBeGreaterThan(ev);
  });

  it("resolves Schottky on n-Si with metal Fermi at Φ_m", () => {
    const pair = resolveContacts(
      nSi,
      nSi,
      4.05,
      2.93,
      4.05,
      2.93,
      300,
      { kind: "schottky", workFunctionEv: 4.8 },
      OHMIC_CONTACT,
      0,
    );
    expect(pair.left.kind).toBe("schottky");
    expect(pair.left.fermiEv).toBeCloseTo(-4.8, 4);
    expect(pair.left.barriers?.phiBnEv).toBeCloseTo(0.75, 3);
  });

  it("uses a common equilibrium Fermi level for two Schottky metals", () => {
    const pair = resolveContacts(
      nSi,
      nSi,
      -4.05,
      -5.17,
      -4.05,
      -5.17,
      300,
      { kind: "schottky", workFunctionEv: 5.0 },
      { kind: "schottky", workFunctionEv: 2.5 },
      0,
    );
    expect(pair.left.kind).toBe("schottky");
    expect(pair.right.kind).toBe("schottky");
    expect(pair.left.fermiEv).toBeCloseTo(pair.right.fermiEv, 8);
    expect(pair.right.phiV - pair.left.phiV).toBeCloseTo(2.5, 8);
  });

  it("keeps independent metal Fermi levels in open-circuit mode", () => {
    const pair = resolveContacts(
      nSi,
      nSi,
      -4.05,
      -5.17,
      -4.05,
      -5.17,
      300,
      { kind: "schottky", workFunctionEv: 5.0 },
      { kind: "schottky", workFunctionEv: 2.5 },
      0,
      "open",
    );
    expect(pair.left.fermiEv).toBeCloseTo(-5.0, 8);
    expect(pair.right.fermiEv).toBeCloseTo(-2.5, 8);
  });

  it("sets right metal Fermi from Vapp in applied-bias mode", () => {
    const pair = resolveContacts(
      nSi,
      nSi,
      -4.05,
      -5.17,
      -4.05,
      -5.17,
      300,
      { kind: "schottky", workFunctionEv: 5.0 },
      { kind: "schottky", workFunctionEv: 2.5 },
      0.4,
      "bias",
    );
    expect(pair.left.fermiEv).toBeCloseTo(-5.0, 8);
    expect(pair.right.fermiEv).toBeCloseTo(-4.6, 8);
  });

  it("simulates n-Si Schottky diode with barrier at surface", () => {
    const stack = siSchottkyNStack();
    const result = solveStack(stack, {
      nodesPerNm: 2,
      minNodesPerLayer: 40,
      tol: 1e-4,
      maxGummelIter: 80,
      maxNewtonIter: 800,
      Vapp: 0,
    });
    expect(result.contactLeft.phiBnEv).toBeCloseTo(0.75, 2);
    const firstSemiconductor = Array.from(result.bands.ecEv).findIndex(Number.isFinite);
    expect(firstSemiconductor).toBeGreaterThanOrEqual(0);
    const ec0 = result.bands.ecEv[firstSemiconductor]!;
    const ef0 = result.bands.efnEv[firstSemiconductor]!;
    expect(ec0 - ef0).toBeCloseTo(0.75, 2);
  });

  it("keeps n-Si Schottky band bending monotonic from the surface", () => {
    const result = solveStack(siSchottkyNStack(), {
      nodesPerNm: 2,
      minNodesPerLayer: 40,
      tol: 1e-4,
      maxGummelIter: 80,
      maxNewtonIter: 800,
      Vapp: 0,
    });
    const ec = Array.from(result.bands.ecEv).filter(Number.isFinite);
    expect(ec.length).toBeGreaterThan(2);
    const surfaceEc = ec[0]!;
    expect(Math.max(...ec)).toBeCloseTo(surfaceEc, 6);
    expect(ec[ec.length - 1]!).toBeLessThan(surfaceEc);
  });

  it("reports semiconductor work function", () => {
    const phiS = semiconductorWorkFunction(nSi, 300, -4.05);
    expect(phiS).toBeGreaterThan(nSi.electronAffinityEv - 0.5);
    expect(phiS).toBeLessThan(nSi.electronAffinityEv + 0.5);
  });
});
