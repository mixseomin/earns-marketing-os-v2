// Fleet inventory — the physical boxes behind the whole portfolio, in one place.
// Static config (3 rows that change ~never). Specs / sites / usage are a MEASURED SNAPSHOT taken on
// SERVERS_SNAPSHOT_AT — NOT live. Live metrics (real-time RAM/disk) would need an SSH/agent path from
// box3 to each box; that's a follow-on. When a box changes (resize, migration, new site), edit here.
export interface ServerBox {
  id: string;
  name: string;               // box1
  host: string;               // primary label / domain
  provider: string;           // Hetzner Cloud
  type: string;               // Hetzner type (CX33…) — '' when unverified
  region: string;             // Hillsboro, Oregon
  flag: string;               // 🇺🇸
  ip: string;
  vcpu: number;
  ramGB: number;
  diskGB: number;
  ramUsedPct: number | null;  // snapshot
  diskUsedPct: number | null; // snapshot
  costMonth: number | null;   // EUR / month
  costVerified: boolean;      // false = list-price estimate, confirm in Hetzner console
  role: string;
  sites: string[];            // domains / apps running on the box
  status: string;             // active
  notes?: string;
}

export const SERVERS_SNAPSHOT_AT = '2026-08-05';

export const SERVER_BOXES: ServerBox[] = [
  {
    id: 'box1', name: 'box1', host: 'as.on.tc', provider: 'Hetzner Cloud', type: '',
    region: 'Hillsboro, Oregon', flag: '🇺🇸', ip: '5.78.65.158',
    vcpu: 3, ramGB: 4, diskGB: 40, ramUsedPct: 58, diskUsedPct: 75,
    costMonth: 11, costVerified: true,
    role: 'Data anchor + main fleet — Directus, Postgres, dashboard + ~30 sites',
    sites: [
      'as.on.tc', 'cities.gg', 'be.cities.gg', 'routeplanner.cities.gg', 'militarycalc.com',
      'militarymarkdown.com', 'course.on.tc', 'orit.app', 'ai.orit.app',
      'chatlt.com', 'solitaire.on.tc', 'solitairenest.com', 'maileyes.com', 'hljournal.on.tc',
      'go.on.tc', 'sub.on.tc', 'arbscan.on.tc', 'astroinsight.io', 'batmails.com',
      'bestweightlosspills.reviews', 'cee-trust.org', 'mixseo.net', 'sendy.on.tc', 'tips.on.tc',
      'adminer.on.tc', 'ai.on.tc', 'fxnewsapi.on.tc', 'ismail.on.tc', 'stm.earns.io',
      'old.astrolas.com', 'mos.on.tc',
    ],
    status: 'active',
    notes: 'Postgres + Directus live here → keep DB-heavy apps near it (170ms to the EU boxes).',
  },
  {
    id: 'box2', name: 'box2', host: 'n8n.on.tc', provider: 'Hetzner Cloud', type: 'CX22',
    region: 'Helsinki', flag: '🇫🇮', ip: '37.27.241.222',
    vcpu: 2, ramGB: 4, diskGB: 40, ramUsedPct: 58, diskUsedPct: 72,
    costMonth: 11, costVerified: true,
    role: 'Automation + email — n8n, MailWizz, Listmonk + 4 calc sites',
    sites: [
      'n8n.on.tc', 'mail.on.tc', 'lists.on.tc', 'govcalcs.com', 'visagps.com',
      'paydochub.com', 'mintalmanac.com', 'mamphat.com', 'links.militarycalc.com',
    ],
    status: 'active',
  },
  {
    id: 'box3', name: 'box3', host: 'mos2.on.tc', provider: 'Hetzner Cloud', type: 'CX33',
    region: 'Nuremberg', flag: '🇩🇪', ip: '167.233.241.16',
    vcpu: 4, ramGB: 8, diskGB: 80, ramUsedPct: 20, diskUsedPct: 8,
    costMonth: 8.49, costVerified: true,
    role: 'MOS2 command center + SteamSolo',
    sites: ['mos2.on.tc', 'user.on.tc', 'steamsolo.com'],
    status: 'active',
    notes: 'Newest + most headroom. MOS2 + SteamSolo run here on box3-local Postgres (fast — no cross-box hop). 170ms to box1 as.on.tc only bites the few shared-Directus calls (account registry).',
  },
];

// Fleet roll-ups for the summary header.
export function fleetTotals(boxes: ServerBox[] = SERVER_BOXES) {
  return boxes.reduce(
    (a, b) => ({
      boxes: a.boxes + 1,
      vcpu: a.vcpu + b.vcpu,
      ramGB: a.ramGB + b.ramGB,
      diskGB: a.diskGB + b.diskGB,
      costMonth: a.costMonth + (b.costMonth ?? 0),
      sites: a.sites + b.sites.length,
    }),
    { boxes: 0, vcpu: 0, ramGB: 0, diskGB: 0, costMonth: 0, sites: 0 },
  );
}
