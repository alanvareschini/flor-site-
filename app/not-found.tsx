import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#111111] px-6 text-white">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-white/35">
          404
        </p>
        <h1 className="mt-4 text-4xl tracking-[-0.05em]">
          Esta cena nao existe.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          A pagina que voce tentou abrir nao esta disponivel agora.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full border border-white/10 px-5 py-3 text-xs uppercase tracking-[0.28em] text-white/80 transition-colors duration-300 hover:text-white"
        >
          Voltar para o inicio
        </Link>
      </div>
    </main>
  );
}
