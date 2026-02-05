import { auth } from "@/auth";

export default auth((req) => {
	// Check if the user is not authenticated and is trying to access a protected page
	// Then redirect them to the login page
  if (!req.auth && req.nextUrl.pathname !== "/login" && req.nextUrl.pathname !== "/register" && req.nextUrl.pathname !== "/") {
    const newUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }

  // Check if the user is authenticated and is trying to access a login or register page
	// Then redirect them to the home page
  if (req.auth && (req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/register")) {
    const newUrl = new URL("/", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }
});

export const config = {
  // matcher: ["/((?!api|widgets.css|widgets.js|_next/static|_next/image|favicon.ico).*)"],
  matcher: ['/login', '/register', '/dashboard', '/integrations', '/widgets'],
};
