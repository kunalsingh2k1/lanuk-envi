// Used only when Supabase isn't configured yet, so the interface still has something real to show.
// The same rows were seeded into the lanuk-x envi_* tables on 11 Nov 2026.
export const SEED = {
  config: { usd_inr: 85, target_min: 100000, target_max: 250000, tool_budget: 15000, tax_pct: 10 },
  costs: [
    { id: "claude-pro", tool: "Claude Pro", plan: "Pro (includes Claude Code)", kind: "AI tool", amount: 2000, currency: "INR", cycle: "monthly", paid_through: "2027-01-10", confirmed: false },
    { id: "chatgpt-plus", tool: "ChatGPT Plus", plan: "Plus (includes Codex)", kind: "AI tool", amount: 1999, currency: "INR", cycle: "monthly", paid_through: "2027-01-10", confirmed: false },
    { id: "obsidian", tool: "Obsidian", plan: "Free", kind: "Other tool", amount: 0, currency: "INR", cycle: "monthly", paid_through: null, confirmed: true },
  ],
  income: [
    { id: "alliance-partners", client: "Alliance Partners", type: "Retainer", amount: null, currency: "INR", date: "2026-11-10", status: "Expected" },
  ],
  missions: [
    { id: "m01", title: "Confirm entity type and GST status with your CA", why: "Decides invoicing and whether Indian clients pay 18% GST.", tag: "Blocks launch", severity: "crit", sort: 1, done: false },
    { id: "m02", title: "Answer the open questions in the Singha Tax brief, then approve it", why: "The Content Planner can't start December until the brief is approved.", tag: "Blocks agents", severity: "crit", sort: 2, done: false },
    { id: "m03", title: "Revoke the owner access token pasted on 5 Nov", why: "Flagged in HANDOVER.md. Do it in the provider's dashboard.", tag: "Security", severity: "crit", sort: 3, done: false },
    { id: "m04", title: "Confirm the prices in the rate card", why: "All three tiers are drafts until you sign off.", tag: "Money", severity: "warn", sort: 4, done: false },
    { id: "m05", title: "Choose Alliance Partners' package and enter the amount", why: "Your only paying client has no figure yet.", tag: "Money", severity: "warn", sort: 5, done: false },
    { id: "m06", title: "Confirm Claude Pro and ChatGPT Plus renewal dates", why: "Both show 10 Jan 2027 as an estimate.", tag: "Money", severity: "warn", sort: 6, done: false },
    { id: "m07", title: "Write one line each on MS Pooja Store, Elegant Edition and Alliance Partners", why: "The PD still lists what they do as unknown.", tag: "Before launch", severity: "warn", sort: 7, done: false },
    { id: "m08", title: "Update the founder line in the singha-master-design skill", why: "It still names Kunal as founder. Edit it in claude.ai Skills; it syncs.", tag: "Brand", severity: "idle", sort: 8, done: false },
  ],
};
