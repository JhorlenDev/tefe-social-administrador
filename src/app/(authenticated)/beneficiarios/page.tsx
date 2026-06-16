"use client"

import { useCallback, useEffect, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import DataTable from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fetchBeneficiarios, updateBeneficiarioStatus, hasCachedData } from "@/lib/api"
import type { Beneficiario, PaginatedResponse } from "@/types"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Check, X, Clock, MoreHorizontal } from "lucide-react"

const statusBadge = (status: string) => {
  const map: Record<string, { class: string; icon: any }> = {
    EM_ANALISE: { class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
    APROVADO: { class: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: Check },
    REPROVADO: { class: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: X },
  }
  const m = map[status] || { class: "" }
  return <Badge className={m.class}>{status?.replace("_", " ")}</Badge>
}

export default function BeneficiariosPage() {
  const [data, setData] = useState<PaginatedResponse<Beneficiario> | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(() => !hasCachedData("beneficiarios", { page: "1", page_size: "20" }))
  const [statusFilter, setStatusFilter] = useState("")

  const load = useCallback(async () => {
    const params: Record<string, string> = { page: String(page), page_size: "20" }
    if (statusFilter) params.status = statusFilter

    if (!hasCachedData("beneficiarios", params)) {
      setLoading(true)
    }

    try {
      const result = await fetchBeneficiarios(params)
      setData(result)
    } catch { toast.error("Erro ao carregar beneficiários") }
    finally { setLoading(false) }
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateBeneficiarioStatus(id, status)
      toast.success(`Status atualizado para ${status}`)
      load()
    } catch { toast.error("Erro ao atualizar status") }
  }

  const columns: ColumnDef<Beneficiario>[] = [
    { accessorKey: "cidadao_nome", header: "Cidadão" },
    { accessorKey: "beneficio_nome", header: "Benefício" },
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Beneficiários</h1>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? ""); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">Todos</SelectItem>
            <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
            <SelectItem value="APROVADO">Aprovado</SelectItem>
            <SelectItem value="REPROVADO">Reprovado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={data?.results ?? []} searchKey="cidadao_nome" searchPlaceholder="Buscar por cidadão..." loading={loading} />

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" disabled={!data?.previous || loading} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
        <span className="text-sm text-muted-foreground">Página {page}</span>
        <Button variant="outline" disabled={!data?.next || loading} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
      </div>
    </div>
  )
}
