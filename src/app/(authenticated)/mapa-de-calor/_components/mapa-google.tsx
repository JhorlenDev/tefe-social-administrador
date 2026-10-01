"use client"

import { useEffect, useMemo, useRef } from "react"
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps"
import { GoogleMapsOverlay } from "@deck.gl/google-maps"
import { HeatmapLayer } from "@deck.gl/aggregation-layers"
import { IconLayer } from "@deck.gl/layers"
import type { MapaCalorPonto } from "@/types"

// Centro de Tefé/AM
const TEFE_CENTER = { lat: -3.3548, lng: -64.7117 }
const DEFAULT_ZOOM = 13

// Bounding box do estado do Amazonas — o mapa fica travado dentro disso.
const AMAZONAS_BOUNDS = {
  north: 2.4,
  south: -10.0,
  west: -74.2,
  east: -55.8,
}

// Cor do ponto por status de atualização do cidadão.
// Atualizado = verde · Pendente = amarelo · Desatualizado = vermelho.
const STATUS_ATUALIZACAO_RGB: Record<string, [number, number, number]> = {
  ATUALIZADO: [34, 197, 94], // verde
  PENDENTE: [234, 179, 8], // amarelo
  DESATUALIZADO: [239, 68, 68], // vermelho
}

const STATUS_ATUALIZACAO_COR: Record<string, string> = {
  ATUALIZADO: "#22c55e",
  PENDENTE: "#eab308",
  DESATUALIZADO: "#ef4444",
}

// Marcador minimalista com centro vazado, usado como máscara: o deck.gl tinge
// com a cor do status (getColor). Ancorado pela ponta inferior.
const PIN_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 48 64">` +
  `<path fill="#fff" fill-rule="evenodd" d="M24 3C13.5 3 5 11.5 5 22c0 14.2 19 37 19 37s19-22.8 19-37C43 11.5 34.5 3 24 3zm0 9a10 10 0 110 20 10 10 0 010-20zm0 6a4 4 0 100 8 4 4 0 000-8z"/>` +
  `</svg>`
const PIN_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PIN_SVG)}`
const PIN_MAPPING = { pin: { x: 0, y: 0, width: 48, height: 64, anchorY: 64, mask: true } }

const STATUS_ATUALIZACAO_LABEL: Record<string, string> = {
  ATUALIZADO: "Atualizado",
  PENDENTE: "Pendente",
  DESATUALIZADO: "Desatualizado",
}

function corRgbPorAtualizacao(status: string): [number, number, number] {
  return STATUS_ATUALIZACAO_RGB[status] || [100, 116, 139]
}

function conteudoInfo(p: MapaCalorPonto): string {
  const cor = STATUS_ATUALIZACAO_COR[p.status_atualizacao] || "#64748b"
  const atualizacaoLabel = STATUS_ATUALIZACAO_LABEL[p.status_atualizacao] || p.status_atualizacao || "-"
  return `<div style="font-size:12px;line-height:1.5;max-width:220px;color:#1f2937;font-family:system-ui,sans-serif">
      <div style="font-weight:700;font-size:13px;margin-bottom:2px;color:#111827">${escapeHtml(p.nome)}</div>
      <div><b>Localidade/Bairro:</b> ${escapeHtml(p.bairro || "-")}</div>
      <div><b>Endereço:</b> ${escapeHtml([p.rua, p.numero].filter(Boolean).join(", ") || "-")}</div>
      <div><b>Benefício:</b> ${escapeHtml(p.beneficio || p.beneficios.join(", ") || "-")}</div>
      <div><b>Status:</b> ${escapeHtml(p.status || "-")}</div>
      <div style="display:flex;align-items:center;gap:4px"><b>Atualização:</b> <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cor}"></span> ${escapeHtml(atualizacaoLabel)}</div>
      <div><b>Precisão:</b> ${escapeHtml(p.precisao || "-")}</div>
    </div>`
}

export interface MapaGoogleProps {
  pontos: MapaCalorPonto[]
  modo: "pontos" | "calor"
  raio: number
  intensidade: number
  modoManual: boolean
  onMapClick?: (lat: number, lng: number) => void
}

function Overlays({ pontos, modo, raio, intensidade, modoManual, onMapClick }: MapaGoogleProps) {
  const map = useMap()
  const mapsLib = useMapsLibrary("maps")
  const coreLib = useMapsLibrary("core")
  const overlayRef = useRef<GoogleMapsOverlay | null>(null)
  const infoRef = useRef<google.maps.InfoWindow | null>(null)

  const pontosValidos = useMemo(
    () =>
      pontos.filter(
        (p) =>
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude) &&
          p.latitude >= AMAZONAS_BOUNDS.south &&
          p.latitude <= AMAZONAS_BOUNDS.north &&
          p.longitude >= AMAZONAS_BOUNDS.west &&
          p.longitude <= AMAZONAS_BOUNDS.east,
      ),
    [pontos],
  )

  // Ajusta o enquadramento aos pontos (exceto no modo manual).
  useEffect(() => {
    if (!map || !coreLib || modoManual || pontosValidos.length === 0) return
    // Com um único ponto, fitBounds estoura o zoom (área zero). Centraliza e
    // aplica um zoom fixo razoável nesse caso.
    if (pontosValidos.length === 1) {
      const p = pontosValidos[0]
      map.setCenter({ lat: p.latitude, lng: p.longitude })
      map.setZoom(16)
      return
    }
    const bounds = new coreLib.LatLngBounds()
    pontosValidos.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }))
    map.fitBounds(bounds, 48)
  }, [map, coreLib, pontosValidos, modoManual])

  // Mantém uma única instância da camada GPU. Recriá-la durante alterações de
  // filtros ou sliders deixa canvases WebGL pendurados e torna o mapa instável.
  useEffect(() => {
    if (!map) return

    // Canvas separado deixa os pontos acima de nomes, vias e outros rótulos
    // do Google Maps, em vez de ocultá-los atrás desses elementos.
    const overlay = new GoogleMapsOverlay({ interleaved: false, layers: [] })
    overlay.setMap(map)
    overlayRef.current = overlay

    return () => {
      if (overlayRef.current === overlay) overlayRef.current = null
      try {
        overlay.setMap(null)
      } catch {
        /* ignore */
      }
    }
  }, [map])

  useEffect(() => {
    if (!mapsLib) return
    const info = new mapsLib.InfoWindow()
    infoRef.current = info

    return () => {
      if (infoRef.current === info) infoRef.current = null
      info.close()
    }
  }, [mapsLib])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    const layers =
      modo === "pontos"
        ? [
            new IconLayer<MapaCalorPonto>({
              id: "pontos-beneficiarios",
              data: pontosValidos,
              getPosition: (d) => [d.longitude, d.latitude],
              iconAtlas: PIN_URL,
              iconMapping: PIN_MAPPING,
              getIcon: () => "pin",
              getColor: (d) => corRgbPorAtualizacao(d.status_atualizacao),
              getSize: 34,
              sizeUnits: "pixels",
              sizeMinPixels: 24,
              sizeMaxPixels: 40,
              pickable: true,
              onClick: (pick) => {
                const p = pick.object as MapaCalorPonto | undefined
                const info = infoRef.current
                if (!p || !info || !map) return
                info.setContent(conteudoInfo(p))
                info.setPosition({ lat: p.latitude, lng: p.longitude })
                info.open({ map })
                return true
              },
            }),
          ]
        : [
            new HeatmapLayer<MapaCalorPonto>({
              id: "heatmap-beneficiarios",
              data: pontosValidos,
              getPosition: (d) => [d.longitude, d.latitude],
              getWeight: () => 1,
              radiusPixels: raio,
              intensity: Math.max(1, intensidade * 3),
              opacity: 0.7,
            }),
          ]

    try {
      overlay.setProps({ layers })
    } catch (err) {
      console.error("Erro ao atualizar a camada do mapa:", err)
    }
  }, [map, pontosValidos, modo, raio, intensidade])

  // Clique no mapa (modo pino manual).
  useEffect(() => {
    if (!map || !modoManual || !onMapClick) return
    const listener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
      if (event.latLng) onMapClick(event.latLng.lat(), event.latLng.lng())
    })
    return () => listener.remove()
  }, [map, modoManual, onMapClick])

  return null
}

export default function MapaGoogle(props: MapaGoogleProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Defina <code className="mx-1 rounded bg-muted px-1.5 py-0.5">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> no
        .env.local para carregar o Google Maps.
      </div>
    )
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={TEFE_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        minZoom={6}
        mapId={mapId}
        gestureHandling="greedy"
        disableDefaultUI={false}
        restriction={{ latLngBounds: AMAZONAS_BOUNDS, strictBounds: true }}
        draggableCursor={props.modoManual ? "crosshair" : undefined}
        style={{ width: "100%", height: "100%" }}
      >
        <Overlays {...props} />
      </Map>
    </APIProvider>
  )
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
