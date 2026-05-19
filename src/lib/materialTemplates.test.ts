import { describe, expect, it } from "vitest";
import { layerToRow } from "./layerForm.ts";
import {
  applyMaterialTemplate,
  BUILT_IN_MATERIAL_TEMPLATES,
  findDuplicateMaterialTemplate,
  isSameMaterialTemplate,
  rowToMaterialTemplate,
} from "./materialTemplates.ts";
import { siPnStack } from "../presets/materials.ts";

describe("material templates", () => {
  it("includes p/n semiconductor and metal built-ins", () => {
    const names = BUILT_IN_MATERIAL_TEMPLATES.map((item) => item.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "n-Si",
        "p-Si",
        "n-Ge",
        "p-In0.53Ga0.47As",
        "n-GaN",
        "p-4H-SiC",
        "n-ZnO",
        "p-CdTe",
        "Au",
        "Ni",
        "Pt",
        "ITO",
      ]),
    );
    expect(
      BUILT_IN_MATERIAL_TEMPLATES.find(
        (item) => item.kind === "semiconductor" && item.name === "Si",
      ),
    ).toBeUndefined();
    expect(new Set(BUILT_IN_MATERIAL_TEMPLATES.map((item) => item.id)).size).toBe(
      BUILT_IN_MATERIAL_TEMPLATES.length,
    );
  });

  it("applies built-in material constants and doping without changing geometry", () => {
    const row = layerToRow(siPnStack().layers[0]!, "p");
    const template = BUILT_IN_MATERIAL_TEMPLATES.find((item) => item.name === "n-GaAs")!;
    const next = applyMaterialTemplate(row, template);

    expect(next.id).toBe(row.id);
    expect(next.thicknessNm).toBe(row.thicknessNm);
    expect(next.dopingInputMode).toBe("direct");
    expect(next.NdCm3).toBe(2e18);
    expect(next.NaCm3).toBe(0);
    expect(next.label).toBe("n-GaAs");
    expect(next.bandGapEv).toBeCloseTo(1.42);
    expect(next.electronAffinityEv).toBeCloseTo(4.07);
  });

  it("creates user templates from a layer row", () => {
    const row = layerToRow(siPnStack().layers[0]!, "p");
    const template = rowToMaterialTemplate(row, "Saved Si");

    expect(template.id).toMatch(/^user-/);
    expect(template.source).toBe("user");
    expect(template.name).toBe("Saved Si");
    expect(template.dopingInputMode).toBe("fermi");
    expect(template.NaCm3).toBeGreaterThan(0);
    expect(template.bandGapEv).toBeCloseTo(row.bandGapEv);
  });

  it("detects duplicate material constants regardless of template name", () => {
    const row = layerToRow(siPnStack().layers[0]!, "p");
    const saved = rowToMaterialTemplate(row, "Saved Si");
    const renamed = { ...rowToMaterialTemplate(row, "My silicon"), id: "another-user-id" };

    expect(isSameMaterialTemplate(saved, renamed)).toBe(true);
    expect(findDuplicateMaterialTemplate(renamed, [saved])?.name).toBe("Saved Si");
  });

  it("keeps built-in, n-type, and p-type variants distinct", () => {
    const [pLayer, nLayer] = siPnStack().layers;
    const pTemplate = rowToMaterialTemplate(layerToRow(pLayer!, "p"), "p-Si");
    const nTemplate = rowToMaterialTemplate(layerToRow(nLayer!, "n"), "n-Si");
    const builtinSi = BUILT_IN_MATERIAL_TEMPLATES.find((item) => item.name === "p-Si")!;

    expect(isSameMaterialTemplate(pTemplate, nTemplate)).toBe(false);
    expect(findDuplicateMaterialTemplate(pTemplate, [builtinSi, nTemplate])).toBeUndefined();
  });

  it("applies metal work function to the vacuum Fermi level", () => {
    const row = layerToRow(siPnStack().layers[0]!, "p");
    const template = BUILT_IN_MATERIAL_TEMPLATES.find((item) => item.name === "Au")!;
    const next = applyMaterialTemplate(row, template);

    expect(next.kind).toBe("metal");
    expect(next.workFunctionEv).toBeCloseTo(4.8);
    expect(next.fermiLevelVacuumEv).toBeCloseTo(-4.8);
  });
});
