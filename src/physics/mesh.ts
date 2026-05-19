import type { Layer, LayerStack, Mesh, MeshNode, SolverOptions } from "./types.ts";
import { layerNi } from "./intrinsic.ts";
import { semiconductorLayers } from "./stackContacts.ts";

export interface BandReferences {
  ecRefEv: number[];
  evRefEv: number[];
}

/** Build solver band edges on the physical vacuum-referenced energy axis. */
export function buildBandReferences(stack: LayerStack): BandReferences {
  const layers = semiconductorLayers(stack);
  const ecRefEv: number[] = [];
  const evRefEv: number[] = [];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]!;
    const ec = -layer.electronAffinityEv;
    ecRefEv.push(ec);
    evRefEv.push(ec - layer.bandGapEv);
  }
  return { ecRefEv, evRefEv };
}

function layerNodeCount(layer: Layer, options: SolverOptions): number {
  const thicknessNm = layer.thicknessM * 1e9;
  return Math.max(options.minNodesPerLayer, Math.ceil(thicknessNm * options.nodesPerNm));
}

/** Uniform mesh over semiconductor layers only (metal rows are skipped). */
export function buildMesh(stack: LayerStack, options: SolverOptions): Mesh {
  const layers = semiconductorLayers(stack);
  const { ecRefEv, evRefEv } = buildBandReferences(stack);
  const nodes: MeshNode[] = [];
  const dxM: number[] = [];
  let x = 0;

  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li]!;
    const nSeg = layerNodeCount(layer, options);
    const dx = layer.thicknessM / nSeg;
    const ni = layerNi(layer, stack.temperatureK);
    const NcM3 = layer.NcM3 ?? ni;
    const NvM3 = layer.NvM3 ?? ni;

    for (let j = 0; j <= nSeg; j++) {
      if (j === nSeg && li < layers.length - 1) continue;
      nodes.push({
        xM: x,
        layerIndex: li,
        epsilonR: layer.epsilonR,
        niM3: ni,
        NcM3,
        NvM3,
        NdM3: layer.NdM3,
        NaM3: layer.NaM3,
        ecRefEv: ecRefEv[li]!,
        evRefEv: evRefEv[li]!,
      });
      if (nodes.length > 1) {
        dxM.push(dx);
      }
      x += j < nSeg ? dx : 0;
    }
  }

  return { nodes, dxM, lengthM: layers.reduce((s, l) => s + l.thicknessM, 0) };
}

export function nodeAt(mesh: Mesh, index: number): MeshNode {
  return mesh.nodes[index]!;
}

export function nodeCount(mesh: Mesh): number {
  return mesh.nodes.length;
}
