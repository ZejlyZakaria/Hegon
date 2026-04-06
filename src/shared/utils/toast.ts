import { toast as sonnerToast, type ExternalToast } from "sonner";

// ─── Shared styles ────────────────────────────────────────────────────────────

const BASE: React.CSSProperties = {
  background: "#27272a",
  color: "#f4f4f5",
  border: "1px solid #3f3f46",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)",
};

const SUCCESS: React.CSSProperties = {
  ...BASE,
  background: "#182820",
  border: "1px solid rgba(16, 185, 129, 0.35)",
};

const ERROR: React.CSSProperties = {
  ...BASE,
  background: "#2a1a1a",
  border: "1px solid rgba(239, 68, 68, 0.4)",
};

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function toast(message: string, options?: ExternalToast) {
  return sonnerToast(message, { style: BASE, ...options });
}

toast.success = (message: string, options?: ExternalToast) =>
  sonnerToast.success(message, { style: SUCCESS, ...options });

toast.error = (message: string, options?: ExternalToast) =>
  sonnerToast.error(message, { style: ERROR, ...options });

toast.promise = sonnerToast.promise;
toast.dismiss = sonnerToast.dismiss;

export { toast };
