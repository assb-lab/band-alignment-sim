import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App.tsx";

async function waitForInitialRun() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Run simulation/i })).toBeEnabled();
  });
}

describe("App integration", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("runs simulation and renders band diagram paths", async () => {
    render(<App />);
    await waitForInitialRun();
    fireEvent.click(screen.getByRole("button", { name: /Run simulation/i }));
    await waitFor(() => {
      expect(document.querySelectorAll("svg path").length).toBeGreaterThan(0);
    });
  });

  it("loads preset stacks", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Interfaces" }));
    const dialog = await screen.findByRole("dialog", { name: "Interfaces" });
    expect(within(dialog).getByText("GaAs/AlGaAs 3-layer")).toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Load" })[1]!);
    await waitFor(() => {
      expect(document.querySelectorAll("svg path").length).toBeGreaterThan(0);
    });
  });

  it("uses a modal to name material templates and shows duplicate errors inline", async () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]!);

    await screen.findByRole("dialog", { name: "Save material" });
    expect(screen.getByLabelText("Template name")).toHaveValue("p-Si");

    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Saved p-Si" } });
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Save material" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Save material" });
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));

    expect(dialog).toHaveTextContent("Material template already exists: Saved p-Si");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Save material" })).not.toBeInTheDocument();
  });

  it("opens the material library modal and supports user material CRUD", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Materials" }));

    const materialsDialog = await screen.findByRole("dialog", { name: "Materials" });
    expect(within(materialsDialog).getByText("Doping")).toBeInTheDocument();
    expect(within(materialsDialog).getByText("Nd [cm⁻³]")).toBeInTheDocument();
    expect(within(materialsDialog).getAllByText("n-Si").length).toBeGreaterThan(0);
    expect(within(materialsDialog).getAllByText("p-Si").length).toBeGreaterThan(0);
    expect(within(materialsDialog).queryByText("Si")).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("New material"), {
      target: { value: "Library Test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Library Test" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Library Test")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("New material"), {
      target: { value: "Library Test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Library Test" }));
    const overwriteMaterialDialog = await screen.findByRole("alertdialog", {
      name: "Overwrite material?",
    });
    fireEvent.click(within(overwriteMaterialDialog).getByRole("button", { name: "Overwrite" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog", { name: "Overwrite material?" })).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Library Test"), {
      target: { value: "Library Test Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Library Test Updated" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Library Test Updated")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Library Test Updated" }));
    const deleteMaterialDialog = await screen.findByRole("alertdialog", {
      name: "Delete material?",
    });
    fireEvent.click(within(deleteMaterialDialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByDisplayValue("Library Test Updated")).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Materials" })).not.toBeInTheDocument();
  });

  it("opens the interface library modal and supports user interface CRUD", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Interfaces" }));

    const dialog = await screen.findByRole("dialog", { name: "Interfaces" });
    expect(within(dialog).getByText("Interface sets are complete layer stacks. Materials are single-row material constants.")).toBeInTheDocument();
    expect(within(dialog).getByText("Si pn")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByDisplayValue("Current interface"), {
      target: { value: "Saved interface test" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save current interface" }));

    await waitFor(() => {
      expect(within(dialog).getByDisplayValue("Saved interface test")).toBeInTheDocument();
    });

    fireEvent.change(within(dialog).getByDisplayValue("Current interface"), {
      target: { value: "Saved interface test" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save current interface" }));
    const overwriteDialog = await screen.findByRole("alertdialog", {
      name: "Overwrite interface?",
    });
    expect(overwriteDialog).toHaveTextContent("Saved interface test");
    fireEvent.click(within(overwriteDialog).getByRole("button", { name: "Overwrite" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog", { name: "Overwrite interface?" })).not.toBeInTheDocument();
    });

    fireEvent.change(within(dialog).getByDisplayValue("Saved interface test"), {
      target: { value: "Saved interface updated" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Saved interface updated" }));

    await waitFor(() => {
      expect(within(dialog).getByDisplayValue("Saved interface updated")).toBeInTheDocument();
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete Saved interface updated" }));
    const deleteDialog = await screen.findByRole("alertdialog", { name: "Delete interface?" });
    expect(deleteDialog).toHaveTextContent("Saved interface updated");
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(within(dialog).queryByDisplayValue("Saved interface updated")).not.toBeInTheDocument();
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Interfaces" })).not.toBeInTheDocument();
  });

  it.each(["InP/InGaAs p-i-n", "AlGaN/GaN"])(
    "loads %s preset stack",
    async (buttonName) => {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Interfaces" }));
      const dialog = await screen.findByRole("dialog", { name: "Interfaces" });
      const row = within(dialog).getByText(buttonName).closest("tr")!;
      fireEvent.click(within(row).getByRole("button", { name: "Load" }));
      expect(screen.getByLabelText("rel limit")).toHaveValue(2);
      await waitFor(() => {
        expect(document.querySelectorAll("svg path").length).toBeGreaterThan(0);
      });
    },
  );

  it("switches secondary plot tabs", async () => {
    render(<App />);
    await waitFor(() => {
      expect(document.querySelectorAll("svg path").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole("button", { name: "E" }));
    fireEvent.click(screen.getByRole("button", { name: "n,p" }));
    fireEvent.click(screen.getByRole("button", { name: "ρ" }));
    fireEvent.click(screen.getByRole("button", { name: "φ" }));
    expect(document.querySelectorAll("svg path").length).toBeGreaterThan(0);
  });

  it("shows spinner while simulation runs", async () => {
    render(<App />);
    expect(screen.getByRole("status", { busy: true })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("status", { busy: true })).not.toBeInTheDocument();
    });
  });
});
