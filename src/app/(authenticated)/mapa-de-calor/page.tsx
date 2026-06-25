"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  fetchAllBeneficios,
  fetchBeneficiariosPendentes,
  fetchMapaCalor,
  fetchMapaCalorResumo,
  processarGeocodificacao,
  definirCoordenadaManual,
} from "@/lib/api"
import type {
  Beneficio,
  BeneficiarioPendente,
  MapaCalorPonto,
  MapaCalorResumo,
} from "@/types"
import {
  Download,
  Loader2,
  MapPinned,
  RotateCw,
  Flame,
  MapPin,
  Crosshair,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"

const MapaGoogle = dynamic(() => import("./_components/mapa-google"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Carregando mapa…
    </div>
  ),
})

const STATUS_OPCOES = [
  { value: "EM_ANALISE", label: "Em análise" },
  { value: "APROVADO", label: "Aprovado" },
  { value: "REPROVADO", label: "Reprovado" },
]

const ZONA_OPCOES = [
  { value: "URBANO", label: "Urbano" },
  { value: "RURAL_DISTRITO", label: "Rural/Distrito" },
]

const PRECISAO_OPCOES = [
  { value: "ENDERECO_EXATO", label: "Endereço exato" },
  { value: "RUA", label: "Rua" },
  { value: "LOCALIDADE", label: "Localidade" },
  { value: "MANUAL", label: "Manual" },
]

// Mesmas cores dos pinos do mapa (ver mapa-google.tsx).
const STATUS_ATUALIZACAO_META = [
  { key: "ATUALIZADO", label: "Atualizados", cor: "#22c55e", classe: "text-emerald-600" },
  { key: "PENDENTE", label: "Pendentes", cor: "#ef4444", classe: "text-red-600" },
  { key: "DESATUALIZADO", label: "Desatualizados", cor: "#9ca3af", classe: "text-gray-500" },
] as const

const selectClass = "h-10 rounded-md border bg-background px-3 text-sm font-normal"

type Filtros = {
  beneficio_id: string
  status: string
  bairro: string
  zona: string
  visitado_por: string
  precisao: string
  data_inicio: string
  data_fim: string
}

const FILTROS_VAZIOS: Filtros = {
  beneficio_id: "",
  status: "",
  bairro: "",
  zona: "",
  visitado_por: "",
  precisao: "",
  data_inicio: "",
  data_fim: "",
}

function filtrosParaParams(filtros: Filtros): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) params[chave] = valor
  }
  return params
}

export default function MapaDeCalorPage() {
  const [beneficios, setBeneficios] = useState<Beneficio[]>([])
  const [bairros, setBairros] = useState<string[]>([])
  const [pontos, setPontos] = useState<MapaCalorPonto[]>([])
  const [resumo, setResumo] = useState<MapaCalorResumo | null>(null)
  const [loading, setLoading] = useState(true)

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS)
  const [modo, setModo] = useState<"pontos" | "calor">("pontos")
  const [raio, setRaio] = useState(25)
  const [intensidade, setIntensidade] = useState(0.6)

  const [processando, setProcessando] = useState(false)

  // Pino manual
  const [modoManual, setModoManual] = useState(false)
  const [pendentes, setPendentes] = useState<BeneficiarioPendente[]>([])
  const [pendenteSelecionado, setPendenteSelecionado] = useState("")

  const carregarDados = useCallback(async (filtrosAtuais: Filtros) => {
    setLoading(true)
    try {
      const params = filtrosParaParams(filtrosAtuais)
      const [pontosData, resumoData] = await Promise.all([
        fetchMapaCalor(params),
        fetchMapaCalorResumo(params),
      ])
      setPontos(pontosData)
      setResumo(resumoData)
    } catch {
      toast.error("Erro ao carregar dados do mapa")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let ativo = true
    void (async () => {
      try {
        const [beneficiosData, resumoGeral] = await Promise.all([
          fetchAllBeneficios(),
          fetchMapaCalorResumo(),
        ])
        if (!ativo) return
        setBeneficios(beneficiosData)
        setBairros(resumoGeral.por_bairro.map((item) => item.bairro))
      } catch {
        /* silencioso — os cards/erros cobrem o resto */
      }
      if (ativo) await carregarDados(FILTROS_VAZIOS)
    })()
    return () => {
      ativo = false
    }
  }, [carregarDados])

  function atualizarFiltro<K extends keyof Filtros>(chave: K, valor: Filtros[K]) {
    setFiltros((atual) => ({ ...atual, [chave]: valor }))
  }

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS)
    void carregarDados(FILTROS_VAZIOS)
  }

  async function carregarPendentes() {
    try {
      const data = await fetchBeneficiariosPendentes()
      setPendentes(data)
    } catch {
      toast.error("Erro ao carregar beneficiários pendentes")
    }
  }

  async function alternarModoManual() {
    const novo = !modoManual
    setModoManual(novo)
    if (novo) {
      setModo("pontos")
      await carregarPendentes()
      toast.info("Selecione um beneficiário pendente e clique no mapa para fixar o pino.")
    }
  }

  async function aoClicarMapa(lat: number, lng: number) {
    if (!modoManual) return
    if (!pendenteSelecionado) {
      toast.info("Selecione um beneficiário pendente antes de marcar no mapa.")
      return
    }
    try {
      await definirCoordenadaManual(pendenteSelecionado, lat, lng)
      toast.success("Coordenada manual salva.")
      setPendenteSelecionado("")
      await Promise.all([carregarPendentes(), carregarDados(filtros)])
    } catch {
      toast.error("Erro ao salvar coordenada manual.")
    }
  }

  async function processarPendentes() {
    setProcessando(true)
    const acumulado = { processados: 0, sucesso: 0, nao_encontrado: 0, erro: 0 }
    try {
      // Loop de lotes até esgotar os pendentes (ou atingir o limite de segurança).
      for (let i = 0; i < 200; i++) {
        const r = await processarGeocodificacao(50)
        acumulado.processados += r.processados
        acumulado.sucesso += r.sucesso
        acumulado.nao_encontrado += r.nao_encontrado
        acumulado.erro += r.erro
        toast.info(
          `Processando… ${acumulado.processados} processados, ${r.restantes} restantes`,
        )
        if (r.processados === 0 || r.restantes === 0) break
      }
      toast.success(
        `Concluído: ${acumulado.sucesso} geocodificados, ${acumulado.nao_encontrado} não encontrados, ${acumulado.erro} com erro.`,
      )
      await carregarDados(filtros)
      if (modoManual) await carregarPendentes()
    } catch {
      toast.error("Erro ao processar geocodificação.")
    } finally {
      setProcessando(false)
    }
  }

  function exportarCSV() {
    if (pontos.length === 0) {
      toast.info("Nenhum ponto para exportar.")
      return
    }
    const linhas = pontos.map((p) => ({
      nome: p.nome,
      bairro: p.bairro,
      rua: p.rua,
      numero: p.numero,
      latitude: p.latitude,
      longitude: p.longitude,
      beneficio: p.beneficio,
      status: p.status,
      precisao_geocodificacao: p.precisao ?? "",
      geocodificacao_status: p.geocodificacao_status,
    }))
    const ws = XLSX.utils.json_to_sheet(linhas)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `mapa_calor_beneficiarios_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const cards = useMemo(
    () => [
      { titulo: "Beneficiários filtrados", valor: resumo?.total ?? 0, cor: "text-blue-600" },
      { titulo: "Com coordenada", valor: resumo?.com_coordenada ?? 0, cor: "text-emerald-600" },
      { titulo: "Sem coordenada", valor: resumo?.sem_coordenada ?? 0, cor: "text-amber-600" },
    ],
    [resumo],
  )

  // Relatório por status de atualização, calculado sobre os pontos exibidos no mapa.
  const relatorioAtualizacao = useMemo(() => {
    const contagem: Record<string, number> = {}
    for (const p of pontos) {
      contagem[p.status_atualizacao] = (contagem[p.status_atualizacao] ?? 0) + 1
    }
    const total = pontos.length
    return {
      total,
      linhas: STATUS_ATUALIZACAO_META.map((meta) => {
        const valor = contagem[meta.key] ?? 0
        return { ...meta, valor, pct: total ? Math.round((valor / total) * 100) : 0 }
      }),
    }
  }, [pontos])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <MapPinned className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mapa de Calor dos Beneficiários</h1>
          <p className="text-sm text-muted-foreground">
            Concentração de beneficiários em Tefé/AM a partir das coordenadas geocodificadas.
          </p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.titulo} size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.titulo}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold ${card.cor}`}>
                {card.valor.toLocaleString("pt-BR")}
              </p>
            </CardContent>
          </Card>
        ))}
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Maior concentração
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resumo?.maior_concentracao ? (
              <>
                <p className="truncate text-base font-semibold">
                  {resumo.maior_concentracao.bairro}
                </p>
                <p className="text-xs text-muted-foreground">
                  {resumo.maior_concentracao.total.toLocaleString("pt-BR")} beneficiários
                </p>
              </>
            ) : (
              <p className="text-2xl font-semibold">-</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Relatório por status de atualização */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-baseline gap-x-2 text-base">
            Relatório de atualização cadastral
            <span className="text-sm font-normal text-muted-foreground">
              — mostrando agora{" "}
              <strong className="text-foreground">
                {relatorioAtualizacao.total.toLocaleString("pt-BR")}
              </strong>{" "}
              {relatorioAtualizacao.total === 1 ? "beneficiário" : "beneficiários"} no mapa
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {relatorioAtualizacao.total === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum beneficiário georreferenciado para os filtros atuais.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {relatorioAtualizacao.linhas.map((linha) => (
                <div key={linha.key} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: linha.cor }}
                    />
                    <span className="text-sm font-medium text-muted-foreground">
                      {linha.label}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{linha.pct}%</span>
                  </div>
                  <p className={`mt-1 text-2xl font-semibold ${linha.classe}`}>
                    {linha.valor.toLocaleString("pt-BR")}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${linha.pct}%`, background: linha.cor }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2 text-sm font-medium">
              Benefício
              <select
                className={selectClass}
                value={filtros.beneficio_id}
                onChange={(e) => atualizarFiltro("beneficio_id", e.target.value)}
              >
                <option value="">Todos</option>
                {beneficios.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Status do beneficiário
              <select
                className={selectClass}
                value={filtros.status}
                onChange={(e) => atualizarFiltro("status", e.target.value)}
              >
                <option value="">Todos</option>
                {STATUS_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Bairro/Localidade
              <select
                className={selectClass}
                value={filtros.bairro}
                onChange={(e) => atualizarFiltro("bairro", e.target.value)}
              >
                <option value="">Todos</option>
                {bairros.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Zona
              <select
                className={selectClass}
                value={filtros.zona}
                onChange={(e) => atualizarFiltro("zona", e.target.value)}
              >
                <option value="">Todas</option>
                {ZONA_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Precisão da coordenada
              <select
                className={selectClass}
                value={filtros.precisao}
                onChange={(e) => atualizarFiltro("precisao", e.target.value)}
              >
                <option value="">Todas</option>
                {PRECISAO_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Visitado por (ID do responsável)
              <input
                className={selectClass}
                value={filtros.visitado_por}
                onChange={(e) => atualizarFiltro("visitado_por", e.target.value)}
                placeholder="opcional"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Atualizado de
              <input
                type="date"
                className={selectClass}
                value={filtros.data_inicio}
                onChange={(e) => atualizarFiltro("data_inicio", e.target.value)}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Atualizado até
              <input
                type="date"
                className={selectClass}
                value={filtros.data_fim}
                onChange={(e) => atualizarFiltro("data_fim", e.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => carregarDados(filtros)} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              Aplicar filtros
            </Button>
            <Button variant="outline" onClick={limparFiltros} disabled={loading}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Barra de ações do mapa */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <div className="inline-flex rounded-md border p-0.5">
            <Button
              size="sm"
              variant={modo === "pontos" ? "default" : "ghost"}
              onClick={() => setModo("pontos")}
            >
              <MapPin className="mr-1.5 h-4 w-4" />
              Pontos
            </Button>
            <Button
              size="sm"
              variant={modo === "calor" ? "default" : "ghost"}
              onClick={() => setModo("calor")}
              disabled={modoManual}
            >
              <Flame className="mr-1.5 h-4 w-4" />
              Mapa de calor
            </Button>
          </div>

          {modo === "calor" && (
            <div className="flex items-center gap-3 rounded-md border px-3 py-1.5 text-xs">
              <label className="flex items-center gap-1.5">
                Raio
                <input
                  type="range"
                  min={10}
                  max={50}
                  value={raio}
                  onChange={(e) => setRaio(Number(e.target.value))}
                />
              </label>
              <label className="flex items-center gap-1.5">
                Intensidade
                <input
                  type="range"
                  min={2}
                  max={10}
                  value={intensidade * 10}
                  onChange={(e) => setIntensidade(Number(e.target.value) / 10)}
                />
              </label>
            </div>
          )}

          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => carregarDados(filtros)} disabled={loading}>
              <RotateCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Recarregar
            </Button>
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              <Download className="mr-1.5 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button
              variant={modoManual ? "default" : "outline"}
              size="sm"
              onClick={alternarModoManual}
            >
              <Crosshair className="mr-1.5 h-4 w-4" />
              Pino manual
            </Button>
            <Button size="sm" onClick={processarPendentes} disabled={processando}>
              {processando ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <MapPinned className="mr-1.5 h-4 w-4" />
              )}
              Processar pendentes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Painel do pino manual */}
      {modoManual && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <label className="grid flex-1 gap-2 text-sm font-medium">
              Beneficiário pendente ({pendentes.length})
              <select
                className={selectClass}
                value={pendenteSelecionado}
                onChange={(e) => setPendenteSelecionado(e.target.value)}
              >
                <option value="">Selecione…</option>
                {pendentes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {p.bairro || p.rua || "sem endereço"} ({p.geocodificacao_status})
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              Selecione um beneficiário e clique no mapa para fixar a coordenada (precisão MANUAL,
              não sobrescrita pelo reprocessamento).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Mapa */}
      <Card>
        <CardContent className="p-0">
          <div className="h-[560px] w-full overflow-hidden rounded-lg">
            <MapaGoogle
              pontos={pontos}
              modo={modo}
              raio={raio}
              intensidade={intensidade}
              modoManual={modoManual}
              onMapClick={aoClicarMapa}
            />
          </div>
        </CardContent>
      </Card>

      {/* Distribuições */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por bairro/localidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {resumo && resumo.por_bairro.length > 0 ? (
              resumo.por_bairro.slice(0, 10).map((item) => (
                <div key={item.bairro} className="flex items-center justify-between text-sm">
                  <span className="truncate text-muted-foreground">{item.bairro}</span>
                  <span className="font-medium">{item.total.toLocaleString("pt-BR")}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por precisão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {resumo && resumo.por_precisao.length > 0 ? (
              resumo.por_precisao.map((item) => (
                <div key={item.precisao} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.precisao}</span>
                  <span className="font-medium">{item.total.toLocaleString("pt-BR")}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
