// Links between product, industry and case study pages.
// Industries and case studies are linked back automatically by inverting this map.

// For each module: the industries and case studies it serves.
export const MODULE_LINKS = {
  "general-ledger": { industries: ["professional-services", "construction", "property", "agriculture"], cases: ["consultancy-two-people", "builders-merchant"] },
  "sales-invoicing": { industries: ["clinics", "professional-services", "schools", "property"], cases: ["consultancy-two-people", "dental-clinic-two-chairs", "school-fee-plans"] },
  purchasing: { industries: ["construction", "manufacturing", "restaurants"], cases: ["builders-merchant", "cafe-three-outlets"] },
  inventory: { industries: ["restaurants", "retail-pharmacy", "logistics", "manufacturing"], cases: ["cafe-three-outlets", "builders-merchant"] },
  "payroll-hr": { industries: ["professional-services", "schools", "clinics"], cases: ["dental-clinic-two-chairs"] },
  pos: { industries: ["restaurants", "hospitality", "retail-pharmacy"], cases: ["cafe-three-outlets"] },
  "projects-field-service": { industries: ["construction", "professional-services", "clinics"], cases: ["consultancy-two-people"] },
  "document-capture": { industries: ["construction", "logistics", "property"], cases: ["builders-merchant"] },
  security: { industries: [], cases: [] },
  "ai-agents": { industries: ["restaurants", "retail-pharmacy", "logistics"], cases: ["cafe-three-outlets"] },
  automation: { industries: ["schools", "property", "clinics"], cases: ["school-fee-plans"] },
  "ai-suite": { industries: ["professional-services", "agriculture"], cases: [] },
};

// Industry or case study slug -> the modules that serve it, built from MODULE_LINKS.
export function modulesFor(kind, slug) {
  return Object.keys(MODULE_LINKS).filter((module) => MODULE_LINKS[module][kind].includes(slug));
}
