/**
 * 3SM — Galvenā lietotnes loģika
 */

// ===== Mobile navigation =====
function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", links.classList.contains("open"));
  });

  document.querySelectorAll(".nav-links a").forEach(a => {
    a.addEventListener("click", () => links.classList.remove("open"));
  });
}

// ===== Fade-up scroll animation =====
function initFadeUp() {
  const elements = document.querySelectorAll(".fade-up");
  if (!("IntersectionObserver" in window)) {
    elements.forEach(el => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  elements.forEach(el => observer.observe(el));
}

// ===== Render players grid =====
function renderPlayers(containerId, limit = null, filter = "all") {
  const container = document.getElementById(containerId);
  if (!container || !window.PLAYERS) return;

  let list = [...window.PLAYERS];
  if (filter !== "all") {
    list = list.filter(p => p.positionShort === filter);
  }
  if (limit) list = list.slice(0, limit);

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state fade-up">
        <p>Tajā pozīcijā vēl nav neviena — vai gribi kļūt par pirmo?</p>
        <a href="index.html#kontakti" class="btn btn-ghost">Sazinies ar komandu</a>
      </div>`;
    requestAnimationFrame(() => {
      container.querySelectorAll(".fade-up").forEach(el => el.classList.add("visible"));
    });
    return;
  }

  container.innerHTML = list
    .map(
      (p, i) => `
      <a href="spelētājs.html?id=${p.id}" class="player-card fade-up" style="transition-delay: ${i * 60}ms">
        <div class="player-card-media">
          <div class="player-silhouette"></div>
          <div class="player-number">${p.number}</div>
        </div>
        <div class="player-card-info">
          <div class="player-position">${p.position}</div>
          <div class="player-name">${p.name}</div>
          <div class="player-nickname">„${p.nickname}"</div>
        </div>
      </a>
    `
    )
    .join("");

  requestAnimationFrame(() => {
    container.querySelectorAll(".fade-up").forEach(el => el.classList.add("visible"));
  });
}

// ===== Render filters =====
function renderFilters(containerId, onChange) {
  const container = document.getElementById(containerId);
  if (!container || !window.POSITIONS) return;

  container.innerHTML = window.POSITIONS.map(
    (pos, i) => `
    <button class="filter-btn ${i === 0 ? "active" : ""}" data-filter="${pos.id}">
      ${pos.label}
    </button>
  `
  ).join("");

  container.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      onChange(btn.dataset.filter);
    });
  });
}

// ===== Render single player profile =====
function renderProfile() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id || !window.PLAYERS) return;

  const player = window.PLAYERS.find(p => p.id === id);
  if (!player) {
    document.getElementById("profile-root").innerHTML = `
      <div style="padding: 8rem 2rem; text-align: center;">
        <h1>Spēlētājs nav atrasts</h1>
        <p style="color: var(--text-muted); margin: 1rem 0 2rem;">
          Atgriezties <a href="komanda.html">pie komandas</a>
        </p>
      </div>`;
    return;
  }

  document.title = `${player.name} — 3SM`;

  const statsHTML = Object.entries(player.stats)
    .map(
      ([label, value]) => `
      <div class="profile-stat">
        <span class="profile-stat-value">${value}</span>
        <span class="profile-stat-label">${label}</span>
      </div>
    `
    )
    .join("");

  const traitsHTML = Object.entries(player.traits)
    .map(
      ([label, value]) => `
      <div class="trait-card">
        <div class="trait-label">${label}</div>
        <div class="trait-value">${value}</div>
      </div>
    `
    )
    .join("");

  document.getElementById("profile-root").innerHTML = `
    <section class="profile-hero">
      <div class="profile-big-number">${player.number}</div>
      <div class="profile-content">
        <div class="profile-avatar fade-up">
          <div class="player-silhouette"></div>
        </div>
        <div class="fade-up" style="transition-delay: 150ms">
          <a href="komanda.html" class="profile-back">← Atpakaļ uz komandu</a>
          <div class="profile-eyebrow">#${player.number} · ${player.position}</div>
          <h1 class="profile-name">${player.name}</h1>
          <p class="profile-tagline">„${player.tagline}"</p>
          <div class="profile-stats">
            ${statsHTML}
          </div>
          <a href="#bio" class="btn btn-primary">Par spēlētāju ↓</a>
        </div>
      </div>
    </section>

    <section id="bio" class="section">
      <div class="container">
        <div class="section-head" style="text-align: left;">
          <span class="section-eyebrow">Par spēlētāju</span>
          <h2 class="section-title">Stāsts aiz <span>#${player.number}</span></h2>
        </div>
        <p class="profile-bio fade-up">${player.bio}</p>

        <h3 style="font-size: 1.5rem; text-transform: uppercase; margin: 3rem 0 1rem;" class="fade-up">Pazīmes</h3>
        <div class="profile-traits fade-up">
          ${traitsHTML}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <span class="section-eyebrow">Pieslēgts komandai kopš</span>
          <h2 class="section-title">${player.joinedYear}</h2>
          <p class="section-sub">
            ${new Date().getFullYear() - player.joinedYear} gadi ceturtdienas vakaros uz laukuma — un skaitītājs turpinās.
          </p>
        </div>
      </div>
    </section>
  `;

  requestAnimationFrame(() => initFadeUp());
}

// ===== Year updater =====
function updateYear() {
  const el = document.getElementById("year");
  if (el) el.textContent = new Date().getFullYear();
}

// ===== Init on DOM ready =====
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initFadeUp();
  updateYear();

  // Home: show featured players
  if (document.getElementById("featured-players")) {
    renderPlayers("featured-players", 8);
  }

  // Team page: full grid with filter
  if (document.getElementById("all-players")) {
    renderPlayers("all-players");
    renderFilters("players-filter", filter => {
      renderPlayers("all-players", null, filter);
    });
  }

  // Profile page
  if (document.getElementById("profile-root")) {
    renderProfile();
  }
});
