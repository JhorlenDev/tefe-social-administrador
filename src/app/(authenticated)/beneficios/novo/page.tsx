"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createBeneficio } from "@/lib/api"
import { ArrowLeft, Save } from "lucide-react"
import { toast } from "sonner"

export default function NovoBeneficioPage() {
  const router = useRouter()
  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return }
    setSaving(true)
    try {
      await createBeneficio({ nome: nome.trim(), descricao: descricao.trim() })
      toast.success("Benefício criado com sucesso")
      router.push("/beneficios")
    } catch { toast.error("Erro ao criar benefício") }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold">Novo Benefício</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Dados do Benefício</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do benefício" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do benefício" rows={4} />
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
