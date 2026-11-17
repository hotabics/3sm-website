/**
 * 3SM Google Sheets pieteikumu tilts.
 *
 * Ielīmē šo kodu testa kopijas Extensions → Apps Script projektā, iestati
 * Script Properties (3SM_ENDPOINT un 3SM_WEBHOOK_SECRET) un vienreiz palaid
 * install3smOnEditTrigger. Parastie tabulas redaktori neredz slepeno atslēgu.
 */
function install3smOnEditTrigger() {
  const spreadsheet = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "on3smReservationEdit")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("on3smReservationEdit")
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();
}

function on3smReservationEdit(event) {
  if (!event || !event.range || event.range.getNumRows() !== 1 || event.range.getNumColumns() !== 1) {
    return;
  }

  const value = String(event.value || "").trim();
  const oldValue = String(event.oldValue || "").trim();
  if (!value && !oldValue) return;

  const properties = PropertiesService.getScriptProperties();
  const endpoint = properties.getProperty("3SM_ENDPOINT");
  const secret = properties.getProperty("3SM_WEBHOOK_SECRET");
  if (!endpoint || !secret) {
    event.range.setNote("[3SM] Integrācija nav konfigurēta.");
    return;
  }

  // Pārrakstot šūnu, vispirms atceļam iepriekšējo vārdu un tad piesakām
  // jauno. Pretējā gadījumā viena šūna varētu atstāt divus pieteikumus.
  const commands = [];
  if (oldValue && oldValue !== value) commands.push({ action: "cancel", displayName: oldValue });
  if (value && oldValue !== value) commands.push({ action: "join", displayName: value });
  if (commands.length === 0) return;

  try {
    const results = commands.map((command) =>
      send3smReservationCommand(endpoint, secret, {
        event_id: Utilities.getUuid(),
        spreadsheet_id: event.source.getId(),
        sheet_gid: event.range.getSheet().getSheetId(),
        cell: event.range.getA1Notation(),
        action: command.action,
        display_name: command.displayName,
      })
    );
    const note = results
      .map((result) => `[3SM] ${result.message || "Pieteikums apstrādāts."}${
        result.state === "needs_payment" ? ` ${result.app_url || "https://3sm.lv"}` : ""
      }`)
      .join("\n");
    event.range.setNote(note);
  } catch (error) {
    event.range.setNote(`[3SM] Savienojuma kļūda: ${error.message || error}`);
  }
}

function send3smReservationCommand(endpoint, secret, payload) {
  const rawBody = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const signatureBytes = Utilities.computeHmacSha256Signature(`${timestamp}.${rawBody}`, secret);
  const signature = signatureBytes
    .map((byte) => (`0${(byte & 0xff).toString(16)}`).slice(-2))
    .join("");
  const httpResponse = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "application/json",
    payload: rawBody,
    headers: {
      "X-3SM-Timestamp": timestamp,
      "X-3SM-Signature": signature,
    },
    muteHttpExceptions: true,
  });
  return JSON.parse(httpResponse.getContentText());
}
