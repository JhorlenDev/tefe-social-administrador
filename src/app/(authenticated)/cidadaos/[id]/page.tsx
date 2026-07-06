"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchCidadao, definirCoordenadaManual, invalidateCache, reverseGeocode, atualizarEnderecoCampos } from "@/lib/api"
import { formatDateBR, formatPhone } from "@/lib/formatters"
import type { Cidadao } from "@/types"
import { ArrowLeft, Mail, MapPin, Calendar, FileText, Users, DollarSign, Crosshair, Loader2, ExternalLink, Wand2 } from "lucide-react"
import { toast } from "sonner"

type SugestaoEndereco = { logradouro: string; numero: string; bairro: string; cep: string; formatted: string }
const CAMPOS_REVERSE: { chave: keyof SugestaoEndereco; label: string }[] = [
  { chave: "logradouro", label: "Logradouro" },
  { chave: "numero", label: "Número" },
  { chave: "bairro", label: "Bairro" },
  { chave: "cep", label: "CEP" },
]

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

  useEffect(() => {
    fetchCidadao(params.id as string)
      .then((c) => {
        setCidadao(c)
        setLatInput(c.endereco?.latitude != null ? String(c.endereco.latitude) : "")
        setLngInput(c.endereco?.longitude != null ? String(c.endereco.longitude) : "")
      })
      .catch(() => setCidadao(null))
      .finally(() => setLoading(false))
  }, [params.id])

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
    </div>
  )
}
