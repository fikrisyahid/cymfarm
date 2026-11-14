import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const dynamic = "force-dynamic";

const SESSION_COOKIE_NAME = "cymfarm_session";

export async function POST() {
  try {
    // 1. Authorize admin only
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!raw) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
      const session = JSON.parse(decodeURIComponent(raw));
      if (session.role !== "ADMIN") {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 });
    }

    // 2. Delete all rows from tables in dependency-safe order (children before parents)
    await db.delete(schema.activityLogs);
    await db.delete(schema.subjects);
    await db.delete(schema.containers);
    await db.delete(schema.farmModules);
    await db.delete(schema.feedPurchases);
    // Kita sengaja sisakan default module categories & feed categories agar aplikasi tetap punya kategori dasar

    return NextResponse.json({
      success: true,
      message: "Seluruh data operasional di cloud Supabase berhasil dihapus.",
    });
  } catch (error: any) {
    console.error("[Reset Cloud DB Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengosongkan database cloud." },
      { status: 500 }
    );
  }
}
