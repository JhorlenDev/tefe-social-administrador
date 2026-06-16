"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchCidadao } from "@/lib/api"
import { formatDateBR, formatPhone } from "@/lib/formatters"
import type { Cidadao } from "@/types"
import { ArrowLeft, Mail, MapPin, Calendar, FileText, Users, DollarSign } from "lucide-react"

export default function CidadaoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [cidadao, setCidadao] = useState<Cidadao | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCidadao(params.id as string)
      .then(setCidadao)
      .catch(() => setCidadao(null))
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>)}
      </div>
    </div>
  )

  if (!cidadao) return (
    <div className="text-center py-12">
      <h2 className="text-xl font-semibold">Cidadão não encontrado</h2>
      <Button variant="link" onClick={() => router.back()}>Voltar</Button>
    </div>
  )

  const statusMap: Record<string, string> = {
    PENDENTE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    ATUALIZADO: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    DESATUALIZADO: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{cidadao.nome}</h1>
          <Badge className={statusMap[cidadao.status_atualizacao]}>{cidadao.status_atualizacao}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Documentos</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">CPF:</span> {cidadao.documentos?.cpf || "-"}</p>
            <p><span className="text-muted-foreground">RG:</span> {cidadao.documentos?.rg || "-"} {cidadao.documentos?.rg_uf ? `(${cidadao.documentos.rg_uf})` : ""}</p>
            <p><span className="text-muted-foreground">NIS:</span> {cidadao.nis || "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> Endereço</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{cidadao.endereco?.logradouro || "-"}, {cidadao.endereco?.numero || "S/N"}</p>
            <p>{cidadao.endereco?.bairro || "-"}</p>
            <p><span className="text-muted-foreground">CEP:</span> {cidadao.endereco?.cep || "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" /> Contato</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Email:</span> {cidadao.email || "-"}</p>
            <p><span className="text-muted-foreground">Telefone:</span> {formatPhone(cidadao.telefone)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" /> Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Nascimento:</span> {formatDateBR(cidadao.data_nascimento)}</p>
            <p><span className="text-muted-foreground">Naturalidade:</span> {cidadao.naturalidade || "-"}</p>
            <p><span className="text-muted-foreground">Escolaridade:</span> {cidadao.escolaridade || "-"}</p>
            <p><span className="text-muted-foreground">Estado Civil:</span> {cidadao.estado_civil || "-"}</p>
            <p><span className="text-muted-foreground">Deficiência:</span> {cidadao.possui_deficiencia ? "Sim" : "Não"}</p>
          </CardContent>
        </Card>

        {cidadao.socioeconomico && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4" /> Socioeconômico</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Renda Total:</span> R$ {Number(cidadao.socioeconomico.renda_total).toFixed(2)}</p>
              <p><span className="text-muted-foreground">Pessoas na Residência:</span> {cidadao.socioeconomico.quantidade_pessoas_residencia}</p>
              <p><span className="text-muted-foreground">Recebe Benefício:</span> {cidadao.socioeconomico.recebe_beneficio ? "Sim" : "Não"}</p>
            </CardContent>
          </Card>
        )}

        {cidadao.membros_familia && cidadao.membros_familia.length > 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Membros da Família ({cidadao.membros_familia.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {cidadao.membros_familia.map((membro) => (
                  <div key={membro.id} className="border rounded-lg p-3 text-sm space-y-1">
                    <p className="font-medium">{membro.nome_membro}</p>
                    <p className="text-muted-foreground">{membro.parentesco}</p>
                    {membro.data_nascimento && <p className="text-muted-foreground">Nasc: {formatDateBR(membro.data_nascimento)}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
