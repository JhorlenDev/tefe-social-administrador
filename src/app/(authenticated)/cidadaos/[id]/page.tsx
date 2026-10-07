"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { fetchCidadao, definirCoordenadaManual, invalidateCache, reverseGeocode, atualizarEnderecoCampos, updateCidadao } from "@/lib/api"
import { formatDateBR, formatPhone } from "@/lib/formatters"
import type { Cidadao } from "@/types"
import { ArrowLeft, Mail, MapPin, Calendar, FileText, Users, DollarSign, Crosshair, Loader2, ExternalLink, Wand2, Pencil } from "lucide-react"
import { toast } from "sonner"

type SugestaoEndereco = { logradouro: string; numero: string; bairro: string; cep: string; formatted: string }
type CidadaoForm = {
  nome: string
  cpf: string
  rg: string
  rg_orgao: string
  rg_uf: string
  nis: string
  data_nascimento: string
  telefone: string
  email: string
  naturalidade: string
  ocupacao: string
  escolaridade: string
  identidade_genero: string
  cor: string
  estado_civil: string
  possui_deficiencia: boolean
  autorizacao_uso_imagem: boolean
  autorizacao_uso_imagem_responsavel: string
  tipo_localizacao: string
  logradouro: string
  numero: string
  bairro: string
  distrito: string
  comunidade_localidade: string
  cep: string
  complemento: string
}
const CAMPOS_REVERSE: { chave: keyof SugestaoEndereco; label: string }[] = [
  { chave: "logradouro", label: "Logradouro" },
  { chave: "numero", label: "Número" },
  { chave: "bairro", label: "Bairro" },
  { chave: "cep", label: "CEP" },
]

function montarFormulario(cidadao: Cidadao): CidadaoForm {
  return {
    nome: cidadao.nome || "",
    cpf: cidadao.documentos?.cpf || "",
    rg: cidadao.documentos?.rg || "",
    rg_orgao: cidadao.documentos?.rg_orgao || "",
    rg_uf: cidadao.documentos?.rg_uf || "",
    nis: cidadao.nis || "",
    data_nascimento: cidadao.data_nascimento || "",
    telefone: cidadao.telefone || "",
    email: cidadao.email || "",
    naturalidade: cidadao.naturalidade || "",
    ocupacao: cidadao.ocupacao || "",
    escolaridade: cidadao.escolaridade || "",
    identidade_genero: cidadao.identidade_genero || "",
    cor: cidadao.cor || "",
    estado_civil: cidadao.estado_civil || "",
    possui_deficiencia: !!cidadao.possui_deficiencia,
    autorizacao_uso_imagem: !!cidadao.autorizacao_uso_imagem,
    autorizacao_uso_imagem_responsavel: cidadao.autorizacao_uso_imagem_responsavel || "",
    tipo_localizacao: cidadao.endereco?.tipo_localizacao || "URBANO",
    logradouro: cidadao.endereco?.logradouro || "",
    numero: cidadao.endereco?.numero || "",
    bairro: cidadao.endereco?.bairro || "",
    distrito: cidadao.endereco?.distrito || "",
    comunidade_localidade: cidadao.endereco?.comunidade_localidade || "",
    cep: cidadao.endereco?.cep || "",
    complemento: cidadao.endereco?.complemento || "",
  }
}

function vazioParaNull(valor: string) {
  const texto = valor.trim()
  return texto || null
}

export default function CidadaoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [cidadao, setCidadao] = useState<Cidadao | null>(null)
  const [loading, setLoading] = useState(true)
  const [latInput, setLatInput] = useState("")
  const [lngInput, setLngInput] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [sugestao, setSugestao] = useState<SugestaoEndereco | null>(null)
  const [camposSel, setCamposSel] = useState<Record<string, boolean>>({})
  const [buscandoReverse, setBuscandoReverse] = useState(false)
  const [aplicandoEndereco, setAplicandoEndereco] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [form, setForm] = useState<CidadaoForm | null>(null)

  useEffect(() => {
    fetchCidadao(params.id as string)
      .then((c) => {
        setCidadao(c)
        setForm(montarFormulario(c))
        setLatInput(c.endereco?.latitude != null ? String(c.endereco.latitude) : "")
        setLngInput(c.endereco?.longitude != null ? String(c.endereco.longitude) : "")
      })
      .catch(() => setCidadao(null))
      .finally(() => setLoading(false))
  }, [params.id])

  function atualizarForm<K extends keyof CidadaoForm>(campo: K, valor: CidadaoForm[K]) {
    setForm((atual) => (atual ? { ...atual, [campo]: valor } : atual))
  }

  async function salvarDadosCidadao() {
    if (!cidadao || !form) return
    if (!form.nome.trim()) {
      toast.error("Informe o nome do cidadão.")
      return
    }
    if (form.tipo_localizacao === "RURAL_DISTRITO") {
      if (!form.distrito.trim() && !form.comunidade_localidade.trim()) {
        toast.error("Informe o distrito ou comunidade/localidade.")
        return
      }
    } else if (!form.bairro.trim()) {
      toast.error("Informe o bairro.")
      return
    }

    setSalvandoDados(true)
    try {
      const payload: Partial<Cidadao> = {
        nome: form.nome.trim(),
        nis: vazioParaNull(form.nis),
        data_nascimento: vazioParaNull(form.data_nascimento),
        telefone: vazioParaNull(form.telefone),
        email: vazioParaNull(form.email),
        naturalidade: vazioParaNull(form.naturalidade),
        ocupacao: vazioParaNull(form.ocupacao),
        escolaridade: vazioParaNull(form.escolaridade),
        identidade_genero: vazioParaNull(form.identidade_genero),
        cor: vazioParaNull(form.cor),
        estado_civil: vazioParaNull(form.estado_civil),
        possui_deficiencia: form.possui_deficiencia,
        autorizacao_uso_imagem: form.autorizacao_uso_imagem,
        autorizacao_uso_imagem_responsavel: vazioParaNull(form.autorizacao_uso_imagem_responsavel),
        documentos: {
          id: cidadao.documentos?.id || "",
          cpf: vazioParaNull(form.cpf),
          rg: vazioParaNull(form.rg),
          rg_orgao: vazioParaNull(form.rg_orgao),
          rg_uf: vazioParaNull(form.rg_uf),
        },
        endereco: {
          id: cidadao.endereco?.id || "",
          tipo_localizacao: form.tipo_localizacao,
          logradouro: form.logradouro.trim(),
          numero: vazioParaNull(form.numero),
          bairro: form.tipo_localizacao === "RURAL_DISTRITO" ? "" : form.bairro.trim(),
          distrito: form.tipo_localizacao === "RURAL_DISTRITO" ? vazioParaNull(form.distrito) : null,
          comunidade_localidade: form.tipo_localizacao === "RURAL_DISTRITO" ? vazioParaNull(form.comunidade_localidade) : null,
          cep: vazioParaNull(form.cep),
          complemento: vazioParaNull(form.complemento),
        },
      }

      const atualizado = await updateCidadao(cidadao.id, payload)
      setCidadao(atualizado)
      setForm(montarFormulario(atualizado))
      setLatInput(atualizado.endereco?.latitude != null ? String(atualizado.endereco.latitude) : "")
      setLngInput(atualizado.endereco?.longitude != null ? String(atualizado.endereco.longitude) : "")
      setEditOpen(false)
      toast.success("Dados do cidadão atualizados.")
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string; errors?: Record<string, unknown> } } }
      const detail = err?.response?.data?.detail
      const errors = err?.response?.data?.errors
      const firstError = errors ? Object.values(errors).flat().join(" ") : ""
      toast.error(detail || firstError || "Erro ao atualizar os dados do cidadão.")
    } finally {
      setSalvandoDados(false)
    }
  }

  // Detecta um par "lat, lng" colado (formato Google Maps: ponto decimal,
  // vírgula separando). Preenche os dois campos. Retorna true se separou.
  function preencherDeColagem(texto: string): boolean {
    const t = texto.trim()
    if (!t.includes(".")) return false // sem ponto decimal não é o par do Google
    const m = t.match(/^\s*(-?\d+\.\d+)\s*[,;]\s*(-?\d+\.\d+)\s*$/)
    if (!m) return false
    setLatInput(m[1])
    setLngInput(m[2])
    return true
  }

  async function salvarCoordenada() {
    if (!cidadao) return
    // Defesa: se o par inteiro foi colado no campo de latitude, separa aqui.
    let latStr = latInput.trim()
    let lngStr = lngInput.trim()
    const par = latStr.match(/^\s*(-?\d+\.\d+)\s*[,;]\s*(-?\d+\.\d+)\s*$/)
    if (par) {
      latStr = par[1]
      lngStr = par[2]
    }
    const lat = Number.parseFloat(latStr.replace(",", "."))
    const lng = Number.parseFloat(lngStr.replace(",", "."))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Informe latitude e longitude válidas.")
      return
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error("Latitude/longitude fora do intervalo válido. Confira se não inverteu.")
      return
    }
    setSalvando(true)
    try {
      await definirCoordenadaManual(cidadao.id, lat, lng)
      invalidateCache("cidadao")
      setCidadao((c) => (c && c.endereco ? { ...c, endereco: { ...c.endereco, latitude: lat, longitude: lng } } : c))
      toast.success("Localização salva.")
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } }
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      const msg =
        detail ||
        (status === 404
          ? "Este cidadão não tem endereço cadastrado — não dá pra salvar a coordenada."
          : status === 403
            ? "Sem permissão para salvar (precisa ser administrador)."
            : status === 401
              ? "Sessão expirada — faça login de novo."
              : `Erro ao salvar a localização${status ? ` (HTTP ${status})` : ""}.`)
      toast.error(msg)
    } finally {
      setSalvando(false)
    }
  }

  async function buscarEnderecoPelasCoordenadas() {
    const lat = Number.parseFloat(latInput.replace(",", "."))
    const lng = Number.parseFloat(lngInput.replace(",", "."))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Defina e salve a coordenada primeiro.")
      return
    }
    setBuscandoReverse(true)
    try {
      const s = await reverseGeocode(lat, lng)
      setSugestao(s)
      // Pré-seleciona só os campos que vieram preenchidos.
      setCamposSel({
        logradouro: !!s.logradouro,
        numero: !!s.numero,
        bairro: !!s.bairro,
        cep: !!s.cep,
      })
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } }
      toast.error(err?.response?.data?.detail || "Não foi possível buscar o endereço pelas coordenadas.")
    } finally {
      setBuscandoReverse(false)
    }
  }

  async function aplicarEnderecoSugerido() {
    if (!cidadao || !sugestao) return
    const campos: Record<string, string> = {}
    for (const { chave } of CAMPOS_REVERSE) {
      if (camposSel[chave]) campos[chave] = sugestao[chave]
    }
    if (Object.keys(campos).length === 0) {
      toast.info("Marque ao menos um campo para aplicar.")
      return
    }
    setAplicandoEndereco(true)
    try {
      await atualizarEnderecoCampos(cidadao.id, campos)
      setCidadao((c) => (c && c.endereco ? { ...c, endereco: { ...c.endereco, ...campos } } : c))
      setSugestao(null)
      toast.success("Endereço atualizado.")
    } catch {
      toast.error("Erro ao atualizar o endereço.")
    } finally {
      setAplicandoEndereco(false)
    }
  }

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
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{cidadao.nome}</h1>
          <Badge className={statusMap[cidadao.status_atualizacao]}>{cidadao.status_atualizacao}</Badge>
        </div>
        <Button onClick={() => { setForm(montarFormulario(cidadao)); setEditOpen(true) }}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar dados
        </Button>
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
            <p>{cidadao.endereco?.bairro || cidadao.endereco?.comunidade_localidade || cidadao.endereco?.distrito || "-"}</p>
            {cidadao.endereco?.complemento && (
              <p><span className="text-muted-foreground">Compl.:</span> {cidadao.endereco.complemento}</p>
            )}
            <p><span className="text-muted-foreground">CEP:</span> {cidadao.endereco?.cep || "-"}</p>
            <p>
              <span className="text-muted-foreground">Coordenadas:</span>{" "}
              {cidadao.endereco?.latitude != null && cidadao.endereco?.longitude != null
                ? `${cidadao.endereco.latitude}, ${cidadao.endereco.longitude}`
                : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Crosshair className="w-4 h-4" /> Localização (mapa)</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Colar do Google Maps (lat, long)
              <Input
                onChange={(e) => {
                  if (preencherDeColagem(e.target.value)) e.target.value = ""
                }}
                placeholder="-3.3504725, -64.7056835"
                inputMode="decimal"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Latitude
                <Input
                  value={latInput}
                  onChange={(e) => {
                    if (!preencherDeColagem(e.target.value)) setLatInput(e.target.value)
                  }}
                  placeholder="-3.3548"
                  inputMode="decimal"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Longitude
                <Input
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  placeholder="-64.7117"
                  inputMode="decimal"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={salvarCoordenada} disabled={salvando}>
                {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                Salvar localização
              </Button>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [cidadao.endereco?.logradouro, cidadao.endereco?.numero, cidadao.endereco?.bairro, "Tefé", "AM"]
                    .filter(Boolean)
                    .join(", "),
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Procurar no Google Maps <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Dica: no Google Maps, clique com o botão direito no local exato → a primeira opção copia
              <span className="font-medium"> latitude, longitude</span>. Cole aqui.
            </p>

            {/* Atualizar endereço a partir das coordenadas (com prévia) */}
            <div className="border-t pt-3">
              <Button variant="outline" size="sm" onClick={buscarEnderecoPelasCoordenadas} disabled={buscandoReverse}>
                {buscandoReverse ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Atualizar endereço pelas coordenadas
              </Button>

              {sugestao && (
                <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Google: <span className="text-foreground">{sugestao.formatted || "—"}</span>
                  </p>
                  <p className="text-xs font-medium">Marque o que aplicar:</p>
                  <div className="space-y-1.5">
                    {CAMPOS_REVERSE.map(({ chave, label }) => {
                      const valor = sugestao[chave]
                      const atual = (cidadao.endereco?.[chave as "logradouro" | "numero" | "bairro" | "cep"] as string) || "—"
                      const disabled = !valor
                      return (
                        <label
                          key={chave}
                          className={`flex items-start gap-2 text-xs ${disabled ? "opacity-40" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            disabled={disabled}
                            checked={!!camposSel[chave]}
                            onChange={(e) => setCamposSel((s) => ({ ...s, [chave]: e.target.checked }))}
                          />
                          <span>
                            <span className="font-medium">{label}:</span>{" "}
                            <span className="text-muted-foreground line-through">{atual}</span>
                            {" → "}
                            <span className="text-foreground">{valor || "(vazio)"}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={aplicarEnderecoSugerido} disabled={aplicandoEndereco}>
                      {aplicandoEndereco ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Aplicar selecionados
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSugestao(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar dados do cidadão</DialogTitle>
            <DialogDescription>
              Altere os dados principais, documentos e endereço. Salvar aqui atualiza direto na API.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="grid gap-6">
              <div className="grid gap-3">
                <h3 className="text-sm font-semibold">Dados pessoais</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <Label className="grid gap-1.5">
                    Nome
                    <Input value={form.nome} onChange={(e) => atualizarForm("nome", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    NIS
                    <Input value={form.nis} onChange={(e) => atualizarForm("nis", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Data de nascimento
                    <Input type="date" value={form.data_nascimento} onChange={(e) => atualizarForm("data_nascimento", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Telefone
                    <Input value={form.telefone} onChange={(e) => atualizarForm("telefone", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Email
                    <Input type="email" value={form.email} onChange={(e) => atualizarForm("email", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Naturalidade
                    <Input value={form.naturalidade} onChange={(e) => atualizarForm("naturalidade", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Ocupação
                    <Input value={form.ocupacao} onChange={(e) => atualizarForm("ocupacao", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Escolaridade
                    <Input value={form.escolaridade} onChange={(e) => atualizarForm("escolaridade", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Estado civil
                    <Input value={form.estado_civil} onChange={(e) => atualizarForm("estado_civil", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Sexo/Gênero
                    <Input value={form.identidade_genero} onChange={(e) => atualizarForm("identidade_genero", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Cor/Raça
                    <Input value={form.cor} onChange={(e) => atualizarForm("cor", e.target.value)} />
                  </Label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Label className="flex items-center justify-between rounded-lg border p-3">
                    Possui deficiência
                    <Switch checked={form.possui_deficiencia} onCheckedChange={(checked) => atualizarForm("possui_deficiencia", checked)} />
                  </Label>
                  <Label className="flex items-center justify-between rounded-lg border p-3">
                    Autoriza uso de imagem
                    <Switch checked={form.autorizacao_uso_imagem} onCheckedChange={(checked) => atualizarForm("autorizacao_uso_imagem", checked)} />
                  </Label>
                  <Label className="grid gap-1.5 md:col-span-2">
                    Responsável pela autorização de imagem
                    <Input value={form.autorizacao_uso_imagem_responsavel} onChange={(e) => atualizarForm("autorizacao_uso_imagem_responsavel", e.target.value)} />
                  </Label>
                </div>
              </div>

              <div className="grid gap-3">
                <h3 className="text-sm font-semibold">Documentos</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <Label className="grid gap-1.5">
                    CPF
                    <Input value={form.cpf} onChange={(e) => atualizarForm("cpf", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    RG
                    <Input value={form.rg} onChange={(e) => atualizarForm("rg", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Órgão do RG
                    <Input value={form.rg_orgao} onChange={(e) => atualizarForm("rg_orgao", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    UF do RG
                    <Input maxLength={2} value={form.rg_uf} onChange={(e) => atualizarForm("rg_uf", e.target.value.toUpperCase())} />
                  </Label>
                </div>
              </div>

              <div className="grid gap-3">
                <h3 className="text-sm font-semibold">Endereço</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <Label className="grid gap-1.5">
                    Tipo de localização
                    <select
                      className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      value={form.tipo_localizacao}
                      onChange={(e) => atualizarForm("tipo_localizacao", e.target.value)}
                    >
                      <option value="URBANO">Urbano</option>
                      <option value="RURAL_DISTRITO">Rural/Distrito</option>
                    </select>
                  </Label>
                  <Label className="grid gap-1.5">
                    Logradouro/Rua
                    <Input value={form.logradouro} onChange={(e) => atualizarForm("logradouro", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Número
                    <Input value={form.numero} onChange={(e) => atualizarForm("numero", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Bairro
                    <Input
                      value={form.bairro}
                      onChange={(e) => atualizarForm("bairro", e.target.value)}
                      disabled={form.tipo_localizacao === "RURAL_DISTRITO"}
                    />
                  </Label>
                  <Label className="grid gap-1.5">
                    Distrito
                    <Input
                      value={form.distrito}
                      onChange={(e) => atualizarForm("distrito", e.target.value)}
                      disabled={form.tipo_localizacao !== "RURAL_DISTRITO"}
                    />
                  </Label>
                  <Label className="grid gap-1.5">
                    Comunidade/Localidade
                    <Input
                      value={form.comunidade_localidade}
                      onChange={(e) => atualizarForm("comunidade_localidade", e.target.value)}
                      disabled={form.tipo_localizacao !== "RURAL_DISTRITO"}
                    />
                  </Label>
                  <Label className="grid gap-1.5">
                    CEP
                    <Input value={form.cep} onChange={(e) => atualizarForm("cep", e.target.value)} />
                  </Label>
                  <Label className="grid gap-1.5">
                    Complemento
                    <Input value={form.complemento} onChange={(e) => atualizarForm("complemento", e.target.value)} />
                  </Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={salvandoDados}>
              Cancelar
            </Button>
            <Button onClick={salvarDadosCidadao} disabled={salvandoDados}>
              {salvandoDados ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
