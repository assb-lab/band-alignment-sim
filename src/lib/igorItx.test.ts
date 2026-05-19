import { describe, expect, it } from "vitest";
import { buildIgorItx, sanitizeIgorName } from "./igorItx.ts";

describe("igorItx", () => {
  it("serializes waves and graph recreation commands", () => {
    const itx = buildIgorItx({
      waves: [
        { name: "band_x_nm", values: [0, 1] },
        { name: "band_Ec_eV", values: [-4.1, -4.2] },
        { name: "band_Ev_eV", values: [-5.2, Number.NaN] },
      ],
      graph: {
        xWave: "band_x_nm",
        yWaves: [
          { waveName: "band_Ec_eV", color: "#ef0000", lineSize: 2 },
          { waveName: "band_Ev_eV", color: "#1747ff", lineSize: 2 },
        ],
        xLabel: "Position [nm]",
        yLabel: "Energy [eV]",
      },
    });

    expect(itx.startsWith("IGOR\n")).toBe(true);
    expect(itx).toContain("WAVES/O band_x_nm, band_Ec_eV, band_Ev_eV");
    expect(itx).toContain("BEGIN");
    expect(itx).toContain("NaN");
    expect(itx).toContain("END");
    expect(itx).toContain("X Display band_Ec_eV vs band_x_nm");
    expect(itx).toContain("X AppendToGraph band_Ev_eV vs band_x_nm");
    expect(itx).toContain('X Label bottom "Position [nm]"');
  });

  it("sanitizes wave names for Igor", () => {
    expect(sanitizeIgorName("1 x [nm]")).toBe("w_1_x_nm");
    expect(sanitizeIgorName("EF [eV]")).toBe("EF_eV");
    expect(sanitizeIgorName("")).toBe("wave");
  });
});
