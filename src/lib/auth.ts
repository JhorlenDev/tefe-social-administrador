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
        token.access_token = account.access_token!
        token.expires_at = account.expires_at!
        token.refreshToken = account.refresh_token
        token.roles =
          profile && "realm_access" in profile
            ? ((profile.realm_access as { roles?: string[] })?.roles ?? [])
            : []
        token.id = profile?.sub
        return token
      }

      if (Date.now() < (token.expires_at as number) * 1000) {
        return token
      }

      try {
        const response = await fetch(`${process.env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.AUTH_KEYCLOAK_ID!,
            client_secret: process.env.AUTH_KEYCLOAK_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
          method: "POST",
        })

        const tokens = await response.json()

        if (!response.ok) throw tokens

        return {
          ...token,
          access_token: tokens.access_token,
          expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
          refreshToken: tokens.refresh_token ?? token.refreshToken,
        }
      } catch {
        return { ...token, error: "RefreshAccessTokenError" }
      }
    },
    async session({ session, token }) {
      session.access_token = token.access_token as string
      session.roles = token.roles as string[]
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

export const { handlers, auth, signIn, signOut } = NextAuth(config)
