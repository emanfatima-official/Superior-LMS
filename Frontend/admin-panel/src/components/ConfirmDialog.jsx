import {
  Loader2,
  AlertTriangle,
} from "lucide-react";

import Modal from "./Modal";

function ConfirmDialog({
  open,
  onClose,
  onConfirm,

  title = "Are you sure?",

  message = "",

  loading = false,

  confirmLabel = "Confirm",

  danger = true,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
    >
      <div className="flex gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            danger
              ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
              : "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
          }`}
        >
          <AlertTriangle
            size={20}
          />
        </div>

        <p className="pt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {message}
        </p>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${
            danger
              ? "bg-red-600 hover:bg-red-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading && (
            <Loader2
              size={16}
              className="animate-spin"
            />
          )}

          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;