"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import DataTable from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchBeneficios, deleteBeneficio, hasCachedData } from "@/lib/api"
import type { Beneficio, PaginatedResponse } from "@/types"
import { format } from "date-fns"
import { MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { BeneficioIcon, getBeneficioIconOption } from "@/lib/beneficio-icons"

export default function BeneficiosPage() {
  const router = useRouter()
  const [data, setData] = useState<PaginatedResponse<Beneficio> | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(() => !hasCachedData("beneficios", { page: "1" }))

  const load = useCallback(async () => {
    const params = { page: String(page) }
    if (!hasCachedData("beneficios", params)) {
      setLoading(true)
    }

    try {
      const result = await fetchBeneficios(params)
      setData(result)
    } catch { toast.error("Erro ao carregar benefícios") }
    finally { setLoading(false) }
  }, [page])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o benefício "${nome}"?`)) return
    try {
      await deleteBeneficio(id)
      toast.success("Benefício excluído")
      load()
    } catch { toast.error("Erro ao excluir benefício") }
  }

  const columns: ColumnDef<Beneficio>[] = [
    { accessorKey: "nome", header: "Nome", cell: ({ row }) => (
      <button className="flex items-center gap-2 text-left font-medium text-primary hover:underline" onClick={() => router.push(`/beneficios/${row.original.id}`)}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <BeneficioIcon value={row.original.icone} className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate">{row.original.nome}</span>
          <span className="block text-xs font-normal text-muted-foreground">
            {getBeneficioIconOption(row.original.icone).label}
          </span>
        </span>
      </button>
    )},
    { accessorKey: "descricao", header: "Descrição", cell: ({ row }) => row.original.descricao?.slice(0, 80) + (row.original.descricao?.length > 80 ? "..." : "") || "-" },
    { accessorKey: "ativo", header: "Ativo", cell: ({ row }) => <Badge variant={row.original.ativo ? "default" : "secondary"}>{row.original.ativo ? "Sim" : "Não"}</Badge> },
    { accessorKey: "criado_em", header: "Criado em", cell: ({ row }) => row.original.criado_em ? format(new Date(row.original.criado_em), "dd/MM/yyyy") : "-" },
    { id: "actions", cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
          <MoreHorizontal className="w-4 h-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/beneficios/${row.original.id}`)}>
            <Pencil className="w-4 h-4 mr-2" /> Editar
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
        <h1 className="text-2xl font-bold">Benefícios</h1>
        <Button onClick={() => router.push("/beneficios/novo")}>
          <Plus className="w-4 h-4 mr-2" /> Novo Benefício
        </Button>
      </div>

      <DataTable columns={columns} data={data?.results ?? []} searchKey="nome" searchPlaceholder="Buscar benefício..." loading={loading} />

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" disabled={!data?.previous || loading} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
        <span className="text-sm text-muted-foreground">Página {page}</span>
        <Button variant="outline" disabled={!data?.next || loading} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
      </div>
    </div>
  )
}
