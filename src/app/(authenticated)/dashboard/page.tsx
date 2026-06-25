"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Activity, BadgeCheck, CalendarCheck2, ChevronDown, Gift, Loader2, Search, TrendingUp, User, UserMinus, UserRound, Users } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { fetchCidadaos, fetchDashboardStats, hasCachedKey } from "@/lib/api"
import type { Cidadao, DashboardStats } from "@/types"
import { toast } from "sonner"

const STATUS_META = {
  ATUALIZADO: { label: "Atualizado", color: "#22c55e" },
  PENDENTE: { label: "Pendente", color: "#eab308" },
  DESATUALIZADO: { label: "Desatualizado", color: "#ef4444" },
} as const

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("pt-BR")
}

// Replica o bairro_label do backend (stats): primeiro não-vazio entre
// bairro, comunidade/localidade e distrito; senão "Não informado".
function bairroLabelDe(c: Cidadao) {
  const e = c.endereco
  return (
    e?.bairro?.trim() ||
    e?.comunidade_localidade?.trim() ||
    e?.distrito?.trim() ||
    "Não informado"
  )
}

// Resumo de endereço para a listagem do modal:
// Zona | Bairro (urbano) ou Comunidade/Distrito (rural) | Logradouro | Nº
function enderecoResumo(c: Cidadao): string {
  const e = c.endereco
  if (!e) return "Sem endereço"
  const rural = (e.tipo_localizacao ?? "").startsWith("RURAL")
  const partes = [
    `Zona: ${rural ? "Rural/Distrito" : "Urbano"}`,
    rural ? e.comunidade_localidade?.trim() || e.distrito?.trim() : e.bairro?.trim(),
    e.logradouro?.trim(),
    e.numero?.trim() ? `Nº ${e.numero.trim()}` : "",
  ].filter(Boolean)
  return partes.join(" | ")
}

function formatMonthLabel(mes: string) {
  const [ano, m] = String(mes).split("-")
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  const index = Number(m) - 1
  return `${monthNames[index] ?? m}/${ano}`
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border bg-card px-4 py-3 text-sm shadow-2xl">
      <p className="mb-1.5 font-medium text-muted-foreground">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="font-bold" style={{ color: entry.color }}>
            {formatNumber(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-xl border bg-card px-4 py-3 text-sm shadow-2xl">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.payload.color }} />
        <span className="font-medium">{entry.name}</span>
      </div>
      <p className="mt-1 font-bold">{formatNumber(entry.value)} cidadão(s)</p>
    </div>
  )
}

function hueTaxa(taxa: number) {
  const t = Math.max(0, Math.min(100, taxa))
  return Math.round((t / 100) * 120) // 0 = vermelho, 60 = amarelo, 120 = verde
}

function corTaxa(taxa: number) {
  return `hsl(${hueTaxa(taxa)} 70% 45%)`
}

function corTaxaFill(taxa: number) {
  return `hsl(${hueTaxa(taxa)} 70% 45% / 0.2)`
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do Tefé Social</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} size="sm">
            <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-20" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-6"><Skeleton className="h-72" /></CardContent></Card>
        <Card><CardContent className="p-6"><Skeleton className="h-72" /></CardContent></Card>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(() => !hasCachedKey("dashboard:stats"))
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [bairroSelecionado, setBairroSelecionado] = useState<string>("")
  const [bairroOpen, setBairroOpen] = useState(false)

  // Modal de lista de cidadãos (ao clicar numa fatia/card dos gráficos).
  // Filtra por status e/ou bairro — o backend só filtra status, então o
  // bairro é casado no cliente replicando o bairro_label das stats.
  const [modalAberto, setModalAberto] = useState(false)
  const [modalTitulo, setModalTitulo] = useState("")
  const [modalCor, setModalCor] = useState<string | null>(null)
  const [modalCidadaos, setModalCidadaos] = useState<Cidadao[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [modalBusca, setModalBusca] = useState("")

  async function abrirModal(opts: { status?: string; bairro?: string; titulo: string; cor?: string | null }) {
    setModalTitulo(opts.titulo)
    setModalCor(opts.cor ?? null)
    setModalAberto(true)
    setModalBusca("")
    setModalCidadaos([])
    setModalLoading(true)
    try {
      const params: Record<string, string> = { page_size: "10000" }
      if (opts.status) params.status_atualizacao = opts.status
      const result = await fetchCidadaos(params)
      const lista = opts.bairro
        ? result.results.filter((c) => bairroLabelDe(c) === opts.bairro)
        : result.results
      setModalCidadaos(lista)
    } catch {
      toast.error("Erro ao carregar cidadãos")
    } finally {
      setModalLoading(false)
    }
  }

  const modalFiltrados = useMemo(() => {
    const termo = modalBusca.trim().toLowerCase()
    if (!termo) return modalCidadaos
    return modalCidadaos.filter((c) =>
      c.nome.toLowerCase().includes(termo) || (c.nis ?? "").toLowerCase().includes(termo),
    )
  }, [modalCidadaos, modalBusca])

  useEffect(() => {
    let active = true

    fetchDashboardStats()
      .then((data) => {
        if (active) setStats(data)
      })
      .catch(() => {
        if (active) toast.error("Erro ao carregar dashboard")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const pieData = useMemo(() => {
    return (stats?.cidadaos_por_status ?? [])
      .map((item) => {
        const meta = STATUS_META[item.status_atualizacao as keyof typeof STATUS_META]
        return {
          name: meta?.label ?? item.status_atualizacao,
          value: item.total,
          color: meta?.color ?? "#64748b",
          key: item.status_atualizacao,
        }
      })
      .filter((item) => item.value > 0)
  }, [stats])

  const monthlyData = useMemo(() => {
    // Atualizações por mês (por atualizado_em). Mantém fallback para
    // cidadaos_por_mes enquanto o backend novo não está no ar.
    return (stats?.atualizacoes_por_mes ?? stats?.cidadaos_por_mes ?? [])
      .slice(-12)
      .map((item) => ({
        mes: formatMonthLabel(item.mes),
        total: item.total,
      }))
  }, [stats])

  const totalAtualizacoesMes = useMemo(
    () => monthlyData.reduce((soma, item) => soma + item.total, 0),
    [monthlyData],
  )

  const bairroData = useMemo(() => {
    return (stats?.atualizacao_por_bairro ?? [])
      .filter((item) => item.total > 0)
      .map((item) => ({
        bairro: item.bairro_label,
        total: item.total,
        atualizados: item.atualizados,
        pendentes: item.pendentes,
        desatualizados: item.desatualizados,
        taxa: Math.round((item.atualizados / item.total) * 100),
      }))
  }, [stats])

  const bairroAtual = useMemo(
    () => bairroData.find((b) => b.bairro === bairroSelecionado) ?? bairroData[0] ?? null,
    [bairroData, bairroSelecionado],
  )

  const donutBairro = useMemo(() => {
    if (!bairroAtual) return []
    return [
      { name: "Atualizados", value: bairroAtual.atualizados, color: STATUS_META.ATUALIZADO.color, key: "at", status: "ATUALIZADO" },
      { name: "Pendentes", value: bairroAtual.pendentes, color: STATUS_META.PENDENTE.color, key: "pe", status: "PENDENTE" },
      { name: "Desatualizados", value: bairroAtual.desatualizados, color: STATUS_META.DESATUALIZADO.color, key: "de", status: "DESATUALIZADO" },
    ].filter((d) => d.value > 0)
  }, [bairroAtual])

  if (loading) return <DashboardSkeleton />

  if (!stats) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
        Não foi possível carregar os dados do dashboard.
      </div>
    )
  }

  const atualizados = stats.cidadaos_por_status.find((item) => item.status_atualizacao === "ATUALIZADO")?.total ?? 0
  const taxa = stats.total_cidadaos ? Math.round((atualizados / stats.total_cidadaos) * 100) : 0
  const VALORES_NAO_INFORMADO = ["", "-", "--", "NAO INFORMADO", "NAO_INFORMADO", "N/I", "NI", "NULL", "NONE"]
  const generoTotais = (stats.cidadaos_por_genero ?? []).reduce(
    (acc, item) => {
      const valor = (item.identidade_genero ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim()
      if (VALORES_NAO_INFORMADO.includes(valor)) acc.naoInformado += item.total
      else if (valor.includes("FEMIN") || valor.includes("MULHER")) acc.mulheres += item.total
      else if (valor.includes("MASC") || valor.includes("HOMEM")) acc.homens += item.total
      else acc.outros += item.total
      return acc
    },
    { homens: 0, mulheres: 0, outros: 0, naoInformado: 0 },
  )

  const cards = [
    {
      title: "Total de Cidadãos",
      value: formatNumber(stats.total_cidadaos),
      icon: Users,
      gradient: "from-blue-500 to-blue-600",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Atualizados Hoje",
      value: formatNumber(stats.atualizados_hoje),
      subtitle: "cadastros movimentados hoje",
      icon: CalendarCheck2,
      gradient: "from-cyan-500 to-emerald-500",
      iconBg: "bg-cyan-100 dark:bg-cyan-900/30",
      iconColor: "text-cyan-600 dark:text-cyan-400",
    },
    {
      title: "Benefícios",
      value: formatNumber(stats.total_beneficios),
      icon: Gift,
      gradient: "from-emerald-500 to-emerald-600",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Beneficiários",
      value: formatNumber(stats.total_beneficiarios),
      icon: BadgeCheck,
      gradient: "from-violet-500 to-violet-600",
      iconBg: "bg-violet-100 dark:bg-violet-900/30",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      title: "Taxa de Atualização",
      value: `${taxa}%`,
      subtitle: `${formatNumber(atualizados)} de ${formatNumber(stats.total_cidadaos)} atualizados`,
      icon: TrendingUp,
      gradient: taxa > 50 ? "from-emerald-500 to-emerald-600" : "from-amber-500 to-amber-600",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
  ]

  const perfilLinhas = [
    { label: "Homens", valor: generoTotais.homens, icon: User, color: "text-sky-600 dark:text-sky-400" },
    { label: "Mulheres", valor: generoTotais.mulheres, icon: UserRound, color: "text-pink-600 dark:text-pink-400" },
    { label: "Outros", valor: generoTotais.outros, icon: Users, color: "text-violet-600 dark:text-violet-400" },
    { label: "Não informaram", valor: generoTotais.naoInformado, icon: UserMinus, color: "text-slate-500 dark:text-slate-400" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do Tefé Social</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.title} size="sm" className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-[0.04]`} />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconBg}`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
              {"subtitle" in card && card.subtitle && <p className="mt-1 text-xs text-muted-foreground">{card.subtitle}</p>}
            </CardContent>
          </Card>
        ))}

        <Card size="sm" className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sexo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-3 gap-y-2">
            {perfilLinhas.map((linha) => (
              <div key={linha.label} title={linha.label} className="flex items-center gap-1.5">
                <linha.icon className={`h-4 w-4 shrink-0 ${linha.color}`} />
                <span className="flex-1 truncate text-xs text-muted-foreground">{linha.label}</span>
                <span className="text-base font-semibold">{formatNumber(linha.valor)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              Status dos Cidadãos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                Nenhum dado disponível
              </div>
            ) : (
              <div className="grid items-center gap-6 md:grid-cols-2">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={125}
                      paddingAngle={5}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="var(--background)"
                      animationBegin={100}
                      animationDuration={900}
                      className="cursor-pointer outline-none"
                      onClick={(_, index) => {
                        const entry = pieData[index]
                        abrirModal({ status: entry.key, titulo: `Cidadãos — ${entry.name}`, cor: entry.color })
                      }}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <ReTooltip content={<PieTooltip />} />
                    <text x="50%" y="46%" textAnchor="middle" className="fill-foreground" style={{ fontSize: 30, fontWeight: 800 }}>
                      {formatNumber(stats.total_cidadaos)}
                    </text>
                    <text x="50%" y="57%" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 12 }}>
                      cidadãos
                    </text>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {pieData.map((entry) => {
                    const pct = stats.total_cidadaos ? Math.round((entry.value / stats.total_cidadaos) * 100) : 0
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => abrirModal({ status: entry.key, titulo: `Cidadãos — ${entry.name}`, cor: entry.color })}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card/50 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 hover:ring-1 hover:ring-inset hover:ring-foreground/15"
                        title={`Ver ${entry.name.toLowerCase()}s`}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <div className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                          <span className="text-muted-foreground">{entry.name}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold">{formatNumber(entry.value)}</span>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              Atualizados por Mês
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatNumber(totalAtualizacoesMes)} atualizações no período
            </p>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} dy={6} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} dx={-4} />
                  <ReTooltip content={<ChartTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.3 }} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#areaGradient)"
                    dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    animationBegin={200}
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Taxa de atualização por bairro
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Selecione um bairro para ver o percentual de cadastros atualizados.
            </p>
          </div>
          <Popover open={bairroOpen} onOpenChange={setBairroOpen}>
            <PopoverTrigger
              className="flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm font-normal sm:w-72"
            >
              {bairroAtual ? (
                <span className="flex items-center gap-2 truncate">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: corTaxa(bairroAtual.taxa) }} />
                  <span className="truncate">{bairroAtual.bairro}</span>
                  <span className="font-semibold" style={{ color: corTaxa(bairroAtual.taxa) }}>{bairroAtual.taxa}%</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Selecione…</span>
              )}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-80 w-(--anchor-width) min-w-72 gap-1 overflow-y-auto p-1">
              {bairroData.map((b) => {
                const cor = corTaxa(b.taxa)
                const ativo = b.bairro === bairroAtual?.bairro
                return (
                  <button
                    key={b.bairro}
                    type="button"
                    onClick={() => {
                      setBairroSelecionado(b.bairro)
                      setBairroOpen(false)
                    }}
                    className={`relative flex w-full items-center justify-between gap-2 overflow-hidden rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60 ${ativo ? "ring-1 ring-inset ring-foreground/15" : ""}`}
                    style={{ background: `linear-gradient(90deg, ${corTaxaFill(b.taxa)} ${b.taxa}%, transparent ${b.taxa}%)` }}
                  >
                    <span className="truncate font-medium">{b.bairro}</span>
                    <span className="shrink-0 font-semibold tabular-nums" style={{ color: cor }}>{b.taxa}%</span>
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent>
          {!bairroAtual ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              Nenhum dado disponível
            </div>
          ) : (
            <div className="grid items-center gap-6 md:grid-cols-2">
              <div className="relative">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={donutBairro}
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={115}
                      paddingAngle={4}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="var(--background)"
                      animationDuration={700}
                      className="cursor-pointer outline-none"
                      onClick={(_, index) => {
                        const entry = donutBairro[index]
                        abrirModal({ status: entry.status, bairro: bairroAtual.bairro, titulo: `${bairroAtual.bairro} — ${entry.name}`, cor: entry.color })
                      }}
                    >
                      {donutBairro.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <ReTooltip content={<PieTooltip />} />
                    <text x="50%" y="46%" textAnchor="middle" className="fill-foreground" style={{ fontSize: 34, fontWeight: 800 }}>
                      {bairroAtual.taxa}%
                    </text>
                    <text x="50%" y="57%" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 12 }}>
                      atualizados
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Bairro/Localidade</p>
                  <p className="text-lg font-semibold">{bairroAtual.bairro}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => abrirModal({ bairro: bairroAtual.bairro, titulo: `${bairroAtual.bairro} — Todos` })}
                    className="rounded-xl border bg-card/50 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 hover:ring-1 hover:ring-inset hover:ring-foreground/15"
                  >
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="mt-0.5 text-lg font-bold">{formatNumber(bairroAtual.total)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirModal({ status: "ATUALIZADO", bairro: bairroAtual.bairro, titulo: `${bairroAtual.bairro} — Atualizados`, cor: STATUS_META.ATUALIZADO.color })}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-left transition-colors hover:bg-emerald-500/10 hover:ring-1 hover:ring-inset hover:ring-emerald-500/30"
                  >
                    <p className="text-xs text-muted-foreground">Atualizados</p>
                    <p className="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(bairroAtual.atualizados)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirModal({ status: "PENDENTE", bairro: bairroAtual.bairro, titulo: `${bairroAtual.bairro} — Pendentes`, cor: STATUS_META.PENDENTE.color })}
                    className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5 text-left transition-colors hover:bg-yellow-500/10 hover:ring-1 hover:ring-inset hover:ring-yellow-500/30"
                  >
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                    <p className="mt-0.5 text-lg font-bold text-yellow-600 dark:text-yellow-400">{formatNumber(bairroAtual.pendentes)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirModal({ status: "DESATUALIZADO", bairro: bairroAtual.bairro, titulo: `${bairroAtual.bairro} — Desatualizados`, cor: STATUS_META.DESATUALIZADO.color })}
                    className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2.5 text-left transition-colors hover:bg-rose-500/10 hover:ring-1 hover:ring-inset hover:ring-rose-500/30"
                  >
                    <p className="text-xs text-muted-foreground">Desatualizados</p>
                    <p className="mt-0.5 text-lg font-bold text-rose-600 dark:text-rose-400">{formatNumber(bairroAtual.desatualizados)}</p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: lista de cidadãos (status e/ou bairro), com buscador */}
      <Dialog open={modalAberto} onOpenChange={(open) => { if (!open) setModalAberto(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalCor && (
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: modalCor }} />
              )}
              {modalTitulo}
              <span className="text-sm font-normal text-muted-foreground">
                ({formatNumber(modalCidadaos.length)})
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar por nome ou NIS…"
              value={modalBusca}
              onChange={(e) => setModalBusca(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-md border">
            {modalLoading ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : modalFiltrados.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                {modalCidadaos.length === 0 ? "Nenhum cidadão neste status." : "Nenhum resultado para a busca."}
              </div>
            ) : (
              <ul className="divide-y">
                {modalFiltrados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { setModalAberto(false); router.push(`/cidadaos/${c.id}`) }}
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                    >
                      <span className="text-sm font-medium">{c.nome}</span>
                      <span className="text-xs text-muted-foreground">{enderecoResumo(c)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
