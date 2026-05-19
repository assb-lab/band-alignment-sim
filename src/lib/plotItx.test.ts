import { describe, expect, it } from "vitest";
import { solveStack } from "../physics/gummel.ts";
import { preContactBands, preContactMaterialRegions } from "../physics/preContact.ts";
import { siPnStack, siSchottkyNStack } from "../presets/materials.ts";
import { postContactItx, preContactItx, secondaryPlotItx } from "./plotItx.ts";

describe("plotItx", () => {
  const result = solveStack(siPnStack(), {
    nodesPerNm: 1,
    minNodesPerLayer: 15,
    tol: 1e-4,
    maxGummelIter: 1,
    maxNewtonIter: 400,
    Vapp: 0,
  });

  it("exports post-contact bands with Ec Ev and unified EF waves", () => {
    const itx = postContactItx(result);
    expect(itx).toContain("WAVES/O band_x_nm, band_Ec_eV, band_Ev_eV, band_EF_eV");
    expect(itx).toContain("X Display band_Ec_eV vs band_x_nm");
    expect(itx).toContain("X AppendToGraph band_Ev_eV vs band_x_nm");
    expect(itx).toContain("X AppendToGraph band_EF_eV vs band_x_nm");
    expect(itx).not.toContain("Efn");
    expect(itx).not.toContain("Efp");
  });

  it("exports pre-contact bands including metal gaps as NaN", () => {
    const stack = siSchottkyNStack();
    const itx = preContactItx({
      bands: preContactBands(stack),
      regions: preContactMaterialRegions(stack),
    });
    expect(itx).toContain("precontact_Ec_eV");
    expect(itx).toContain("precontact_Ev_eV");
    expect(itx).toContain("precontact_EF_eV");
    expect(itx).toContain("NaN");
    expect(itx).toContain('X Label left "Energy vs vacuum [eV]"');
  });

  it.each(["phi", "field", "carriers", "rho"] as const)(
    "exports %s secondary plot data",
    (tab) => {
      const itx = secondaryPlotItx(result, tab);
      expect(itx).toContain(`WAVES/O ${tab}_x_nm`);
      expect(itx).toContain(`X Display`);
      expect(itx).toContain('X Label bottom "Position [nm]"');
    },
  );
});
