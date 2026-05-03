export interface VisibilityConfig {
  nav?: {
    inbox?: boolean;
    board?: boolean;
    resources?: boolean;
  };
  resources?: {
    accounts?: boolean;
    media?: boolean;
    contacts?: boolean;
    infra?: boolean;
    budget?: boolean;
    knowledge?: boolean;
  };
}

// Defaults per role (what operators/viewers can see by default)
export const ROLE_DEFAULTS: Record<string, VisibilityConfig> = {
  operator: {
    nav: { inbox: true, board: false, resources: false },
    resources: { accounts: false, media: false, contacts: false, infra: false, budget: false, knowledge: false },
  },
  viewer: {
    nav: { inbox: true, board: false, resources: false },
    resources: { accounts: false, media: false, contacts: false, infra: false, budget: false, knowledge: false },
  },
  admin: {
    nav: { inbox: true, board: true, resources: true },
    resources: { accounts: true, media: true, contacts: true, infra: true, budget: true, knowledge: true },
  },
};

// Merge: user-specific overrides on top of role defaults
export function mergeVisibility(role: string, userConfig: VisibilityConfig | null): VisibilityConfig {
  const base: VisibilityConfig = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS['viewer'] ?? {};
  if (!userConfig) return base;
  return {
    nav: { ...base.nav, ...userConfig.nav },
    resources: { ...base.resources, ...userConfig.resources },
  };
}
