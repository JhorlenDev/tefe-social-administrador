import axios from "axios"
import type {
  Cidadao,
  Beneficio,
  Beneficiario,
  DashboardStats,
  PaginatedResponse,
  MapaCalorPonto,
  MapaCalorResumo,
  BeneficiarioPendente,
  GeocodificacaoResultado,
} from "@/types"

const proxyUrl = typeof window !== "undefined" ? "/api/proxy" : (process.env.API_UPSTREAM || "http://localhost:8000") + "/api"
const api = axios.create({ baseURL: proxyUrl })
const DEFAULT_CACHE_TTL = typeof window !== "undefined" ? Number.POSITIVE_INFINITY : 30_000

api.interceptors.request.use(async (config) => {
  if (typeof window === "undefined") {
    const { auth } = await import("./auth")
    const session = await auth()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
  } else {
    const { getSession } = await import("next-auth/react")
    const session = await getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
  }
  return config
})

const cache = new Map<string, { data: unknown; expires: number }>()
const pending = new Map<string, Promise<unknown>>()

function makeCacheKey(resource: string, params?: Record<string, string>) {
  return `${resource}:${JSON.stringify(params)}`
}

async function cached<T>(key: string, fn: () => Promise<T>, ttl = DEFAULT_CACHE_TTL): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() < hit.expires) {
    return hit.data as T
  }

  const inFlight = pending.get(key)
  if (inFlight) return inFlight as Promise<T>

  const request = fn()
    .then((data) => {
      cache.set(key, { data, expires: ttl === Number.POSITIVE_INFINITY ? ttl : Date.now() + ttl })
      return data
    })
    .finally(() => {
      pending.delete(key)
    })

  pending.set(key, request)
  return request
}

export function hasCachedData(resource: string, params?: Record<string, string>) {
  const hit = cache.get(makeCacheKey(resource, params))
  return Boolean(hit && Date.now() < hit.expires)
}

export function hasCachedKey(key: string) {
  const hit = cache.get(key)
  return Boolean(hit && Date.now() < hit.expires)
}

export function invalidateCache(pattern?: string) {
  if (!pattern) { cache.clear(); return }
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) cache.delete(key)
  }
}

function toPaginated<T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data }
  }
  return data
}

export async function fetchCidadaos(params?: Record<string, string>): Promise<PaginatedResponse<Cidadao>> {
  const cacheKey = makeCacheKey("cidadaos", params)
  return cached<PaginatedResponse<Cidadao>>(cacheKey, async () => {
    const { data } = await api.get("/cidadaos/", { params })
    return toPaginated(data as Cidadao[])
  })
}

export async function fetchCidadao(id: string): Promise<Cidadao> {
  return cached<Cidadao>(`cidadao:${id}`, async () => {
    const { data } = await api.get(`/cidadaos/${id}/`)
    return data as Cidadao
  })
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return cached<DashboardStats>("dashboard:stats", async () => {
    const { data } = await api.get("/dashboard/stats/")
    return data as DashboardStats
  })
}

export async function deleteCidadao(id: string): Promise<void> {
  await api.delete(`/cidadaos/${id}/`)
  invalidateCache("cidadao")
  invalidateCache("cidadaos")
}

export async function fetchBeneficios(params?: Record<string, string>): Promise<PaginatedResponse<Beneficio>> {
  const cacheKey = makeCacheKey("beneficios", params)
  return cached<PaginatedResponse<Beneficio>>(cacheKey, async () => {
    const { data } = await api.get("/beneficios/", { params })
    return toPaginated(data as Beneficio[])
  })
}

export async function fetchBeneficio(id: string): Promise<Beneficio> {
  return cached<Beneficio>(`beneficio:${id}`, async () => {
    const { data } = await api.get(`/beneficios/${id}/`)
    return data as Beneficio
  })
}

export async function createBeneficio(beneficio: Partial<Beneficio>): Promise<Beneficio> {
  const { data } = await api.post("/beneficios/", beneficio)
  invalidateCache("beneficios")
  invalidateCache("beneficio")
  return data as Beneficio
}

export async function updateBeneficio(id: string, beneficio: Partial<Beneficio>): Promise<Beneficio> {
  const { data } = await api.patch(`/beneficios/${id}/`, beneficio)
  invalidateCache(`beneficio:${id}`)
  invalidateCache("beneficios")
  return data as Beneficio
}

export async function deleteBeneficio(id: string): Promise<void> {
  await api.delete(`/beneficios/${id}/`)
  invalidateCache("beneficios")
  invalidateCache("beneficio")
}

export async function fetchBeneficiarios(params?: Record<string, string>): Promise<PaginatedResponse<Beneficiario>> {
  const cacheKey = makeCacheKey("beneficiarios", params)
  return cached<PaginatedResponse<Beneficiario>>(cacheKey, async () => {
    const { data } = await api.get("/beneficiarios/", { params })
    return toPaginated(data as Beneficiario[])
  })
}

export async function updateBeneficiarioStatus(id: string, status: string, valor_recebido?: number): Promise<Beneficiario> {
  const { data } = await api.patch(`/beneficiarios/${id}/`, { status, valor_recebido })
  invalidateCache("beneficiarios")
  return data as Beneficiario
}

export async function fetchAllCidadaos(): Promise<Cidadao[]> {
  return cached<Cidadao[]>("cidadaos:all", async () => {
    const { data } = await api.get("/cidadaos/")
    const p = toPaginated(data as Cidadao[])
    return p.results
  })
}

export async function fetchAllBeneficiarios(): Promise<Beneficiario[]> {
  return cached<Beneficiario[]>("beneficiarios:all", async () => {
    const { data } = await api.get("/beneficiarios/")
    const p = toPaginated(data as Beneficiario[])
    return p.results
  })
}

export async function fetchAllBeneficios(): Promise<Beneficio[]> {
  return cached<Beneficio[]>("beneficios:all", async () => {
    const { data } = await api.get("/beneficios/")
    const p = toPaginated(data as Beneficio[])
    return p.results
  })
}

// ---------- Mapa de calor / geocodificação ----------

export async function fetchMapaCalor(params?: Record<string, string>): Promise<MapaCalorPonto[]> {
  const { data } = await api.get("/relatorios/mapa-calor-beneficiarios/", { params })
  return data as MapaCalorPonto[]
}

export async function fetchMapaCalorResumo(params?: Record<string, string>): Promise<MapaCalorResumo> {
  const { data } = await api.get("/relatorios/mapa-calor-beneficiarios/resumo/", { params })
  return data as MapaCalorResumo
}

export async function fetchBeneficiariosPendentes(): Promise<BeneficiarioPendente[]> {
  const { data } = await api.get("/geocodificacao/beneficiarios/pendentes/")
  return data as BeneficiarioPendente[]
}

export async function processarGeocodificacao(limit = 50): Promise<GeocodificacaoResultado> {
  const { data } = await api.post("/geocodificacao/beneficiarios/processar/", { limit })
  return data as GeocodificacaoResultado
}

export async function definirCoordenadaManual(
  cidadaoId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  await api.post(`/geocodificacao/enderecos/${cidadaoId}/manual/`, { latitude, longitude })
}

let warmupStarted = false

export function warmClientCache() {
  if (typeof window === "undefined" || warmupStarted) return
  warmupStarted = true

  void Promise.allSettled([
    fetchCidadaos({ page: "1", page_size: "20" }),
    fetchBeneficios({ page: "1" }),
    fetchBeneficiarios({ page: "1", page_size: "20" }),
    fetchDashboardStats(),
  ])
}
