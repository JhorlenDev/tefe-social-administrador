import NextAuth from "next-auth"
import Keycloak from "next-auth/providers/keycloak"
import type { NextAuthConfig } from "next-auth"

declare module "next-auth" {
  interface Session {
    access_token: string
    roles: string[]
    error?: string
  }
}

type KeycloakPayload = {
  realm_access?: { roles?: string[] }
  resource_access?: Record<string, { roles?: string[] }>
}

function decodeAccessToken(accessToken: string): KeycloakPayload {
  return JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString()) as KeycloakPayload
}

function extractRoles(payload: KeycloakPayload) {
  const roles = new Set<string>()

  for (const role of payload.realm_access?.roles ?? []) {
    roles.add(role)
  }

  for (const clientData of Object.values(payload.resource_access ?? {})) {
    for (const role of clientData.roles ?? []) {
      roles.add(role)
    }
  }

  return Array.from(roles)
}

export const config: NextAuthConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,

  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
      issuer: process.env.AUTH_KEYCLOAK_ISSUER,
      authorization: {
        params: {
          scope: "openid email profile roles",
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        const accessToken = account.access_token!

        const payload = decodeAccessToken(accessToken)

        console.log("========== KEYCLOAK ==========")
        console.log("USUÁRIO:", profile?.preferred_username)
        console.log("REALM ACCESS:", payload.realm_access)
        console.log("ROLES:", payload.realm_access?.roles)
        console.log("RESOURCE ACCESS:", payload.resource_access)
        console.log("==============================")

        token.access_token = accessToken
        token.expires_at = account.expires_at!
        token.refreshToken = account.refresh_token

        token.roles = extractRoles(payload)

        token.id = profile?.sub

        return token
      }

      if (Date.now() < (token.expires_at as number) * 1000) {
        return token
      }

      try {
        const response = await fetch(
          `${process.env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/token`,
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: process.env.AUTH_KEYCLOAK_ID!,
              client_secret: process.env.AUTH_KEYCLOAK_SECRET!,
              grant_type: "refresh_token",
              refresh_token: token.refreshToken as string,
            }),
            method: "POST",
          }
        )

        const tokens = await response.json()

        if (!response.ok) {
          throw tokens
        }

        const payload = decodeAccessToken(tokens.access_token)

        return {
          ...token,
          access_token: tokens.access_token,
          expires_at:
            Math.floor(Date.now() / 1000) +
            tokens.expires_in,
          refreshToken:
            tokens.refresh_token ?? token.refreshToken,
          roles: extractRoles(payload),
        }
      } catch {
        return {
          ...token,
          error: "RefreshAccessTokenError",
        }
      }
    },

    async session({ session, token }) {
      session.access_token = token.access_token as string
      session.roles = (token.roles as string[]) ?? []
      session.error = token.error as string

      return session
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  trustHost: true,
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth(config)
