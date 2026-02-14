import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // matcher: ["/((?!api|widgets.css|widgets.js|_next/static|_next/image|favicon.ico).*)"],
  matcher: ["/login", "/register", "/dashboard", "/integrations", "/widgets"],
};
