"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchAllCidadaos, fetchAllBeneficiarios, fetchAllBeneficios, hasCachedKey } from "@/lib/api"
import type { Cidadao, Beneficiario, Beneficio } from "@/types"
import { format } from "date-fns"
import { Download, FileSpreadsheet, FileText, Loader2, RotateCcw, Search } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

type SituationFilter = "todos" | "Aprovado" | "Em análise" | "Reprovado"
type UpdateFilter = "todos" | "ATUALIZADO" | "DESATUALIZADO" | "PENDENTE"
type PeriodField = "data_cadastro" | "data_atualizacao" | "data_solicitacao"
type QuickReportType = "cidadaos" | "beneficiarios" | "beneficios"

type ReportRow = {
  nome: string
  cpf: string
  data_nascimento: string
  nis: string
  telefone: string
  sexo: string
  beneficio: string
  situacao_beneficiario: string
  status_atualizacao: string
  localidade: string
  logradouro: string
  numero_residencia: string
  complemento: string
  responsavel_cadastro: string
  responsavel_atualizacao: string
  data_cadastro: string
  data_atualizacao: string
  data_solicitacao: string
}

type ColumnKey = keyof ReportRow
type AppliedFilters = {
  beneficioId: string
  situacao: SituationFilter
  statusAtualizacao: UpdateFilter
  sexo: string
  localidade: string
  logradouro: string
  responsavel: string
  periodField: PeriodField
  dataInicial: string
  dataFinal: string
  search: string
}

const pageSize = 20
const previewLimit = 500

const defaultColumns: ColumnKey[] = [
  "nome",
  "cpf",
  "data_nascimento",
  "status_atualizacao",
  "beneficio",
  "situacao_beneficiario",
]

const columns: { key: ColumnKey; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "cpf", label: "CPF" },
  { key: "data_nascimento", label: "Data de nascimento" },
  { key: "sexo", label: "Sexo" },
  { key: "nis", label: "NIS" },
  { key: "telefone", label: "Telefone" },
  { key: "beneficio", label: "Benefício" },
  { key: "situacao_beneficiario", label: "Situação do beneficiário" },
  { key: "status_atualizacao", label: "Status da atualização" },
  { key: "localidade", label: "Localidade/Bairro/Comunidade/Distrito" },
  { key: "logradouro", label: "Logradouro/Rua" },
  { key: "numero_residencia", label: "Número da residência" },
  { key: "complemento", label: "Complemento" },
  { key: "responsavel_cadastro", label: "Responsável pelo cadastro" },
  { key: "responsavel_atualizacao", label: "Responsável pela atualização" },
  { key: "data_cadastro", label: "Data de cadastro" },
  { key: "data_atualizacao", label: "Data da última atualização" },
  { key: "data_solicitacao", label: "Data de vínculo/solicitação do benefício" },
]

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "-"
  return String(value)
}

function formatDate(value?: string | null) {
  if (!value) return ""
  try {
    return format(new Date(value), "dd/MM/yyyy")
  } catch {
    return value
  }
}

function getCpf(cidadao: Cidadao, beneficiario?: Beneficiario) {
  return cidadao.documentos?.cpf || beneficiario?.cpf || ""
}

function getLocalidade(cidadao: Cidadao) {
  return (
    cidadao.endereco?.bairro ||
    cidadao.endereco?.comunidade_localidade ||
    cidadao.endereco?.distrito ||
    ""
  )
}

function getSituacaoLabel(status?: string | null) {
  const normalized = normalize(status)
  if (normalized.includes("aprov")) return "Aprovado"
  if (normalized.includes("analise") || normalized.includes("pend")) return "Em análise"
  if (normalized.includes("reprov") || normalized.includes("negad")) return "Reprovado"
  return status || ""
}

function getSexoLabel(cidadao: Cidadao) {
  return cidadao.identidade_genero?.trim() || ""
}

function getStatusAtualizacaoKey(status?: string | null): Exclude<UpdateFilter, "todos"> | "" {
  const normalized = normalize(status)
  if (normalized.includes("desatualizado")) return "DESATUALIZADO"
  if (normalized.includes("pendente")) return "PENDENTE"
  if (normalized.includes("atualizado")) return "ATUALIZADO"
  return ""
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"))
}

function buildGeneralRow(cidadao: Cidadao, vinculos: Beneficiario[]): ReportRow {
  return {
    nome: cidadao.nome,
    cpf: getCpf(cidadao, vinculos[0]),
    data_nascimento: formatDate(cidadao.data_nascimento),
    sexo: getSexoLabel(cidadao),
    nis: cidadao.nis || vinculos[0]?.nis || "",
    telefone: cidadao.telefone || "",
    beneficio: uniqueSorted(vinculos.map((v) => v.beneficio_nome || "")).join(", "),
    situacao_beneficiario: uniqueSorted(vinculos.map((v) => getSituacaoLabel(v.status))).join(", "),
    status_atualizacao: cidadao.status_atualizacao || "",
    localidade: getLocalidade(cidadao),
    logradouro: cidadao.endereco?.logradouro || "",
    numero_residencia: cidadao.endereco?.numero || "",
    complemento: cidadao.endereco?.complemento || "",
    responsavel_cadastro: "-",
    responsavel_atualizacao: "-",
    data_cadastro: formatDate(cidadao.criado_em),
    data_atualizacao: formatDate(cidadao.atualizado_em),
    data_solicitacao: uniqueSorted(vinculos.map((v) => formatDate(v.data_solicitacao))).join(", "),
  }
}

function buildBenefitRow(cidadao: Cidadao, vinculo: Beneficiario): ReportRow {
  return {
    ...buildGeneralRow(cidadao, [vinculo]),
    beneficio: vinculo.beneficio_nome || "",
    situacao_beneficiario: getSituacaoLabel(vinculo.status),
    data_solicitacao: formatDate(vinculo.data_solicitacao),
  }
}

export default function RelatoriosPage() {
  const [cidadaos, setCidadaos] = useState<Cidadao[]>([])
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([])
  const [beneficios, setBeneficios] = useState<Beneficio[]>([])
  const [loading, setLoading] = useState(() => {
    return !(hasCachedKey("cidadaos:all") && hasCachedKey("beneficiarios:all") && hasCachedKey("beneficios:all"))
  })
  const [exporting, setExporting] = useState(false)
  const [exportType, setExportType] = useState<"pdf" | "excel">("excel")
  const [reportType, setReportType] = useState<string>("")

  const [beneficioId, setBeneficioId] = useState("todos")
  const [situacao, setSituacao] = useState<SituationFilter>("todos")
  const [statusAtualizacao, setStatusAtualizacao] = useState<UpdateFilter>("todos")
  const [sexo, setSexo] = useState("todos")
  const [localidade, setLocalidade] = useState("todos")
  const [logradouro, setLogradouro] = useState("todos")
  const [responsavel, setResponsavel] = useState("todos")
  const [periodField, setPeriodField] = useState<PeriodField>("data_cadastro")
  const [dataInicial, setDataInicial] = useState("")
  const [dataFinal, setDataFinal] = useState("")
  const [search, setSearch] = useState("")
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(defaultColumns)
  const [page, setPage] = useState(1)
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      const allCached = hasCachedKey("cidadaos:all") && hasCachedKey("beneficiarios:all") && hasCachedKey("beneficios:all")
      if (!allCached) setLoading(true)

      try {
        const [cidadaosData, beneficiariosData, beneficiosData] = await Promise.all([
          fetchAllCidadaos(),
          fetchAllBeneficiarios(),
          fetchAllBeneficios(),
        ])
        if (!active) return
        setCidadaos(cidadaosData)
        setBeneficiarios(beneficiariosData)
        setBeneficios(beneficiosData)
      } catch {
        toast.error("Erro ao carregar dados dos relatórios")
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  const appliedBenefitId = appliedFilters?.beneficioId ?? "todos"

  const rows = useMemo(() => {
    const cidadaosById = new Map(cidadaos.map((cidadao) => [String(cidadao.id), cidadao]))
    const selectedBenefit = appliedBenefitId !== "todos"

    if (selectedBenefit) {
      return beneficiarios
        .filter((vinculo) => String(vinculo.beneficio_id) === appliedBenefitId)
        .map((vinculo) => {
          const cidadao = cidadaosById.get(String(vinculo.cidadao_id))
          return cidadao ? buildBenefitRow(cidadao, vinculo) : null
        })
        .filter((row): row is ReportRow => Boolean(row))
    }

    return cidadaos.map((cidadao) => {
      const vinculos = beneficiarios.filter((vinculo) => String(vinculo.cidadao_id) === String(cidadao.id))
      return buildGeneralRow(cidadao, vinculos)
    })
  }, [appliedBenefitId, beneficiarios, cidadaos])

  const localidades = useMemo(() => uniqueSorted(rows.map((row) => row.localidade)), [rows])
  const logradouros = useMemo(() => {
    const source = localidade === "todos" ? rows : rows.filter((row) => row.localidade === localidade)
    return uniqueSorted(source.map((row) => row.logradouro))
  }, [localidade, rows])
  const responsaveis = useMemo(
    () => uniqueSorted(rows.flatMap((row) => [row.responsavel_cadastro, row.responsavel_atualizacao]).filter((value) => value !== "-")),
    [rows],
  )

  const sexOptions = useMemo(() => uniqueSorted(rows.map((row) => row.sexo)), [rows])

  const filteredRows = useMemo(() => {
    if (!appliedFilters) return []

    return rows.filter((row) => {
      const periodValue = row[appliedFilters.periodField]
      const normalizedSituation = normalize(row.situacao_beneficiario)
      const statusMatch =
        appliedFilters.statusAtualizacao === "todos" ||
        getStatusAtualizacaoKey(row.status_atualizacao) === appliedFilters.statusAtualizacao

      return [
        appliedFilters.situacao === "todos" || normalizedSituation.includes(normalize(appliedFilters.situacao)),
        statusMatch,
        appliedFilters.localidade === "todos" || row.localidade === appliedFilters.localidade,
        appliedFilters.logradouro === "todos" || row.logradouro === appliedFilters.logradouro,
        appliedFilters.sexo === "todos" || normalize(row.sexo) === normalize(appliedFilters.sexo),
        appliedFilters.responsavel === "todos" || row.responsavel_cadastro === appliedFilters.responsavel || row.responsavel_atualizacao === appliedFilters.responsavel,
        !appliedFilters.dataInicial || Boolean(periodValue && periodValue.split("/").reverse().join("-") >= appliedFilters.dataInicial),
        !appliedFilters.dataFinal || Boolean(periodValue && periodValue.split("/").reverse().join("-") <= appliedFilters.dataFinal),
        !appliedFilters.search || normalize(`${row.nome} ${row.cpf} ${row.nis} ${row.telefone}`).includes(normalize(appliedFilters.search)),
      ].every(Boolean)
    })
  }, [appliedFilters, rows])

  const limitedRows = filteredRows.slice(0, previewLimit)
  const totalPages = Math.max(1, Math.ceil(limitedRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleRows = limitedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const visibleColumns = selectedColumns
    .map((key) => columns.find((column) => column.key === key))
    .filter((column): column is { key: ColumnKey; label: string } => Boolean(column))

  function resetFilters() {
    setBeneficioId("todos")
    setSituacao("todos")
    setStatusAtualizacao("todos")
    setSexo("todos")
    setLocalidade("todos")
    setLogradouro("todos")
    setResponsavel("todos")
    setPeriodField("data_cadastro")
    setDataInicial("")
    setDataFinal("")
    setSearch("")
    setSelectedColumns(defaultColumns)
    setAppliedFilters(null)
    setPage(1)
  }

  function searchReport() {
    setAppliedFilters({
      beneficioId,
      situacao,
      statusAtualizacao,
      sexo,
      localidade,
      logradouro,
      responsavel,
      periodField,
      dataInicial,
      dataFinal,
      search,
    })
    setPage(1)
  }

  function toggleColumn(column: ColumnKey) {
    setSelectedColumns((current) => {
      if (current.includes(column)) {
        return current.length === 1 ? current : current.filter((item) => item !== column)
      }
      return [...current, column]
    })
  }

  function exportFlexibleReport() {
    if (!appliedFilters) {
      toast.info("Clique em Buscar relatório antes de exportar")
      return
    }

    const exportRows = filteredRows.map((row) =>
      Object.fromEntries(visibleColumns.map((column) => [column.label, display(row[column.key])])),
    )
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Relatório")
    XLSX.writeFile(wb, `relatorio_flexivel_${format(new Date(), "yyyyMMdd")}.xlsx`)
  }

  const selectedBenefitName = appliedFilters?.beneficioId && appliedFilters.beneficioId !== "todos"
    ? beneficios.find((beneficio) => String(beneficio.id) === appliedFilters.beneficioId)?.nome || "Benefício selecionado"
    : "Todos / sem filtro"
  const updatedCount = filteredRows.filter((row) => getStatusAtualizacaoKey(row.status_atualizacao) === "ATUALIZADO").length
  const outdatedCount = filteredRows.filter((row) => getStatusAtualizacaoKey(row.status_atualizacao) === "DESATUALIZADO").length
  const pendingCount = filteredRows.filter((row) => getStatusAtualizacaoKey(row.status_atualizacao) === "PENDENTE").length

  const exportReport = async (type: QuickReportType, fmt: "pdf" | "excel") => {
    setExporting(true)
    setExportType(fmt)
    setReportType(type)
    try {
      if (type === "cidadaos") {
        const data = await fetchAllCidadaos()
        if (fmt === "excel") {
          const rows = data.map((c: Cidadao) => ({
            Nome: c.nome,
            NIS: c.nis || "",
            Email: c.email || "",
            Telefone: c.telefone || "",
            "Data Nascimento": c.data_nascimento || "",
            Status: c.status_atualizacao,
            "Criado em": c.criado_em ? format(new Date(c.criado_em), "dd/MM/yyyy") : "",
          }))
          const ws = XLSX.utils.json_to_sheet(rows)
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, "Cidadãos")
          XLSX.writeFile(wb, `relatorio_cidadaos_${format(new Date(), "yyyyMMdd")}.xlsx`)
        } else {
          const doc = new jsPDF("landscape")
          doc.text("Relatório de Cidadãos", 14, 15)
          const rows = data.map((c: Cidadao) => [c.nome, c.nis || "", c.email || "", c.telefone || "", c.status_atualizacao])
          autoTable(doc, {
            head: [["Nome", "NIS", "Email", "Telefone", "Status"]],
            body: rows,
            startY: 25,
            styles: { fontSize: 8 },
          })
          doc.save(`relatorio_cidadaos_${format(new Date(), "yyyyMMdd")}.pdf`)
        }
      } else if (type === "beneficiarios") {
        const data = await fetchAllBeneficiarios()
        if (fmt === "excel") {
          const rows = data.map((b: Beneficiario) => ({
            Cidadão: b.cidadao_nome || "",
            Benefício: b.beneficio_nome || "",
            Status: b.status,
            "Valor Recebido": b.valor_recebido ? `R$ ${Number(b.valor_recebido).toFixed(2)}` : "",
            "Data Solicitação": b.data_solicitacao ? format(new Date(b.data_solicitacao), "dd/MM/yyyy") : "",
          }))
          const ws = XLSX.utils.json_to_sheet(rows)
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, "Beneficiários")
          XLSX.writeFile(wb, `relatorio_beneficiarios_${format(new Date(), "yyyyMMdd")}.xlsx`)
        } else {
          const doc = new jsPDF("landscape")
          doc.text("Relatório de Beneficiários", 14, 15)
          const rows = data.map((b: Beneficiario) => [b.cidadao_nome || "", b.beneficio_nome || "", b.status, b.valor_recebido ? `R$ ${Number(b.valor_recebido).toFixed(2)}` : ""])
          autoTable(doc, {
            head: [["Cidadão", "Benefício", "Status", "Valor"]],
            body: rows,
            startY: 25,
          })
          doc.save(`relatorio_beneficiarios_${format(new Date(), "yyyyMMdd")}.pdf`)
        }
      } else {
        const data = await fetchAllBeneficios()
        if (fmt === "excel") {
          const rows = data.map((b: Beneficio) => ({
            Nome: b.nome,
            Descrição: b.descricao,
            Ativo: b.ativo ? "Sim" : "Não",
            "Criado em": b.criado_em ? format(new Date(b.criado_em), "dd/MM/yyyy") : "",
          }))
          const ws = XLSX.utils.json_to_sheet(rows)
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, "Benefícios")
          XLSX.writeFile(wb, `relatorio_beneficios_${format(new Date(), "yyyyMMdd")}.xlsx`)
        } else {
          const doc = new jsPDF()
          doc.text("Relatório de Benefícios", 14, 15)
          const rows = data.map((b: Beneficio) => [b.nome, b.descricao?.slice(0, 60) || "", b.ativo ? "Sim" : "Não"])
          autoTable(doc, {
            head: [["Nome", "Descrição", "Ativo"]],
            body: rows,
            startY: 25,
          })
          doc.save(`relatorio_beneficios_${format(new Date(), "yyyyMMdd")}.pdf`)
        }
      }
      toast.success("Relatório exportado com sucesso!")
    } catch {
      toast.error("Erro ao exportar relatório")
    } finally {
      setExporting(false)
      setReportType("")
    }
  }

  const reports: {
    key: QuickReportType
    title: string
    desc: string
    icon: typeof FileText
  }[] = [
    {
      key: "cidadaos",
      title: "Cidadãos",
      desc: "Relatório completo de todos os cidadãos cadastrados com dados pessoais e status de atualização.",
      icon: FileText,
    },
    {
      key: "beneficiarios",
      title: "Beneficiários",
      desc: "Lista de todos os beneficiários com vínculos, status de aprovação e valores recebidos.",
      icon: FileSpreadsheet,
    },
    {
      key: "beneficios",
      title: "Benefícios",
      desc: "Catálogo de todos os benefícios disponíveis e seus status de atividade.",
      icon: FileText,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Gere listas gerais de cidadãos ou relatórios específicos por benefício.
        </p>
      </div>

      <Tabs defaultValue="flexivel">
        <TabsList>
          <TabsTrigger value="flexivel">Relatório flexível</TabsTrigger>
          <TabsTrigger value="exportar">Exportações rápidas</TabsTrigger>
        </TabsList>

        <TabsContent value="flexivel" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros do relatório</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-2 text-sm font-medium">
                  Benefício
                  <select className="h-10 rounded-md border bg-background px-3 font-normal" value={beneficioId} onChange={(event) => { setBeneficioId(event.target.value); setPage(1) }}>
                    <option value="todos">Todos / sem filtro de benefício</option>
                    {beneficios.map((beneficio) => (
                      <option key={beneficio.id} value={beneficio.id}>{beneficio.nome}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Situação do beneficiário
                  <select className="h-10 rounded-md border bg-background px-3 font-normal" value={situacao} onChange={(event) => { setSituacao(event.target.value as SituationFilter); setPage(1) }}>
                    <option value="todos">Todos</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Em análise">Em análise</option>
                    <option value="Reprovado">Reprovado</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Status de atualização
                  <select className="h-10 rounded-md border bg-background px-3 font-normal" value={statusAtualizacao} onChange={(event) => { setStatusAtualizacao(event.target.value as UpdateFilter); setPage(1) }}>
                    <option value="todos">Todos</option>
                    <option value="ATUALIZADO">ATUALIZADO</option>
                    <option value="DESATUALIZADO">DESATUALIZADO</option>
                    <option value="PENDENTE">PENDENTE</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Sexo
                  <select className="h-10 rounded-md border bg-background px-3 font-normal" value={sexo} onChange={(event) => { setSexo(event.target.value); setPage(1) }}>
                    <option value="todos">Todos</option>
                    {sexOptions.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Busca
                  <input className="h-10 rounded-md border bg-background px-3 font-normal" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Nome, CPF, NIS ou telefone" />
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Localidade
                  <select className="h-10 rounded-md border bg-background px-3 font-normal" value={localidade} onChange={(event) => { setLocalidade(event.target.value); setLogradouro("todos"); setPage(1) }}>
                    <option value="todos">Todas</option>
                    {localidades.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Logradouro/Rua
                  <select className="h-10 rounded-md border bg-background px-3 font-normal" value={logradouro} onChange={(event) => { setLogradouro(event.target.value); setPage(1) }}>
                    <option value="todos">Todos</option>
                    {logradouros.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Responsável
                  <select className="h-10 rounded-md border bg-background px-3 font-normal" value={responsavel} onChange={(event) => { setResponsavel(event.target.value); setPage(1) }}>
                    <option value="todos">Todos</option>
                    {responsaveis.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Período baseado em
                  <select className="h-10 rounded-md border bg-background px-3 font-normal" value={periodField} onChange={(event) => { setPeriodField(event.target.value as PeriodField); setPage(1) }}>
                    <option value="data_cadastro">Data de cadastro</option>
                    <option value="data_atualizacao">Data da última atualização</option>
                    <option value="data_solicitacao">Data de vínculo/solicitação</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Data inicial
                  <input className="h-10 rounded-md border bg-background px-3 font-normal" type="date" value={dataInicial} onChange={(event) => { setDataInicial(event.target.value); setPage(1) }} />
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Data final
                  <input className="h-10 rounded-md border bg-background px-3 font-normal" type="date" value={dataFinal} onChange={(event) => { setDataFinal(event.target.value); setPage(1) }} />
                </label>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Colunas exibidas e exportadas</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {columns.map((column) => (
                    <label key={column.key} className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm">
                      <input type="checkbox" checked={selectedColumns.includes(column.key)} onChange={() => toggleColumn(column.key)} />
                      {column.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button disabled={loading} onClick={searchReport}>
                  <Search className="w-4 h-4 mr-2" />
                  Buscar relatório
                </Button>
                <Button disabled={!appliedFilters || loading || filteredRows.length === 0} onClick={exportFlexibleReport}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Excel/XLSX
                </Button>
                <Button variant="outline" onClick={resetFilters}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Limpar filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Visualização em tela
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Carregando dados..."
                  : appliedFilters
                    ? `${filteredRows.length} registro(s) encontrado(s) para os filtros buscados.`
                    : "Escolha os filtros e clique em Buscar relatório."}
                {appliedFilters && filteredRows.length > previewLimit ? ` Prévia limitada a ${previewLimit} registros.` : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Quantidade encontrada</p>
                  <p className="mt-1 text-2xl font-semibold">{appliedFilters ? filteredRows.length : "-"}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Benefício buscado</p>
                  <p className="mt-1 truncate text-sm font-medium">{appliedFilters ? selectedBenefitName : "-"}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Atualizados</p>
                  <p className="mt-1 text-2xl font-semibold">{appliedFilters ? updatedCount : "-"}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Desatualizados</p>
                  <p className="mt-1 text-2xl font-semibold">{appliedFilters ? outdatedCount : "-"}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="mt-1 text-2xl font-semibold">{appliedFilters ? pendingCount : "-"}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {visibleColumns.map((column) => (
                        <th key={column.key} className="whitespace-nowrap px-3 py-2 text-left font-medium">{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, index) => (
                      <tr key={`${row.cpf}-${row.beneficio}-${index}`} className="border-t">
                        {visibleColumns.map((column) => (
                          <td key={column.key} className="whitespace-nowrap px-3 py-2">{display(row[column.key])}</td>
                        ))}
                      </tr>
                    ))}
                    {!loading && !appliedFilters && (
                      <tr>
                        <td className="px-3 py-8 text-center text-muted-foreground" colSpan={visibleColumns.length}>Nenhuma busca realizada ainda.</td>
                      </tr>
                    )}
                    {!loading && appliedFilters && visibleRows.length === 0 && (
                      <tr>
                        <td className="px-3 py-8 text-center text-muted-foreground" colSpan={visibleColumns.length}>Nenhum registro encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Próxima</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exportar" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <Card key={report.key}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <report.icon className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-base">{report.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{report.desc}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      disabled={exporting && reportType === report.key && exportType === "excel"}
                      onClick={() => exportReport(report.key, "excel")}
                    >
                      {exporting && reportType === report.key && exportType === "excel" ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={exporting && reportType === report.key && exportType === "pdf"}
                      onClick={() => exportReport(report.key, "pdf")}
                    >
                      {exporting && reportType === report.key && exportType === "pdf" ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
