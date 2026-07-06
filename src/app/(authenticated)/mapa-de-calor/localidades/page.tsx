"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fetchLocalidades, setLocalidadeCoordenada, aplicarLocalidades } from "@/lib/api"
import type { LocalidadeBeneficiario, MapaCalorPonto } from "@/types"
import { ArrowLeft, Crosshair, Loader2, MapPin, MapPinned, RefreshCw, Check } from "lucide-react"
import { toast } from "sonner"

const MapaGoogle = dynamic(() => import("../_components/mapa-google"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Carregando mapa…
    </div>
  ),
})

// Converte as localidades com coordenada em "pontos" para o mapa.
// Cor (status_atualizacao): MANUAL = verde (confirmado), GOOGLE = cinza (revisar).
function localidadeParaPonto(loc: LocalidadeBeneficiario): MapaCalorPonto {
  return {
    id: loc.id,
    nome: loc.nome,
    bairro: loc.nome,
    rua: "",
    numero: "",
    latitude: loc.latitude as number,
    longitude: loc.longitude as number,
    beneficio: `${loc.total_beneficiarios} beneficiário(s)`,
    status: loc.fonte,
    status_atualizacao: loc.fonte === "MANUAL" ? "ATUALIZADO" : "DESATUALIZADO",
    precisao: loc.fonte,
    geocodificacao_status: "OK",
    beneficios: [],
    zona: "",
  }
}

export default function LocalidadesPage() {
  const [localidades, setLocalidades] = useState<LocalidadeBeneficiario[]>([])
  const [selecionada, setSelecionada] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [aplicando, setAplicando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      setLocalidades(await fetchLocalidades())
    } catch {
      toast.error("Erro ao carregar localidades")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const pontos = useMemo(
    () => localidades.filter((l) => l.latitude != null && l.longitude != null).map(localidadeParaPonto),
    [localidades],
  )

  const definidas = pontos.length
  const pendentes = localidades.length - definidas
  const locSelecionada = localidades.find((l) => l.id === selecionada) ?? null

  async function aoClicarMapa(lat: number, lng: number) {
    if (!selecionada) {
      toast.info("Selecione uma localidade na lista antes de clicar no mapa.")
      return
    }
    setSalvando(true)
    try {
      const r = await setLocalidadeCoordenada(selecionada, lat, lng)
      toast.success(`"${r.nome}" definida — ${r.enderecos_aplicados} beneficiário(s) reposicionado(s).`)
      setSelecionada("")
      await carregar()
    } catch {
      toast.error("Erro ao salvar coordenada da localidade.")
    } finally {
      setSalvando(false)
    }
  }

  async function reaplicarTodas() {
    setAplicando(true)
    try {
      const r = await aplicarLocalidades()
      toast.success(`Reaplicado: ${r.enderecos} beneficiários em ${r.localidades} localidades.`)
    } catch {
      toast.error("Erro ao reaplicar as localidades.")
    } finally {
      setAplicando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/mapa-de-calor">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <MapPinned className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Coordenadas por localidade</h1>
          <p className="text-sm text-muted-foreground">
            Selecione uma localidade e clique no mapa para fixar o ponto. Todos os beneficiários
            dela são reposicionados de uma vez.
          </p>
        </div>
        <Button variant="outline" onClick={reaplicarTodas} disabled={aplicando}>
          {aplicando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Reaplicar todas
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Lista de localidades */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3 text-sm">
              <span className="font-medium">{localidades.length} localidades</span>
              <span className="text-muted-foreground">
                <span className="text-emerald-600">{definidas} definidas</span>
                {" · "}
                <span className="text-amber-600">{pendentes} pendentes</span>
              </span>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {loading ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
                </div>
              ) : (
                <ul className="divide-y">
                  {localidades.map((loc) => {
                    const tem = loc.latitude != null && loc.longitude != null
                    const ativo = loc.id === selecionada
                    return (
                      <li key={loc.id}>
                        <button
                          type="button"
                          onClick={() => setSelecionada(ativo ? "" : loc.id)}
                          className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 ${ativo ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : ""}`}
                        >
                          <span className="mt-0.5">
                            {tem ? (
                              <Check className={`h-4 w-4 ${loc.fonte === "MANUAL" ? "text-emerald-600" : "text-gray-400"}`} />
                            ) : (
                              <MapPin className="h-4 w-4 text-amber-500" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium">{loc.nome}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{loc.total_beneficiarios}</span>
                            </span>
                            {!tem && loc.google_formatted && (
                              <span className="block truncate text-xs text-muted-foreground">
                                Google: {loc.google_formatted}
                              </span>
                            )}
                            {tem && (
                              <span className="block text-xs text-muted-foreground">
                                {loc.fonte === "MANUAL" ? "definida na mão" : "auto (Google) — revise"}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mapa */}
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm">
              <Crosshair className="h-4 w-4 text-primary" />
              {locSelecionada ? (
                <span>
                  Clique no mapa para fixar <strong>{locSelecionada.nome}</strong>
                  {salvando && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
                </span>
              ) : (
                <span className="text-muted-foreground">Selecione uma localidade na lista.</span>
              )}
            </div>
            <div className="h-[560px] w-full overflow-hidden rounded-b-lg">
              <MapaGoogle
                pontos={pontos}
                modo="pontos"
                raio={25}
                intensidade={0.6}
                modoManual
                onMapClick={aoClicarMapa}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
