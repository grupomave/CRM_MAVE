import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/change-password",
  "/forgot-password",
];

// Evita reconsultar `profiles.must_change_password` a cada navegação: o
// resultado "false" fica em cookie por alguns minutos. Se um admin forçar
// troca de senha nesse intervalo, o usuário só é barrado após o cookie
// expirar (atraso máximo de MUST_CHANGE_PASSWORD_CACHE_SECONDS).
const MUST_CHANGE_PASSWORD_CACHE_COOKIE = "mcp_ok";
const MUST_CHANGE_PASSWORD_CACHE_SECONDS = 300;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  if (user && request.nextUrl.pathname !== "/change-password") {
    const cachedOk =
      request.cookies.get(MUST_CHANGE_PASSWORD_CACHE_COOKIE)?.value ===
      user.id;

    if (!cachedOk) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", user.id)
        .single();

      if (profile?.must_change_password) {
        const changePasswordUrl = request.nextUrl.clone();
        changePasswordUrl.pathname = "/change-password";
        return NextResponse.redirect(changePasswordUrl);
      }

      supabaseResponse.cookies.set(
        MUST_CHANGE_PASSWORD_CACHE_COOKIE,
        user.id,
        {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: MUST_CHANGE_PASSWORD_CACHE_SECONDS,
          path: "/",
        },
      );
    }
  }

  return supabaseResponse;
}
