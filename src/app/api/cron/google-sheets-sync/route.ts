import { NextResponse } from "next/server";
import { deliverGoogleSheetsTrainingSync } from "@/lib/google-sheets-sync";

/** Regulāri aizvada 3SM rezervāciju momentuzņēmumus uz Google Sheets. */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await deliverGoogleSheetsTrainingSync();
  return NextResponse.json({ ok: true, ...result });
}
