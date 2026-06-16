import Footer from "@/components/shared/footer"

export default function Unauthorized() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">401 - Não Autorizado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          <a href="/login" className="text-primary hover:underline">
            Voltar ao login
          </a>
        </div>
      </main>
      <Footer />
    </div>
  )
}
