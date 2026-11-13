import { NextResponse } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { logId } = await req.json();
    if (!logId) {
      return NextResponse.json({ success: false, error: "Missing logId" }, { status: 400 });
    }

    await db.delete(schema.activityLogs).where(eq(schema.activityLogs.id, logId));

    return NextResponse.json({ success: true, message: `Log ${logId} removed from cloud` });
  } catch (error: any) {
    console.error("[Sync Undo Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
