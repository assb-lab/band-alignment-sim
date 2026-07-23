import { useState } from "react";
import {
  interfaceElectrodeMode,
  type InterfaceTemplate,
} from "../lib/interfaceTemplates.ts";

interface InterfaceLibraryModalProps {
  builtInTemplates: InterfaceTemplate[];
  userTemplates: InterfaceTemplate[];
  defaultName: string;
  onClose: () => void;
  onCreate: (name: string, overwriteId?: string) => Promise<string | null>;
  onRename: (id: string, name: string) => Promise<string | null>;
  onDelete: (id: string) => Promise<void>;
  onLoad: (template: InterfaceTemplate) => void;
}

function rowSummary(template: InterfaceTemplate): string {
  return template.rows.map((row) => row.label).join(" / ");
}

function modeLabel(template: InterfaceTemplate): string {
  const mode = interfaceElectrodeMode(template);
  if (mode === "open") return "Open circuit";
  if (mode === "bias") return "Applied bias";
  return "Shorted equilibrium";
}

function InterfaceRow({
  template,
  readOnly,
  draftName,
  onDraftNameChange,
  onLoad,
  onRename,
  onDelete,
}: {
  template: InterfaceTemplate;
  readOnly?: boolean;
  draftName?: string;
  onDraftNameChange?: (name: string) => void;
  onLoad: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const inputClass =
    "w-full min-w-[12rem] rounded border border-slate-300 bg-white px-2 py-1 text-slate-950";
  return (
    <tr className="border-t border-slate-200">
      <td className="px-2 py-2">
        {readOnly ? (
          <span className="font-medium text-slate-900">{template.name}</span>
        ) : (
          <input
            className={inputClass}
            value={draftName ?? template.name}
            onChange={(event) => onDraftNameChange?.(event.target.value)}
          />
        )}
      </td>
      <td className="px-2 py-2 text-slate-600">{template.source === "built-in" ? "Example" : "User"}</td>
      <td className="px-2 py-2 text-slate-700">{modeLabel(template)}</td>
      <td className="px-2 py-2 text-slate-700">{template.rows.length}</td>
      <td className="px-2 py-2 text-slate-700">{rowSummary(template)}</td>
      <td className="px-2 py-2">
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
            onClick={onLoad}
          >
            Load
          </button>
          {!readOnly && (
            <>
              <button
                type="button"
                aria-label={`Save ${draftName ?? template.name}`}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={onRename}
              >
                Save
              </button>
              <button
                type="button"
                aria-label={`Delete ${template.name}`}
                className="rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                onClick={onDelete}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export function InterfaceLibraryModal({
  builtInTemplates,
  userTemplates,
  defaultName,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onLoad,
}: InterfaceLibraryModalProps) {
  const [newName, setNewName] = useState(defaultName);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<InterfaceTemplate | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InterfaceTemplate | null>(null);

  const create = () => {
    setError(null);
    const name = newName.trim();
    const builtInDuplicate = builtInTemplates.find(
      (template) => template.name.toLowerCase() === name.toLowerCase(),
    );
    if (builtInDuplicate) {
      setError(`Built-in interface cannot be overwritten: ${builtInDuplicate.name}`);
      return;
    }
    const userDuplicate = userTemplates.find(
      (template) => template.name.toLowerCase() === name.toLowerCase(),
    );
    if (userDuplicate) {
      setPendingOverwrite(userDuplicate);
      return;
    }
    onCreate(newName).then((message) => {
      if (message) {
        setError(message);
        return;
      }
      setNewName(defaultName);
    });
  };

  const confirmOverwrite = () => {
    if (!pendingOverwrite) return;
    setError(null);
    onCreate(pendingOverwrite.name, pendingOverwrite.id).then((message) => {
      if (message) {
        setError(message);
        return;
      }
      setNewName(defaultName);
      setPendingOverwrite(null);
    });
  };

  const rename = (template: InterfaceTemplate) => {
    setError(null);
    const name = draftNames[template.id] ?? template.name;
    onRename(template.id, name).then((message) => {
      if (message) {
        setError(message);
        return;
      }
      setDraftNames((current) => {
        const next = { ...current };
        delete next[template.id];
        return next;
      });
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="interface-library-title"
        className="flex max-h-[86vh] w-full max-w-5xl flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="interface-library-title" className="text-base font-semibold text-slate-950">
            Interfaces
          </h2>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Interface sets are complete layer stacks. Materials are single-row material constants.
        </p>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-slate-50 p-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Save current stack as
            <input
              className="w-64 rounded border border-slate-300 bg-white px-2 py-1 text-slate-950"
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
                setError(null);
              }}
            />
          </label>
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            onClick={create}
          >
            Save current interface
          </button>
        </div>
        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Kind</th>
                <th className="px-2 py-2 font-medium">Mode</th>
                <th className="px-2 py-2 font-medium">Layers</th>
                <th className="px-2 py-2 font-medium">Stack</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {userTemplates.map((template) => (
                <InterfaceRow
                  key={template.id}
                  template={template}
                  draftName={draftNames[template.id] ?? template.name}
                  onDraftNameChange={(name) =>
                    setDraftNames((current) => ({ ...current, [template.id]: name }))
                  }
                  onLoad={() => onLoad(template)}
                  onRename={() => rename(template)}
                  onDelete={() => {
                    setError(null);
                    setPendingDelete(template);
                  }}
                />
              ))}
              {builtInTemplates.map((template) => (
                <InterfaceRow
                  key={template.id}
                  template={template}
                  readOnly
                  onLoad={() => onLoad(template)}
                />
              ))}
            </tbody>
          </table>
        </div>
        {pendingOverwrite && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 px-4">
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="overwrite-interface-title"
              className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            >
              <h3 id="overwrite-interface-title" className="text-base font-semibold text-slate-950">
                Overwrite interface?
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Replace "{pendingOverwrite.name}" with the current stack. This keeps the same saved
                interface name and updates its layers.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setPendingOverwrite(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                  onClick={confirmOverwrite}
                >
                  Overwrite
                </button>
              </div>
            </section>
          </div>
        )}
        {pendingDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 px-4">
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-interface-title"
              className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            >
              <h3 id="delete-interface-title" className="text-base font-semibold text-slate-950">
                Delete interface?
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Delete "{pendingDelete.name}". This saved interface cannot be restored from this
                dialog.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setPendingDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  onClick={() => {
                    const target = pendingDelete;
                    setPendingDelete(null);
                    onDelete(target.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
