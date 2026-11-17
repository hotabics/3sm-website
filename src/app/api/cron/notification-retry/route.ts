import { NextResponse } from "next/server";
import { deliverRegistrationUpdateNotifications } from "@/lib/notification-outbox";

/** Atkārtoti piegādā neizsūtītos WhatsApp grupas paziņojumus. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await deliverRegistrationUpdateNotifications({ limit: 20 });
  return NextResponse.json({ ok: true, ...result });
}
