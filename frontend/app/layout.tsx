import type { Metadata } from "next";
import type { ReactNode } from "react";

import { VaultProvider } from "@/hooks/useVault";

import "./globals.css";

export const metadata: Metadata = {
  title: "Legado Digital",
  description: "Organizador de expediente patrimonial digital, cifrado de extremo a extremo.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <VaultProvider>{children}</VaultProvider>
      </body>
    </html>
  );
}
