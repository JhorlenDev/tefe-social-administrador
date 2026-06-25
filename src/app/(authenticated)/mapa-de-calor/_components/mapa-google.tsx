"use client"

import { useEffect, useMemo } from "react"
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps"
import { GoogleMapsOverlay } from "@deck.gl/google-maps"
import { HeatmapLayer } from "@deck.gl/aggregation-layers"
import type { MapaCalorPonto } from "@/types"

// Centro de Tefé/AM
const TEFE_CENTER = { lat: -3.3548, lng: -64.7117 }
const DEFAULT_ZOOM = 13

// Cor do marcador por status de atualização do cidadão.
const STATUS_ATUALIZACAO_COR: Record<string, string> = {
  ATUALIZADO: "#22c55e", // verde
  PENDENTE: "#ef4444", // vermelho
  DESATUALIZADO: "#9ca3af", // cinza
}

const STATUS_ATUALIZACAO_LABEL: Record<string, string> = {
  ATUALIZADO: "Atualizado",
  PENDENTE: "Pendente",
  DESATUALIZADO: "Desatualizado",
}

function corPorAtualizacao(status: string) {
  return STATUS_ATUALIZACAO_COR[status] || "#64748b"
}

// Cria um marcador em forma de "pessoa" (ícone branco dentro de um pino colorido).
function criarPinPessoa(cor: string) {
  const wrapper = document.createElement("div")
  wrapper.style.cssText = "transform:translateY(-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"
  wrapper.innerHTML = `
    <svg width="32" height="40" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C7 0 0.6 6.4 0.6 14.4 0.6 24.5 15 38 15 38S29.4 24.5 29.4 14.4C29.4 6.4 23 0 15 0Z" fill="${cor}" stroke="#ffffff" stroke-width="2"/>
      <g fill="#ffffff" transform="translate(7.5,5.5)">
        <circle cx="7.5" cy="5.5" r="3.2"/>
        <path d="M1 16c0-3.6 2.9-6.5 6.5-6.5S14 12.4 14 16Z"/>
      </g>
    </svg>`
  return wrapper.firstElementChild as SVGElement
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
  const markerLib = useMapsLibrary("marker")
  const coreLib = useMapsLibrary("core")

  const pontosValidos = useMemo(
    () => pontos.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)),
    [pontos],
  )

  // Ajusta o enquadramento aos pontos (exceto no modo manual).
  useEffect(() => {
    if (!map || !coreLib || modoManual || pontosValidos.length === 0) return
    const bounds = new coreLib.LatLngBounds()
    pontosValidos.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }))
    map.fitBounds(bounds, 48)
  }, [map, coreLib, pontosValidos, modoManual])

  // Marcadores (modo pontos).
  useEffect(() => {
    if (!map || !markerLib || !mapsLib || modo !== "pontos") return
    const info = new mapsLib.InfoWindow()
    const markers = pontosValidos.map((p) => {
      const cor = corPorAtualizacao(p.status_atualizacao)
      const marker = new markerLib.AdvancedMarkerElement({
        map,
        position: { lat: p.latitude, lng: p.longitude },
        title: p.nome,
        content: criarPinPessoa(cor),
      })
      marker.addListener("click", () => {
        const atualizacaoLabel = STATUS_ATUALIZACAO_LABEL[p.status_atualizacao] || p.status_atualizacao || "-"
        info.setContent(
          `<div style="font-size:12px;line-height:1.5;max-width:220px;color:#1f2937;font-family:system-ui,sans-serif">
            <div style="font-weight:700;font-size:13px;margin-bottom:2px;color:#111827">${escapeHtml(p.nome)}</div>
            <div><b>Localidade/Bairro:</b> ${escapeHtml(p.bairro || "-")}</div>
            <div><b>Endereço:</b> ${escapeHtml([p.rua, p.numero].filter(Boolean).join(", ") || "-")}</div>
            <div><b>Benefício:</b> ${escapeHtml(p.beneficio || p.beneficios.join(", ") || "-")}</div>
            <div><b>Status:</b> ${escapeHtml(p.status || "-")}</div>
            <div style="display:flex;align-items:center;gap:4px"><b>Atualização:</b> <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cor}"></span> ${escapeHtml(atualizacaoLabel)}</div>
            <div><b>Precisão:</b> ${escapeHtml(p.precisao || "-")}</div>
          </div>`,
        )
        info.open({ anchor: marker, map })
      })
      return marker
    })
    // Clicar fora dos marcadores (em qualquer lugar do mapa) fecha o balão.
    const fecharAoClicarFora = map.addListener("click", () => info.close())
    return () => {
      fecharAoClicarFora.remove()
      info.close()
      markers.forEach((m) => {
        m.map = null
      })
    }
  }, [map, markerLib, mapsLib, pontosValidos, modo])

  // Camada de calor (modo calor) — via deck.gl, sobre o Google Maps.
  useEffect(() => {
    if (!map || modo !== "calor") return
    let overlay: GoogleMapsOverlay | null = null
    try {
      overlay = new GoogleMapsOverlay({
        layers: [
          new HeatmapLayer<MapaCalorPonto>({
            id: "heatmap-beneficiarios",
            data: pontosValidos,
            getPosition: (d) => [d.longitude, d.latitude],
            getWeight: () => 1,
            radiusPixels: raio,
            intensity: Math.max(1, intensidade * 3),
            opacity: 0.7,
          }),
        ],
      })
      overlay.setMap(map)
    } catch (err) {
      console.error("Erro ao montar o mapa de calor:", err)
    }
    return () => {
      try {
        overlay?.setMap(null)
      } catch {
        /* ignore */
      }
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
        mapId={mapId}
        gestureHandling="greedy"
        disableDefaultUI={false}
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
