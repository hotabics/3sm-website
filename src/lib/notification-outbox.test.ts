import assert from "node:assert/strict";
import test from "node:test";
import {
  formatRegistrationUpdateMessage,
  formatRemainingTime,
} from "@/lib/notification-outbox";

test("formatRemainingTime rāda dienas un stundas līdz pieteikšanās beigām", () => {
  const now = new Date("2026-08-08T10:00:00.000Z");
  assert.equal(formatRemainingTime("2026-08-09T13:05:00.000Z", now), "1 d. 3 h.");
  assert.equal(formatRemainingTime("2026-08-08T10:50:00.000Z", now), "50 min.");
  assert.equal(formatRemainingTime("2026-08-08T09:59:00.000Z", now), "pieteikšanās slēgta");
});

test("pieteikuma grupas ziņā ir skaits, rinda, brīvās vietas un laiks", () => {
  const message = formatRegistrationUpdateMessage(
    {
      player_name: "Jānis",
      training_date: "2026-08-13",
      start_time: "20:00:00",
      registration_closes_at: "2026-08-13T14:00:00.000Z",
      active_count: 9,
      confirmed_count: 7,
      queue_count: 2,
      max_players: 14,
      remaining_slots: 5,
    },
    new Date("2026-08-12T10:00:00.000Z")
  );

  assert.match(message, /Jānis pieteicās/);
  assert.match(message, /Pieteikušies: 9/);
  assert.match(message, /Pašlaik sastāvā: 7\/14/);
  assert.match(message, /Rindā: 2/);
  assert.match(message, /Brīvas vietas sastāvā: 5/);
  assert.match(message, /1 d\. 4 h\./);
});
