import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export type UserRole = "ADMIN" | "USER";

export interface AuthSession {
  username: string;
  role: UserRole;
  displayName: string;
}

const SESSION_COOKIE_NAME = "cymfarm_session";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  try {
    const session = JSON.parse(decodeURIComponent(raw)) as AuthSession;
    return NextResponse.json({ user: session });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();

    const adminUser = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
    const adminPass = (process.env.ADMIN_PASSWORD || "admin123").trim();
    const regularUser = (process.env.USER_USERNAME || "keluarga").trim().toLowerCase();
    const regularPass = (process.env.USER_PASSWORD || "lele123").trim();

    let session: AuthSession | null = null;

    if (username === adminUser && password === adminPass) {
      session = {
        username: adminUser,
        role: "ADMIN",
        displayName: "Admin Utama",
      };
    } else if (username === regularUser && password === regularPass) {
      session = {
        username: regularUser,
        role: "USER",
        displayName: "Petugas Lapangan / Keluarga",
      };
    }

    if (!session) {
      return NextResponse.json(
        { error: "Nama pengguna atau kata sandi salah." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ user: session });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      encodeURIComponent(JSON.stringify(session)),
      {
        httpOnly: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      }
    );

    return response;
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat masuk." },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
