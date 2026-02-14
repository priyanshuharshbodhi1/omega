import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [], // Providers will be added in auth.ts to avoid Edge Runtime issues
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = ["/dashboard", "/integrations", "/widgets"].includes(
        nextUrl.pathname,
      );

      if (isProtected) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      } else if (
        isLoggedIn &&
        (nextUrl.pathname === "/login" || nextUrl.pathname === "/register")
      ) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.currentTeamId = (user as any).currentTeamId;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).currentTeamId = token.currentTeamId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
