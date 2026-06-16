"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchBeneficio, updateBeneficio } from "@/lib/api"
import type { Beneficio } from "@/types"
import { ArrowLeft, Save } from "lucide-react"
import { toast } from "sonner"

export default function EditarBeneficioPage() {
  const params = useParams()
  const router = useRouter()
  const [beneficio, setBeneficio] = useState<Beneficio | null>(null)
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")
  const [ativo, setAtivo] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchBeneficio(params.id as string)
      .then((b) => {
        setBeneficio(b)
        setNome(b.nome)
        setDescricao(b.descricao)
        setAtivo(b.ativo)
      })
      .catch(() => toast.error("Erro ao carregar benefício"))
      .finally(() => setLoading(false))
  }, [params.id])

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return }
    setSaving(true)
    try {
      await updateBeneficio(params.id as string, { nome: nome.trim(), descricao: descricao.trim(), ativo })
      toast.success("Benefício atualizado")
      router.push("/beneficios")
    } catch { toast.error("Erro ao atualizar") }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="space-y-6 max-w-xl">
      <Skeleton className="h-8 w-48" />
      <Card><CardContent className="p-6 space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</CardContent></Card>
    </div>
  )

  if (!beneficio) return <div className="text-center py-12"><p>Benefício não encontrado</p></div>

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold">Editar Benefício</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>{beneficio.nome}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
            <Label htmlFor="ativo">Ativo</Label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
