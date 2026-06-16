"use client"

import { Suspense } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Logo from "@/components/shared/logo"
import Footer from "@/components/shared/footer"
import { LogIn } from "lucide-react"

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  return (
    <>
      {error === "unauthorized" && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg text-center">
          Acesso restrito a administradores. Você não possui a role necessária.
        </div>
      )}
      {error === "signin" && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg text-center">
          Erro ao fazer login. Tente novamente.
        </div>
      )}
      {error === "session" && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg text-center">
          Sua sessão estava inválida. Tente entrar novamente.
        </div>
      )}
      <Button className="w-full h-12 text-base gap-2" onClick={() => signIn("keycloak", { redirectTo: "/dashboard" })}>
        <LogIn className="w-5 h-5" />
        Entrar com Tefé Cidadão
      </Button>
    </>
  )
}

function LoginFallback() {
  return (
    <div className="space-y-4">
      <div className="bg-muted/10 text-muted-foreground text-sm p-3 rounded-lg text-center animate-pulse">
        Carregando...
      </div>
      <Button className="w-full h-12 text-base gap-2" disabled>
        <LogIn className="w-5 h-5" />
        Entrar com Tefé Cidadão
      </Button>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center space-y-2">
            <Logo className="mx-auto w-64 max-w-full" priority />
            <CardTitle className="text-2xl">Bem Vindo! Entre com um clique!</CardTitle>
            <CardDescription>Painel Administrativo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Suspense fallback={<LoginFallback />}>
              <LoginContent />
            </Suspense>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
