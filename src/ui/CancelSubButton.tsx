"use client";

/** Botón de cancelar suscripción con confirmación nativa. */
export function CancelSubButton({ label, confirmText }: { label: string; confirmText: string }) {
  return (
    <form action="/api/account/cancel" method="post" onSubmit={(e) => { if (!confirm(confirmText)) e.preventDefault(); }} style={{ display: "inline" }}>
      <button className="btn btn-ghost" style={{ color: "#dc2626", borderColor: "#fecaca" }}>{label}</button>
    </form>
  );
}
