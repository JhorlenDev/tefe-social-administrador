"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  createLocalidadeCatalogo,
  createRuaCatalogo,
  deleteLocalidadeCatalogo,
  deleteRuaCatalogo,
  fetchAllCidadaos,
  fetchLocalidadesCatalogo,
  fetchRuasCatalogo,
  mesclarLocalidadeCatalogo,
  mesclarRuaCatalogo,
  updateLocalidadeCatalogo,
  updateRuaCatalogo,
} from "@/lib/api"
import type { Cidadao, LocalidadeCatalogo, LocalidadeTipo, RuaCatalogo } from "@/types"
import { Building2, GitMerge, Home, MapPinned, Pencil, Plus, RefreshCcw, Search, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

const TIPO_LABEL: Record<LocalidadeTipo, string> = {
  BAIRRO: "Bairro",
  COMUNIDADE: "Comunidade",
  DISTRITO: "Distrito",
}

type LocalidadeForm = {
  id?: string
  nome: string
  tipo: LocalidadeTipo
}

type RuaForm = {
  id?: string
  nome: string
  localidade: string
}

type MesclaLocalidadeForm = {
  origem: LocalidadeCatalogo | null
  destinoId: string
}

type MesclaRuaForm = {
  origem: RuaCatalogo | null
  destinoId: string
}

const localidadeVazia: LocalidadeForm = { nome: "", tipo: "BAIRRO" }
const ruaVazia: RuaForm = { nome: "", localidade: "" }

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
}

export default function LocalidadesPage() {
  const [localidades, setLocalidades] = useState<LocalidadeCatalogo[]>([])
  const [ruas, setRuas] = useState<RuaCatalogo[]>([])
  const [cidadaos, setCidadaos] = useState<Cidadao[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [tipoFiltro, setTipoFiltro] = useState<LocalidadeTipo | "TODOS">("TODOS")
  const [localidadeSelecionada, setLocalidadeSelecionada] = useState<string>("")
  const [localidadeForm, setLocalidadeForm] = useState<LocalidadeForm>(localidadeVazia)
  const [ruaForm, setRuaForm] = useState<RuaForm>(ruaVazia)
  const [mesclaLocalidade, setMesclaLocalidade] = useState<MesclaLocalidadeForm>({ origem: null, destinoId: "" })
  const [mesclaRua, setMesclaRua] = useState<MesclaRuaForm>({ origem: null, destinoId: "" })
  const [localidadeDialogOpen, setLocalidadeDialogOpen] = useState(false)
  const [ruaDialogOpen, setRuaDialogOpen] = useState(false)
  const [mesclaLocalidadeOpen, setMesclaLocalidadeOpen] = useState(false)
  const [mesclaRuaOpen, setMesclaRuaOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [localidadesData, ruasData] = await Promise.all([
        fetchLocalidadesCatalogo(),
        fetchRuasCatalogo(),
      ])
      setLocalidades(localidadesData)
      setRuas(ruasData)
      fetchAllCidadaos()
        .then(setCidadaos)
        .catch(() => toast.error("Localidades carregadas, mas não foi possível contar os cidadãos."))
      setLocalidadeSelecionada((atual) => atual || localidadesData[0]?.id || "")
    } catch {
      toast.error("Erro ao carregar localidades e ruas.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => void load())
    return () => window.cancelAnimationFrame(frameId)
  }, [load])

  const ruasPorLocalidade = useMemo(() => {
    return ruas.reduce<Record<string, number>>((acc, rua) => {
      const id = rua.localidade_id || rua.localidade
      acc[id] = (acc[id] || 0) + 1
      return acc
    }, {})
  }, [ruas])

  const cidadaosPorLocalidade = useMemo(() => {
    return cidadaos.reduce<Record<string, number>>((acc, cidadao) => {
      const endereco = cidadao.endereco
      const bairro = normalize(endereco?.bairro || "")
      const comunidade = normalize(endereco?.comunidade_localidade || "")
      const distrito = normalize(endereco?.distrito || "")

      for (const localidade of localidades) {
        const nome = normalize(localidade.nome)
        if (
          (localidade.tipo === "BAIRRO" && bairro === nome) ||
          (localidade.tipo === "COMUNIDADE" && comunidade === nome) ||
          (localidade.tipo === "DISTRITO" && distrito === nome)
        ) {
          acc[localidade.id] = (acc[localidade.id] || 0) + 1
          break
        }
      }

      return acc
    }, {})
  }, [cidadaos, localidades])

  const localidadesFiltradas = useMemo(() => {
    const termo = normalize(query)
    return localidades.filter((localidade) => {
      const bateTipo = tipoFiltro === "TODOS" || localidade.tipo === tipoFiltro
      const bateBusca = !termo || normalize(localidade.nome).includes(termo)
      return bateTipo && bateBusca
    })
  }, [localidades, query, tipoFiltro])

  const localidadeAtual = useMemo(
    () => localidades.find((localidade) => localidade.id === localidadeSelecionada) ?? null,
    [localidades, localidadeSelecionada],
  )

  const ruasDaLocalidade = useMemo(() => {
    if (!localidadeSelecionada) return []
    const termo = normalize(query)
    return ruas.filter((rua) => {
      const pertence = rua.localidade_id === localidadeSelecionada || rua.localidade === localidadeSelecionada
      const bateBusca = !termo || normalize(rua.nome).includes(termo)
      return pertence && bateBusca
    })
  }, [localidadeSelecionada, query, ruas])

  const cidadaosPorRua = useMemo(() => {
    if (!localidadeAtual) return {}

    const nomeLocalidade = normalize(localidadeAtual.nome)
    return cidadaos.reduce<Record<string, number>>((acc, cidadao) => {
      const endereco = cidadao.endereco
      const rua = normalize(endereco?.logradouro || "")
      if (!rua) return acc

      const pertence =
        (localidadeAtual.tipo === "BAIRRO" && normalize(endereco?.bairro || "") === nomeLocalidade) ||
        (localidadeAtual.tipo === "COMUNIDADE" && normalize(endereco?.comunidade_localidade || "") === nomeLocalidade) ||
        (localidadeAtual.tipo === "DISTRITO" && normalize(endereco?.distrito || "") === nomeLocalidade)

      if (!pertence) return acc

      for (const ruaCatalogo of ruasDaLocalidade) {
        if (normalize(ruaCatalogo.nome) === rua) {
          acc[ruaCatalogo.id] = (acc[ruaCatalogo.id] || 0) + 1
          break
        }
      }

      return acc
    }, {})
  }, [cidadaos, localidadeAtual, ruasDaLocalidade])

  const resumo = useMemo(() => {
    return {
      bairros: localidades.filter((item) => item.tipo === "BAIRRO").length,
      comunidades: localidades.filter((item) => item.tipo === "COMUNIDADE").length,
      distritos: localidades.filter((item) => item.tipo === "DISTRITO").length,
      ruas: ruas.length,
      cidadaos: cidadaos.length,
    }
  }, [cidadaos, localidades, ruas])

  function abrirNovaLocalidade() {
    setLocalidadeForm(localidadeVazia)
    setLocalidadeDialogOpen(true)
  }

  function abrirEditarLocalidade(localidade: LocalidadeCatalogo) {
    setLocalidadeForm({ id: localidade.id, nome: localidade.nome, tipo: localidade.tipo })
    setLocalidadeDialogOpen(true)
  }

  function abrirMesclarLocalidade(localidade: LocalidadeCatalogo) {
    const destino = localidades.find((item) => item.tipo === localidade.tipo && item.id !== localidade.id)
    setMesclaLocalidade({ origem: localidade, destinoId: destino?.id || "" })
    setMesclaLocalidadeOpen(true)
  }

  function abrirNovaRua() {
    setRuaForm({ ...ruaVazia, localidade: localidadeSelecionada })
    setRuaDialogOpen(true)
  }

  function abrirEditarRua(rua: RuaCatalogo) {
    setRuaForm({ id: rua.id, nome: rua.nome, localidade: rua.localidade_id || rua.localidade })
    setRuaDialogOpen(true)
  }

  function abrirMesclarRua(rua: RuaCatalogo) {
    const localidadeId = rua.localidade_id || rua.localidade
    const destino = ruas.find((item) => item.id !== rua.id && (item.localidade_id || item.localidade) === localidadeId)
    setMesclaRua({ origem: rua, destinoId: destino?.id || "" })
    setMesclaRuaOpen(true)
  }

  async function salvarLocalidade() {
    const nome = localidadeForm.nome.trim()
    if (!nome) {
      toast.error("Informe o nome da localidade.")
      return
    }
    setSaving(true)
    try {
      const payload = { nome, tipo: localidadeForm.tipo }
      if (localidadeForm.id) {
        await updateLocalidadeCatalogo(localidadeForm.id, payload)
        toast.success("Localidade atualizada.")
      } else {
        const criada = await createLocalidadeCatalogo(payload)
        setLocalidadeSelecionada(criada.id)
        toast.success("Localidade criada.")
      }
      setLocalidadeDialogOpen(false)
      await load()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { nome?: string[]; detail?: string } } }
      toast.error(err.response?.data?.nome?.[0] || err.response?.data?.detail || "Erro ao salvar localidade.")
    } finally {
      setSaving(false)
    }
  }

  async function salvarRua() {
    const nome = ruaForm.nome.trim()
    if (!nome) {
      toast.error("Informe o nome da rua.")
      return
    }
    if (!ruaForm.localidade) {
      toast.error("Selecione a localidade da rua.")
      return
    }
    setSaving(true)
    try {
      const payload = { nome, localidade: ruaForm.localidade }
      if (ruaForm.id) {
        await updateRuaCatalogo(ruaForm.id, payload)
        toast.success("Rua atualizada.")
      } else {
        await createRuaCatalogo(payload)
        toast.success("Rua criada.")
      }
      setRuaDialogOpen(false)
      await load()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { nome?: string[]; detail?: string } } }
      toast.error(err.response?.data?.nome?.[0] || err.response?.data?.detail || "Erro ao salvar rua.")
    } finally {
      setSaving(false)
    }
  }

  async function confirmarMesclaLocalidade() {
    if (!mesclaLocalidade.origem || !mesclaLocalidade.destinoId) {
      toast.error("Selecione a localidade de destino.")
      return
    }

    setSaving(true)
    try {
      const resultado = await mesclarLocalidadeCatalogo(mesclaLocalidade.origem.id, mesclaLocalidade.destinoId)
      toast.success(
        `Mesclado: ${resultado.enderecos_atualizados} cidadão(s), ${resultado.ruas_movidas} rua(s) movida(s), ${resultado.ruas_mescladas} rua(s) unificada(s).`,
      )
      setMesclaLocalidadeOpen(false)
      setLocalidadeSelecionada(resultado.destino.id)
      await load()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || "Erro ao mesclar localidade.")
    } finally {
      setSaving(false)
    }
  }

  async function confirmarMesclaRua() {
    if (!mesclaRua.origem || !mesclaRua.destinoId) {
      toast.error("Selecione a rua de destino.")
      return
    }

    setSaving(true)
    try {
      const resultado = await mesclarRuaCatalogo(mesclaRua.origem.id, mesclaRua.destinoId)
      toast.success(`Mesclado: ${resultado.enderecos_atualizados} cidadão(s) atualizados.`)
      setMesclaRuaOpen(false)
      await load()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || "Erro ao mesclar rua.")
    } finally {
      setSaving(false)
    }
  }

  async function excluirLocalidade(localidade: LocalidadeCatalogo) {
    if (!confirm(`Excluir "${localidade.nome}"? Use mesclagem quando houver cidadãos ou ruas apontando para esta localidade.`)) return
    try {
      await deleteLocalidadeCatalogo(localidade.id)
      toast.success("Localidade excluída.")
      if (localidadeSelecionada === localidade.id) setLocalidadeSelecionada("")
      await load()
    } catch {
      toast.error("Não foi possível excluir. A localidade pode estar vinculada a ruas.")
    }
  }

  async function excluirRua(rua: RuaCatalogo) {
    if (!confirm(`Excluir "${rua.nome}"?`)) return
    try {
      await deleteRuaCatalogo(rua.id)
      toast.success("Rua excluída.")
      await load()
    } catch {
      toast.error("Não foi possível excluir a rua.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Localidades e ruas</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo usado para corrigir bairros, comunidades, distritos e logradouros dos cidadãos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={abrirNovaLocalidade}>
            <Plus className="mr-2 h-4 w-4" />
            Nova localidade
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Bairros</p>
              <p className="text-xl font-semibold">{resumo.bairros}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <MapPinned className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Comunidades</p>
              <p className="text-xl font-semibold">{resumo.comunidades}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Home className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Distritos</p>
              <p className="text-xl font-semibold">{resumo.distritos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <GitMerge className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Ruas</p>
              <p className="text-xl font-semibold">{resumo.ruas}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Cidadãos contados</p>
              <p className="text-xl font-semibold">{resumo.cidadaos}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Localidades</CardTitle>
              <Select value={tipoFiltro} onValueChange={(value) => setTipoFiltro((value as LocalidadeTipo | "TODOS") || "TODOS")}>
                <SelectTrigger className="w-40">
                  {tipoFiltro === "TODOS" ? "Todos os tipos" : TIPO_LABEL[tipoFiltro]}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos os tipos</SelectItem>
                  <SelectItem value="BAIRRO">Bairros</SelectItem>
                  <SelectItem value="COMUNIDADE">Comunidades</SelectItem>
                  <SelectItem value="DISTRITO">Distritos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar bairro, comunidade, distrito ou rua..." />
            </label>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ruas</TableHead>
                    <TableHead>Pessoas</TableHead>
                    <TableHead className="w-28 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localidadesFiltradas.map((localidade) => {
                    const ativa = localidade.id === localidadeSelecionada
                    return (
                      <TableRow key={localidade.id} data-state={ativa ? "selected" : undefined}>
                        <TableCell>
                          <button className="text-left font-medium text-primary hover:underline" onClick={() => setLocalidadeSelecionada(localidade.id)}>
                            {localidade.nome}
                          </button>
                          {localidade.criada_automaticamente && (
                            <p className="text-xs text-muted-foreground">Criada automaticamente</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{TIPO_LABEL[localidade.tipo]}</Badge>
                        </TableCell>
                        <TableCell>{ruasPorLocalidade[localidade.id] || 0}</TableCell>
                        <TableCell>{cidadaosPorLocalidade[localidade.id] || 0}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => abrirEditarLocalidade(localidade)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => abrirMesclarLocalidade(localidade)}>
                              <GitMerge className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => void excluirLocalidade(localidade)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {localidadesFiltradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Nenhuma localidade encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Ruas da localidade</CardTitle>
              <p className="text-sm text-muted-foreground">
                {localidadeAtual ? `${localidadeAtual.nome} - ${TIPO_LABEL[localidadeAtual.tipo]}` : "Selecione uma localidade"}
              </p>
            </div>
            <Button onClick={abrirNovaRua} disabled={!localidadeSelecionada}>
              <Plus className="mr-2 h-4 w-4" />
              Nova rua
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rua</TableHead>
                    <TableHead>Pessoas</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ruasDaLocalidade.map((rua) => (
                    <TableRow key={rua.id}>
                      <TableCell className="font-medium">{rua.nome}</TableCell>
                      <TableCell>{cidadaosPorRua[rua.id] || 0}</TableCell>
                      <TableCell>
                        <Badge variant={rua.criada_automaticamente ? "secondary" : "outline"}>
                          {rua.criada_automaticamente ? "Automática" : "Manual"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => abrirEditarRua(rua)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => abrirMesclarRua(rua)}>
                            <GitMerge className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => void excluirRua(rua)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {ruasDaLocalidade.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        {localidadeAtual ? "Nenhuma rua cadastrada para esta localidade." : "Escolha uma localidade para ver as ruas."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={localidadeDialogOpen} onOpenChange={setLocalidadeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{localidadeForm.id ? "Editar localidade" : "Nova localidade"}</DialogTitle>
            <DialogDescription>
              Cadastre bairros, comunidades e distritos que serão usados na correção dos endereços.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="localidade-nome">Nome</Label>
              <Input id="localidade-nome" value={localidadeForm.nome} onChange={(event) => setLocalidadeForm((form) => ({ ...form, nome: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={localidadeForm.tipo} onValueChange={(value) => setLocalidadeForm((form) => ({ ...form, tipo: value as LocalidadeTipo }))}>
                <SelectTrigger className="w-full">{TIPO_LABEL[localidadeForm.tipo]}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAIRRO">Bairro</SelectItem>
                  <SelectItem value="COMUNIDADE">Comunidade</SelectItem>
                  <SelectItem value="DISTRITO">Distrito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocalidadeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void salvarLocalidade()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ruaDialogOpen} onOpenChange={setRuaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ruaForm.id ? "Editar rua" : "Nova rua"}</DialogTitle>
            <DialogDescription>
              A rua fica vinculada a uma localidade. Depois ela poderá ser usada no cadastro do cidadão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rua-nome">Nome</Label>
              <Input id="rua-nome" value={ruaForm.nome} onChange={(event) => setRuaForm((form) => ({ ...form, nome: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Localidade</Label>
              <Select value={ruaForm.localidade} onValueChange={(value) => setRuaForm((form) => ({ ...form, localidade: value || "" }))}>
                <SelectTrigger className="w-full">
                  {localidades.find((localidade) => localidade.id === ruaForm.localidade)?.nome || "Selecione"}
                </SelectTrigger>
                <SelectContent>
                  {localidades.map((localidade) => (
                    <SelectItem key={localidade.id} value={localidade.id}>
                      {localidade.nome} - {TIPO_LABEL[localidade.tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void salvarRua()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mesclaLocalidadeOpen} onOpenChange={setMesclaLocalidadeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mesclar localidade</DialogTitle>
            <DialogDescription>
              Os cidadãos e ruas da origem serão movidos para a localidade de destino.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p><span className="text-muted-foreground">Origem:</span> {mesclaLocalidade.origem?.nome || "-"}</p>
              <p><span className="text-muted-foreground">Pessoas:</span> {mesclaLocalidade.origem ? cidadaosPorLocalidade[mesclaLocalidade.origem.id] || 0 : 0}</p>
              <p><span className="text-muted-foreground">Ruas:</span> {mesclaLocalidade.origem ? ruasPorLocalidade[mesclaLocalidade.origem.id] || 0 : 0}</p>
            </div>
            <div className="space-y-2">
              <Label>Destino</Label>
              <Select value={mesclaLocalidade.destinoId} onValueChange={(value) => setMesclaLocalidade((form) => ({ ...form, destinoId: value || "" }))}>
                <SelectTrigger className="w-full">
                  {localidades.find((item) => item.id === mesclaLocalidade.destinoId)?.nome || "Selecione"}
                </SelectTrigger>
                <SelectContent>
                  {localidades
                    .filter((item) => item.tipo === mesclaLocalidade.origem?.tipo && item.id !== mesclaLocalidade.origem?.id)
                    .map((localidade) => (
                      <SelectItem key={localidade.id} value={localidade.id}>
                        {localidade.nome} - {cidadaosPorLocalidade[localidade.id] || 0} pessoa(s)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMesclaLocalidadeOpen(false)}>Cancelar</Button>
            <Button onClick={() => void confirmarMesclaLocalidade()} disabled={saving || !mesclaLocalidade.destinoId}>
              {saving ? "Mesclando..." : "Mesclar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mesclaRuaOpen} onOpenChange={setMesclaRuaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mesclar rua</DialogTitle>
            <DialogDescription>
              Os cidadãos da rua de origem serão atualizados para a rua de destino na mesma localidade.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p><span className="text-muted-foreground">Origem:</span> {mesclaRua.origem?.nome || "-"}</p>
              <p><span className="text-muted-foreground">Localidade:</span> {mesclaRua.origem?.localidade_nome || "-"}</p>
              <p><span className="text-muted-foreground">Pessoas:</span> {mesclaRua.origem ? cidadaosPorRua[mesclaRua.origem.id] || 0 : 0}</p>
            </div>
            <div className="space-y-2">
              <Label>Destino</Label>
              <Select value={mesclaRua.destinoId} onValueChange={(value) => setMesclaRua((form) => ({ ...form, destinoId: value || "" }))}>
                <SelectTrigger className="w-full">
                  {ruas.find((item) => item.id === mesclaRua.destinoId)?.nome || "Selecione"}
                </SelectTrigger>
                <SelectContent>
                  {ruas
                    .filter((item) => item.id !== mesclaRua.origem?.id && (item.localidade_id || item.localidade) === (mesclaRua.origem?.localidade_id || mesclaRua.origem?.localidade))
                    .map((rua) => (
                      <SelectItem key={rua.id} value={rua.id}>
                        {rua.nome} - {cidadaosPorRua[rua.id] || 0} pessoa(s)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMesclaRuaOpen(false)}>Cancelar</Button>
            <Button onClick={() => void confirmarMesclaRua()} disabled={saving || !mesclaRua.destinoId}>
              {saving ? "Mesclando..." : "Mesclar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
