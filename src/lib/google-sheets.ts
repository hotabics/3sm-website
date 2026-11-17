import { createSign } from "node:crypto";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
export const MAX_GOOGLE_SHEETS_RESERVATION_ROW = 10_000;

type AccessToken = { value: string; expiresAt: number };

let cachedToken: AccessToken | null = null;

export type GoogleSheetTrainingMap = {
  spreadsheet_id: string;
  sheet_name: string;
  column_index: number;
  count_row: number;
  roster_start_row: number;
  roster_end_row: number;
  queue_start_row: number;
  queue_end_row: number;
};

export type TrainingSheetSnapshot = {
  confirmedNames: string[];
  queueNames: string[];
};

type ValueRange = { range: string; values: string[][] };

export type GoogleSheetColumnPlayer = {
  row: number;
  cell: string;
  displayName: string;
  status: "confirmed" | "queue";
};

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function serviceAccountConfig():
  | { email: string; privateKey: string }
  | null {
  const email = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );
  if (!email || !privateKey) return null;
  return { email, privateKey };
}

export function isGoogleSheetsSyncEnabled() {
  return process.env.GOOGLE_SHEETS_SYNC_ENABLED === "true";
}

export function getGoogleSheetsConfigurationError(): string | null {
  if (!isGoogleSheetsSyncEnabled()) {
    return "GOOGLE_SHEETS_SYNC_ENABLED nav true.";
  }
  if (!serviceAccountConfig()) {
    return "Trūkst Google Sheets service account e-pasts vai privātā atslēga.";
  }
  return null;
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const config = serviceAccountConfig();
  if (!config) throw new Error("Google Sheets service account nav konfigurēts.");

  const issuedAt = Math.floor(now / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: config.email,
      scope: SHEETS_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    })
  );
  const unsignedToken = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const assertion = `${unsignedToken}.${base64Url(signer.sign(config.privateKey))}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? "Neizdevās autorizēties Google Sheets API.");
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: now + (payload.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

function columnLabel(columnIndex: number) {
  if (!Number.isInteger(columnIndex) || columnIndex < 1) {
    throw new Error("Nederīgs Google Sheets kolonnas numurs.");
  }
  let value = columnIndex;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function quotedSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function rangeForColumn(
  map: GoogleSheetTrainingMap,
  startRow: number,
  endRow: number
) {
  const column = columnLabel(map.column_index);
  return `${quotedSheetName(map.sheet_name)}!${column}${startRow}:${column}${endRow}`;
}

function padRows(values: string[], numberOfRows: number) {
  return Array.from({ length: numberOfRows }, (_, index) => [values[index] ?? ""]);
}

/**
 * Pārvērš 3SM rezervāciju momentuzņēmumu pašreizējās mēneša tabulas vērtībās.
 * Pārsniegums pirms sastāva fiksēšanas tiek parādīts rezervē, lai neviens
 * pieteikums nepazūd tikai tāpēc, ka `confirmed` vēl ir provizorisks statuss.
 */
export function buildTrainingSheetValues(
  map: GoogleSheetTrainingMap,
  snapshot: TrainingSheetSnapshot,
  clearQueueThroughRow = map.queue_end_row
): ValueRange[] {
  const rosterSize = map.roster_end_row - map.roster_start_row + 1;
  const rosterNames = snapshot.confirmedNames.slice(0, rosterSize);
  const overflowNames = snapshot.confirmedNames.slice(rosterSize);
  const queueNames = [...overflowNames, ...snapshot.queueNames];
  if (map.queue_start_row + queueNames.length - 1 > MAX_GOOGLE_SHEETS_RESERVATION_ROW) {
    throw new Error("Rezervistu skaits pārsniedz Google Sheets drošības robežu.");
  }
  const queueEndRow = Math.max(
    map.queue_end_row,
    map.queue_start_row,
    clearQueueThroughRow,
    map.queue_start_row + queueNames.length - 1
  );
  if (queueEndRow > MAX_GOOGLE_SHEETS_RESERVATION_ROW) {
    throw new Error("Google Sheets rezervistu diapazons pārsniedz drošības robežu.");
  }
  const queueSize = queueEndRow - map.queue_start_row + 1;
  const column = columnLabel(map.column_index);
  const sheet = quotedSheetName(map.sheet_name);

  return [
    {
      range: `${sheet}!${column}${map.count_row}`,
      // 7. rinda skaita tikai pamatsastāvu; rezerve sākas zem 22. rindas.
      values: [[String(rosterNames.length)]],
    },
    {
      range: rangeForColumn(map, map.roster_start_row, map.roster_end_row),
      values: padRows(rosterNames, rosterSize),
    },
    {
      range: rangeForColumn(map, map.queue_start_row, queueEndRow),
      values: padRows(queueNames, queueSize),
    },
  ];
}

/** Lasa visu datuma kolonnu, nevis tikai pēdējo manuāli rediģēto šūnu. */
export async function readGoogleSheetColumnValues(map: GoogleSheetTrainingMap) {
  const configError = getGoogleSheetsConfigurationError();
  if (configError) throw new Error(configError);
  const token = await getAccessToken();
  const range = `${quotedSheetName(map.sheet_name)}!${columnLabel(map.column_index)}${map.roster_start_row}:${columnLabel(map.column_index)}`;
  const response = await fetch(
    `${GOOGLE_SHEETS_API}/${encodeURIComponent(map.spreadsheet_id)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets nolasīšanas kļūda (${response.status}): ${body.slice(0, 500)}`);
  }
  const payload = (await response.json()) as { values?: unknown[][] };
  return (payload.values ?? []).map((row) => String(row?.[0] ?? ""));
}

export function parseGoogleSheetColumnValues(
  map: GoogleSheetTrainingMap,
  values: string[]
): GoogleSheetColumnPlayer[] {
  const column = columnLabel(map.column_index);
  const players: GoogleSheetColumnPlayer[] = [];
  values.forEach((value, index) => {
    const row = map.roster_start_row + index;
    const displayName = value.normalize("NFC").trim().replace(/\s+/g, " ");
    if (!displayName || row === map.roster_end_row + 1) return;
    if (row > MAX_GOOGLE_SHEETS_RESERVATION_ROW) {
      throw new Error(`Šūna ${column}${row} pārsniedz Google Sheets drošības robežu.`);
    }
    if (row > map.roster_end_row && row < map.queue_start_row) return;
    players.push({
      row,
      cell: `${column}${row}`,
      displayName,
      status: row <= map.roster_end_row ? "confirmed" : "queue",
    });
  });
  return players;
}

export async function writeGoogleSheetValues(
  spreadsheetId: string,
  values: ValueRange[]
) {
  const configError = getGoogleSheetsConfigurationError();
  if (configError) throw new Error(configError);

  const accessToken = await getAccessToken();
  const response = await fetch(
    `${GOOGLE_SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: values }),
    }
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets API kļūda (${response.status}): ${body.slice(0, 500)}`);
  }
}

export function columnIndexFromA1(cell: string) {
  const match = /^([A-Z]+)(\d+)$/i.exec(cell.trim());
  if (!match) return null;
  const letters = match[1].toUpperCase();
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return { columnIndex: index, row: Number(match[2]) };
}

export function normalizeGoogleSheetAlias(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("lv-LV");
}

/** Eksportā atgriež tikai jau atpazīstamu Sheets vārdu. */
export function chooseGoogleSheetExportName(
  existingSheetName: string | undefined,
  profileName: string,
  aliases: { display_alias: string; normalized_alias: string }[]
) {
  if (existingSheetName) return existingSheetName;
  const preferred = normalizeGoogleSheetAlias(profileName);
  return (
    aliases.find((alias) => alias.normalized_alias === preferred) ?? aliases[0]
  )?.display_alias ?? null;
}

/** Tikai administratora apstiprināti varianti drīkst norādīt uz spēlētāju. */
export function parseGoogleSheetAliases(value: string) {
  const aliases = new Map<string, { display_alias: string; normalized_alias: string }>();
  for (const part of value.split(/[,;\n]+/)) {
    const displayAlias = part.normalize("NFC").trim().replace(/\s+/g, " ");
    const normalizedAlias = normalizeGoogleSheetAlias(displayAlias);
    if (normalizedAlias && !aliases.has(normalizedAlias)) {
      aliases.set(normalizedAlias, {
        display_alias: displayAlias,
        normalized_alias: normalizedAlias,
      });
    }
  }
  return [...aliases.values()];
}
