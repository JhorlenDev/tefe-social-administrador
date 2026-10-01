import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const REQUIRED_ROLE = "USER-BOLSA-TEFE-ADMIN"
const AUTH_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
]

function redirectToLogin(request: Request, error?: string) {
  const url = new URL("/login", request.url)
  if (error) url.searchParams.set("error", error)

  const response = NextResponse.redirect(url)
  for (const cookie of AUTH_COOKIES) {
    response.cookies.delete(cookie)
  }
  return response
}

export async function proxy(request: Request) {
  const { pathname } = new URL(request.url)

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth") || pathname.startsWith("/_next")) {
    return
  }

  let session
  try {
    session = await auth()
  } catch {
    return redirectToLogin(request, "session")
  }

  if (!session) {
    return redirectToLogin(request)
  }

  if (!session.roles?.includes(REQUIRED_ROLE)) {
    return redirectToLogin(request, "unauthorized")
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
