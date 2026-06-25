"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import DataTable from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchCidadaos, deleteCidadao, hasCachedData } from "@/lib/api"
import { formatDateBR, formatPhone } from "@/lib/formatters"
import type { Cidadao, PaginatedResponse } from "@/types"
import { format } from "date-fns"
import { MoreHorizontal, Eye, Trash2, Download } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    PENDENTE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    ATUALIZADO: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    DESATUALIZADO: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  }
  return <Badge className={map[status] || ""}>{status}</Badge>
}

export default function CidadaosPage() {
  const router = useRouter()
  const [data, setData] = useState<PaginatedResponse<Cidadao> | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(() => !hasCachedData("cidadaos", { page: "1", page_size: "20" }))
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    const params: Record<string, string> = { page: String(page), page_size: "20" }
    if (search.trim()) params.search = search.trim()
    if (statusFilter !== "todos") params.status_atualizacao = statusFilter

    if (!hasCachedData("cidadaos", params)) {
      setLoading(true)
    }

    try {
      const result = await fetchCidadaos(params)
      setData(result)
    } catch {
      toast.error("Erro ao carregar cidadãos")
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load()
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [load])

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${nome}"?`)) return
    try {
      await deleteCidadao(id)
      toast.success("Cidadão excluído")
      load()
    } catch {
      toast.error("Erro ao excluir cidadão")
    }
  }

  const exportToExcel = async () => {
    setExporting(true)
    try {
      const all = await fetchCidadaos({ page_size: "10000" })
      const rows = all.results.map((c) => ({
        Nome: c.nome,
        NIS: c.nis || "",
        Email: c.email || "",
        Telefone: formatPhone(c.telefone),
        "Data Nascimento": formatDateBR(c.data_nascimento),
        Status: c.status_atualizacao,
        "Criado em": c.criado_em ? format(new Date(c.criado_em), "dd/MM/yyyy") : "",
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Cidadãos")
      XLSX.writeFile(wb, `cidadaos_${format(new Date(), "yyyyMMdd")}.xlsx`)
      toast.success("Exportado com sucesso")
    } catch { toast.error("Erro na exportação") }
    finally { setExporting(false) }
  }

  const exportToPDF = async () => {
    setExporting(true)
    try {
      const all = await fetchCidadaos({ page_size: "500" })
      const doc = new jsPDF()
      doc.text("Relatório de Cidadãos", 14, 15)
      const rows = all.results.map((c) => [c.nome, c.nis || "", c.email || "", c.status_atualizacao])
      autoTable(doc, {
        head: [["Nome", "NIS", "Email", "Status"]],
        body: rows,
        startY: 25,
      })
      doc.save(`cidadaos_${format(new Date(), "yyyyMMdd")}.pdf`)
      toast.success("Exportado com sucesso")
    } catch { toast.error("Erro na exportação") }
    finally { setExporting(false) }
  }

  const columns: ColumnDef<Cidadao>[] = [
    { accessorKey: "nome", header: "Nome", cell: ({ row }) => (
      <button className="font-medium text-primary hover:underline text-left" onClick={() => router.push(`/cidadaos/${row.original.id}`)}>
        {row.original.nome}
      </button>
    )},
    { accessorKey: "nis", header: "NIS" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "telefone", header: "Telefone", cell: ({ row }) => formatPhone(row.original.telefone) },
    { accessorKey: "data_nascimento", header: "Nascimento", cell: ({ row }) => formatDateBR(row.original.data_nascimento) },
    { accessorKey: "status_atualizacao", header: "Status", cell: ({ row }) => statusBadge(row.original.status_atualizacao) },
    { id: "actions", cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
          <MoreHorizontal className="w-4 h-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/cidadaos/${row.original.id}`)}>
            <Eye className="w-4 h-4 mr-2" /> Visualizar
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(row.original.id, row.original.nome)}>
            <Trash2 className="w-4 h-4 mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cidadãos</h1>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" disabled={exporting} />}>
            <Download className="w-4 h-4 mr-2" /> Exportar
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportToExcel}>Exportar Excel</DropdownMenuItem>
            <DropdownMenuItem onClick={exportToPDF}>Exportar PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DataTable
        columns={columns}
        data={data?.results ?? []}
        searchKey="nome"
        searchPlaceholder="Buscar por nome..."
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        toolbarEnd={
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value ?? "todos")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ATUALIZADO">Atualizado</SelectItem>
              <SelectItem value="PENDENTE">Pendente</SelectItem>
              <SelectItem value="DESATUALIZADO">Desatualizado</SelectItem>
            </SelectContent>
          </Select>
        }
        loading={loading}
      />

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" disabled={!data?.previous || loading} onClick={() => setPage((p) => p - 1)}>
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">Página {page}</span>
        <Button variant="outline" disabled={!data?.next || loading} onClick={() => setPage((p) => p + 1)}>
          Próxima
        </Button>
      </div>
    </div>
  )
}
