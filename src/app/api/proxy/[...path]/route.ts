import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

const UPSTREAM = process.env.API_UPSTREAM || "https://apibolsatefe.tefe.am.gov.br"
const API_PATH = process.env.API_PATH || "/api"

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  let session
  try {
    session = await auth()
  } catch {
    return NextResponse.json({ detail: "Sessão inválida" }, { status: 401 })
  }

  const pathStr = path.join("/")
  const url = `${UPSTREAM}${API_PATH}/${pathStr}${request.nextUrl.search}`
  console.log(`[proxy] ${request.method} ${url}`)

  const headers: Record<string, string> = {}
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`
  }

  const response = await fetch(url, { headers })
  const body = await response.text()
  console.log(`[proxy] ${response.status} for ${url}`)

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
    },
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  let session
  try {
    session = await auth()
  } catch {
    return NextResponse.json({ detail: "Sessão inválida" }, { status: 401 })
  }

  const pathStr = path.join("/")
  const url = `${UPSTREAM}${API_PATH}/${pathStr}${request.nextUrl.search}`
  console.log(`[proxy] ${request.method} ${url}`)

  const bodyText = await request.text()

  const headers: Record<string, string> = {
    "Content-Type": request.headers.get("Content-Type") || "application/json",
  }
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`
  }

  const response = await fetch(url, { method: "POST", headers, body: bodyText })
  const body = await response.text()
  console.log(`[proxy] ${response.status} for ${url}`)

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
    },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  let session
  try {
    session = await auth()
  } catch {
    return NextResponse.json({ detail: "Sessão inválida" }, { status: 401 })
  }

  const pathStr = path.join("/")
  const url = `${UPSTREAM}${API_PATH}/${pathStr}${request.nextUrl.search}`

  const bodyText = await request.text()

  const headers: Record<string, string> = {
    "Content-Type": request.headers.get("Content-Type") || "application/json",
  }
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`
  }

  const response = await fetch(url, { method: "PATCH", headers, body: bodyText })
  const body = await response.text()

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
    },
  })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  let session
  try {
    session = await auth()
  } catch {
    return NextResponse.json({ detail: "Sessão inválida" }, { status: 401 })
  }

  const pathStr = path.join("/")
  const url = `${UPSTREAM}${API_PATH}/${pathStr}${request.nextUrl.search}`

  const headers: Record<string, string> = {}
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`
  }

  const response = await fetch(url, { method: "DELETE", headers })
  const body = await response.text()

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
    },
  })
}

export const dynamic = "force-dynamic"
