-- Fāze 6: idempotence komandu paziņojumiem.
-- Pēc tam, kad admins manuāli sadalījis spēlētājus pa komandām un nospiedis
-- "Sūtīt komandu paziņojumus", katrs spēlētājs saņem WhatsApp ar info, kuru
-- kreklu paņemt līdzi. Lai dubultsūtīšana nenotiek, glabājam, kura komanda
-- jau tika paziņota — atkārtotā sūtīšanā tiek skarti tikai tie, kuriem
-- komanda mainījusies (vai vēl nebija nosūtīta).

alter table public.registrations
  add column if not exists team_notified_for text
    check (team_notified_for in ('black', 'white')),
  add column if not exists team_notified_at timestamptz;
