"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import DataTable from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { fetchAllBeneficiarios, fetchAllBeneficios, fetchAllCidadaos, fetchBeneficiarios, updateBeneficiarioStatus, hasCachedData } from "@/lib/api"
import type { Beneficiario, Beneficio, Cidadao, PaginatedResponse } from "@/types"
import { BeneficioIcon } from "@/lib/beneficio-icons"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Check, X, Clock, MoreHorizontal, UserCheck, UserX, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const statusBadge = (status: string) => {
  const map: Record<string, { class: string; icon: LucideIcon }> = {
    EM_ANALISE: { class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
    APROVADO: { class: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: Check },
    REPROVADO: { class: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: X },
  }
  const m = map[status] || { class: "" }
  const Icon = "icon" in m ? m.icon : Clock
  return (
    <Badge className={m.class}>
      <Icon className="h-3 w-3" />
      {status?.replace("_", " ")}
    </Badge>
  )
}

export default function BeneficiariosPage() {
  const [data, setData] = useState<PaginatedResponse<Beneficiario> | null>(null)
  const [cidadaos, setCidadaos] = useState<Cidadao[]>([])
  const [todosBeneficiarios, setTodosBeneficiarios] = useState<Beneficiario[]>([])
  const [beneficios, setBeneficios] = useState<Beneficio[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(() => !hasCachedData("beneficiarios", { page: "1", page_size: "20" }))
  const [beneficioFilter, setBeneficioFilter] = useState("todos")

  const load = useCallback(async () => {
    const params: Record<string, string> = { page: String(page), page_size: "20" }
    if (beneficioFilter !== "todos") params.beneficio_id = beneficioFilter

    if (!hasCachedData("beneficiarios", params)) {
      setLoading(true)
    }

    try {
      const result = await fetchBeneficiarios(params)
      setData(result)
    } catch { toast.error("Erro ao carregar beneficiários") }
    finally { setLoading(false) }
  }, [beneficioFilter, page])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load()
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [load])

  useEffect(() => {
    let active = true
    fetchAllBeneficios()
      .then((beneficiosResult) => {
        if (active) setBeneficios(beneficiosResult)
      })
      .catch(() => toast.error("Erro ao carregar benefícios"))

    const timeoutId = window.setTimeout(() => {
      Promise.all([fetchAllBeneficiarios(), fetchAllCidadaos()])
        .then(([beneficiariosResult, cidadaosResult]) => {
          if (!active) return
          setTodosBeneficiarios(beneficiariosResult)
          setCidadaos(cidadaosResult)
        })
        .catch(() => toast.error("Erro ao carregar resumo"))
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [])

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateBeneficiarioStatus(id, status)
      toast.success(`Status atualizado para ${status}`)
      setTodosBeneficiarios((current) =>
        current.map((item) => (item.id === id ? { ...item, status } : item)),
      )
      load()
    } catch { toast.error("Erro ao atualizar status") }
  }

  const selectedBenefitName = useMemo(() => {
    if (beneficioFilter === "todos") return "Todos os benefícios"
    return beneficios.find((beneficio) => String(beneficio.id) === beneficioFilter)?.nome ?? "Benefício"
  }, [beneficioFilter, beneficios])

  const selectedBenefitIcon = useMemo(() => {
    if (beneficioFilter === "todos") return undefined
    return beneficios.find((beneficio) => String(beneficio.id) === beneficioFilter)?.icone
  }, [beneficioFilter, beneficios])

  const resumo = useMemo(() => {
    const source = todosBeneficiarios.length > 0 ? todosBeneficiarios : (data?.results ?? [])
    const filtered = beneficioFilter === "todos"
      ? source
      : source.filter((item) => String(item.beneficio_id) === beneficioFilter)
    const cidadaosComBeneficio = new Set(source.map((item) => String(item.cidadao_id)))
    const cidadaosFiltrados = new Set(filtered.map((item) => String(item.cidadao_id)))

    return {
      totalCidadaos: cidadaos.length,
      semBeneficio: cidadaos.filter((cidadao) => !cidadaosComBeneficio.has(String(cidadao.id))).length,
      cidadaosVinculados: cidadaosFiltrados.size,
    }
  }, [beneficioFilter, cidadaos, data, todosBeneficiarios])

  const columns: ColumnDef<Beneficiario>[] = [
    { accessorKey: "cidadao_nome", header: "Cidadão" },
    { accessorKey: "beneficio_nome", header: "Benefício", cell: ({ row }) => {
      const beneficio = beneficios.find((item) => String(item.id) === String(row.original.beneficio_id))
      return (
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BeneficioIcon value={beneficio?.icone} className="h-4 w-4" />
          </span>
          <span className="truncate">{row.original.beneficio_nome}</span>
        </span>
      )
    } },
    { accessorKey: "status", header: "Status", cell: ({ row }) => statusBadge(row.original.status) },
    { accessorKey: "valor_recebido", header: "Valor", cell: ({ row }) => row.original.valor_recebido ? `R$ ${Number(row.original.valor_recebido).toFixed(2)}` : "-" },
    { accessorKey: "data_solicitacao", header: "Solicitação", cell: ({ row }) => row.original.data_solicitacao ? format(new Date(row.original.data_solicitacao), "dd/MM/yyyy") : "-" },
    { id: "actions", cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
          <MoreHorizontal className="w-4 h-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleStatusUpdate(row.original.id, "APROVADO")}>
            <Check className="w-4 h-4 mr-2 text-green-600" /> Aprovar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusUpdate(row.original.id, "REPROVADO")}>
            <X className="w-4 h-4 mr-2 text-red-600" /> Reprovar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )},
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Beneficiários</h1>
        <p className="text-sm text-muted-foreground">
          Consulte vínculos por benefício e acompanhe a cobertura dos cidadãos.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.results ?? []}
        searchKey="cidadao_nome"
        searchLabel="Buscar"
        searchPlaceholder="Buscar por cidadão..."
        loading={loading}
        toolbarEnd={
          <div className="flex flex-1 flex-col gap-3 xl:flex-row xl:items-end">
            <label className="grid w-full gap-1.5 text-sm font-medium sm:w-72">
              Benefício
              <Select value={beneficioFilter} onValueChange={(v) => { setBeneficioFilter(v ?? "todos"); setPage(1) }}>
                <SelectTrigger className="h-10 w-full justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    <BeneficioIcon value={selectedBenefitIcon} className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{selectedBenefitName}</span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os benefícios</SelectItem>
                  {beneficios.map((beneficio) => (
                  <SelectItem key={beneficio.id} value={beneficio.id}>
                    <BeneficioIcon value={beneficio.icone} className="h-4 w-4 text-muted-foreground" />
                    {beneficio.nome}
                  </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex h-10 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 font-medium text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
                <Users className="h-4 w-4" />
                Total de cidadãos: {resumo.totalCidadaos}
              </span>
              <span className="inline-flex h-10 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 font-medium text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                <UserX className="h-4 w-4" />
                Sem benefício: {resumo.semBeneficio}
              </span>
              <span className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 font-medium text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                <UserCheck className="h-4 w-4" />
                {beneficioFilter === "todos" ? "Vinculados a algum benefício" : "Vinculados a este benefício"}: {resumo.cidadaosVinculados}
              </span>
            </div>
          </div>
        }
      />

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" disabled={!data?.previous || loading} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
        <span className="text-sm text-muted-foreground">Página {page}</span>
        <Button variant="outline" disabled={!data?.next || loading} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
      </div>
    </div>
  )
}
