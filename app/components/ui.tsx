"use client";
// In-app replacements for window.confirm and ad-hoc status messages.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

type ConfirmOpts = { title: string; body?: string; confirmLabel?: string; danger?: boolean };
type Pending = ConfirmOpts & { resolve: (v: boolean) => void };
type ToastItem = { id: number; kind: "ok" | "bad"; text: string };

type Ui = {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  toast: (kind: "ok" | "bad", text: string) => void;
};

const Ctx = createContext<Ui | null>(null);

export function useUi() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUi must be used inside <UiProvider>");
  return v;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const ref = useRef<HTMLDialogElement>(null);
  const seq = useRef(0);

  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<boolean>((resolve) =>
        setPending((prev) => {
          prev?.resolve(false);
          return { ...o, resolve };
        }),
      ),
    [],
  );

  const toast = useCallback((kind: "ok" | "bad", text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "bad" ? 8000 : 4500);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (pending && d && !d.open) d.showModal();
  }, [pending]);

  const settle = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
    ref.current?.close();
  };

  const value = useMemo(() => ({ confirm, toast }), [confirm, toast]);

  return (
    <Ctx.Provider value={value}>
      {children}

      <dialog
        ref={ref}
        className="sheet sheet--alert"
        aria-labelledby="confirm-title"
        onCancel={(e) => {
          e.preventDefault();
          settle(false);
        }}
        onClick={(e) => e.target === e.currentTarget && settle(false)}
      >
        {pending && (
          <div className="sheet__body">
            <h2 className="sheet__title" id="confirm-title">
              {pending.title}
            </h2>
            {pending.body && <p className="sheet__text">{pending.body}</p>}
            <div className="sheet__actions">
              <button className="btn btn--quiet" onClick={() => settle(false)} autoFocus>
                Cancel
              </button>
              <button className={`btn ${pending.danger ? "btn--danger-solid" : "btn--primary"}`} onClick={() => settle(true)}>
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        )}
      </dialog>

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            <Icon name={t.kind === "ok" ? "check" : "alert"} size={18} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
