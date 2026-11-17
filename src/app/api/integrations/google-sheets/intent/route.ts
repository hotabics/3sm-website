import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { MAX_GOOGLE_SHEETS_RESERVATION_ROW, columnIndexFromA1, normalizeGoogleSheetAlias } from "@/lib/google-sheets";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type SheetIntent = {
  event_id: string;
  spreadsheet_id: string;
  sheet_gid: number;
  cell: string;
  action: "join" | "cancel";
  display_name: string;
};

function response(state: string, message: string, status = 200) {
  return NextResponse.json(
    {
      state,
      message,
      app_url: process.env.NEXT_PUBLIC_APP_URL ?? "https://3sm.lv",
    },
    { status }
  );
}

function signatureIsValid(rawBody: string, timestamp: string, signature: string | null) {
  const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function parseIntent(value: unknown): SheetIntent | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.event_id !== "string" ||
    body.event_id.length < 16 ||
    body.event_id.length > 128 ||
    typeof body.spreadsheet_id !== "string" ||
    !/^[A-Za-z0-9_-]{20,128}$/.test(body.spreadsheet_id) ||
    typeof body.sheet_gid !== "number" ||
    !Number.isSafeInteger(body.sheet_gid) ||
    typeof body.cell !== "string" ||
    typeof body.display_name !== "string" ||
    !["join", "cancel"].includes(String(body.action))
  ) {
    return null;
  }
  const cell = columnIndexFromA1(body.cell);
  const displayName = body.display_name.trim();
  if (!cell || !displayName || displayName.length > 120) return null;
  return {
    event_id: body.event_id,
    spreadsheet_id: body.spreadsheet_id,
    sheet_gid: body.sheet_gid,
    cell: body.cell.toUpperCase(),
    action: body.action as "join" | "cancel",
    display_name: displayName,
  };
}

async function recordUnmatchedCommand(intent: SheetIntent, state: "unmatched" | "rejected", message: string) {
  const admin = createAdminClient();
  await admin.from("google_sheet_commands").upsert(
    {
      event_id: intent.event_id,
      spreadsheet_id: intent.spreadsheet_id,
      sheet_gid: intent.sheet_gid,
      cell_a1: intent.cell,
      action: intent.action,
      requested_name: intent.display_name,
      status: state,
      result: { state, message },
      processed_at: new Date().toISOString(),
    },
    { onConflict: "event_id", ignoreDuplicates: true }
  );
}

export async function POST(request: Request) {
  const timestamp = request.headers.get("x-3sm-timestamp") ?? "";
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) {
    return response("rejected", "Nederīgs vai novecojis Sheets pieprasījums.", 401);
  }

  const rawBody = await request.text();
  if (rawBody.length > 4_000) return response("rejected", "Pieprasījums ir par lielu.", 413);
  if (!process.env.GOOGLE_SHEETS_WEBHOOK_SECRET) {
    return response("rejected", "Google Sheets integrācija vēl nav konfigurēta.", 503);
  }
  if (!signatureIsValid(rawBody, timestamp, request.headers.get("x-3sm-signature"))) {
    return response("rejected", "Nederīgs Google Sheets paraksts.", 401);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return response("rejected", "Nederīgs JSON pieprasījums.", 400);
  }
  const intent = parseIntent(parsed);
  if (!intent) return response("rejected", "Nederīgs Sheets pieteikuma formāts.", 400);

  const testSpreadsheetId = process.env.GOOGLE_SHEETS_TEST_SPREADSHEET_ID;
  if (testSpreadsheetId && intent.spreadsheet_id !== testSpreadsheetId) {
    return response("rejected", "Šī Sheets kopija nav atļauta testēšanai.", 403);
  }

  const position = columnIndexFromA1(intent.cell)!;
  const admin = createAdminClient();
  const { data: mapData } = await admin
    .from("google_sheet_training_maps")
    .select(
      "id, training_id, roster_start_row, roster_end_row, queue_start_row, queue_end_row"
    )
    .eq("spreadsheet_id", intent.spreadsheet_id)
    .eq("sheet_gid", intent.sheet_gid)
    .eq("column_index", position.columnIndex)
    .eq("enabled", true)
    .maybeSingle();

  type Map = {
    id: string;
    training_id: string;
    roster_start_row: number;
    roster_end_row: number;
    queue_start_row: number;
    queue_end_row: number;
  };
  const map = (mapData ?? null) as Map | null;
  if (!map) {
    await recordUnmatchedCommand(intent, "unmatched", "Šim datumam nav piesaistīts 3SM treniņš.");
    return response("unmatched", "Šim datumam nav piesaistīts 3SM treniņš.");
  }

  const allowedRow =
    (position.row >= map.roster_start_row && position.row <= map.roster_end_row) ||
    (position.row >= map.queue_start_row && position.row <= MAX_GOOGLE_SHEETS_RESERVATION_ROW);
  if (!allowedRow) {
    await recordUnmatchedCommand(intent, "rejected", "Šī šūna nav rezervāciju ievades zona.");
    return response("rejected", "Šī šūna nav rezervāciju ievades zona.");
  }

  const normalizedAlias = normalizeGoogleSheetAlias(intent.display_name);
  const { data: aliasData } = await admin
    .from("google_sheet_player_aliases")
    .select("user_id")
    .eq("normalized_alias", normalizedAlias)
    .maybeSingle();
  const alias = (aliasData ?? null) as { user_id: string } | null;
  if (!alias) {
    const { data, error } = await admin.rpc("process_google_sheet_guest_command", {
      p_event_id: intent.event_id,
      p_map_id: map.id,
      p_column_index: position.columnIndex,
      p_cell_a1: intent.cell,
      p_action: intent.action,
      p_requested_name: intent.display_name,
      p_normalized_name: normalizedAlias,
    });
    if (error) {
      console.error("[google-sheets-guest-intent]", error);
      return response("rejected", "Neizdevās apstrādāt neidentificētā spēlētāja pieteikumu.", 500);
    }
    const result = (data ?? {}) as { state?: string; message?: string };
    return response(result.state ?? "rejected", result.message ?? "Pieteikums netika apstrādāts.");
  }

  const { data, error } = await admin.rpc("process_google_sheet_reservation_command", {
    p_event_id: intent.event_id,
    p_map_id: map.id,
    p_user_id: alias.user_id,
    p_training_id: map.training_id,
    p_spreadsheet_id: intent.spreadsheet_id,
    p_sheet_gid: intent.sheet_gid,
    p_cell_a1: intent.cell,
    p_action: intent.action,
    p_requested_name: intent.display_name,
  });
  if (error) {
    console.error("[google-sheets-intent]", error);
    return response("rejected", "Neizdevās apstrādāt pieteikumu. Mēģini vēlreiz.", 500);
  }

  const result = (data ?? {}) as { state?: string; message?: string };
  return response(result.state ?? "rejected", result.message ?? "Pieteikums netika apstrādāts.");
}
