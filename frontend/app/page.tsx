import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-accent">Legado Digital</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">
          Tu expediente patrimonial digital, listo para tu familia.
        </h1>
        <p className="mt-4 text-ink/70">
          Organiza cuentas, pólizas, propiedades y documentos importantes en un solo lugar,
          cifrado de extremo a extremo. Ni nosotros podemos leer tu información.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/register"
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-paper hover:opacity-90"
        >
          Crear cuenta
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-ink/20 px-5 py-2.5 text-sm font-medium hover:bg-ink/5"
        >
          Iniciar sesión
        </Link>
      </div>

      {/* Aviso legal obligatorio — ver requerimiento de producto. */}
      <div className="rounded-md border border-ink/10 bg-ink/5 p-4 text-sm text-ink/70">
        <p className="font-medium text-ink">Aviso importante</p>
        <p className="mt-1">
          Esto no es un testamento ni asesoría legal. Es una herramienta de organización de
          tu información patrimonial. Para que tus disposiciones tengan plena validez en tu
          país, debes hablar con un notario o abogado especializado en sucesiones.
        </p>
      </div>
    </main>
  );
}
