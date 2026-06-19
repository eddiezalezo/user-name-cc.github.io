"use client";

import Link from "next/link";

const CARDS = [
  { href: "/dashboard/items", title: "Inventario", desc: "Cuentas, pólizas, propiedades y documentos." },
  { href: "/dashboard/contacts", title: "Contactos", desc: "Herederos, albacea y personas de confianza." },
  { href: "/dashboard/instructions", title: "Instrucciones", desc: "Qué hacer ante fallecimiento o incapacidad." },
  { href: "/dashboard/messages", title: "Mensajes póstumos", desc: "Mensajes para personas específicas." },
  {
    href: "/dashboard/access-requests",
    title: "Solicitudes de acceso",
    desc: "Revisa y aprueba/deniega solicitudes de tus contactos.",
  },
];

export default function DashboardHomePage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Resumen</h1>
        <p className="mt-1 text-sm text-ink/60">Tu bóveda está desbloqueada en este dispositivo.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-ink/10 bg-white p-5 hover:border-accent/40 hover:shadow-sm"
          >
            <p className="font-medium">{card.title}</p>
            <p className="mt-1 text-sm text-ink/60">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
