"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useVault } from "@/hooks/useVault";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/dashboard/items", label: "Inventario" },
  { href: "/dashboard/contacts", label: "Contactos" },
  { href: "/dashboard/instructions", label: "Instrucciones" },
  { href: "/dashboard/messages", label: "Mensajes" },
  { href: "/dashboard/access-requests", label: "Solicitudes de acceso" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isUnlocked, lock } = useVault();

  useEffect(() => {
    if (!isUnlocked) {
      router.replace("/vault/unlock");
    }
  }, [isUnlocked, router]);

  if (!isUnlocked) {
    // Evita parpadeo de contenido cifrado mientras redirige.
    return null;
  }

  function handleLock() {
    lock();
    router.push("/vault/unlock");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col justify-between border-r border-ink/10 bg-white px-4 py-6">
        <div>
          <p className="px-2 text-sm font-semibold text-accent">Legado Digital</p>
          <nav className="mt-6 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-1.5 text-sm text-ink/70 hover:bg-ink/5 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <button
          onClick={handleLock}
          className="rounded-md border border-ink/15 px-2 py-1.5 text-left text-sm text-ink/60 hover:bg-ink/5"
        >
          Bloquear bóveda
        </button>
      </aside>
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
