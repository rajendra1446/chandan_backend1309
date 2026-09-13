/**
 * Authorized Manufacturing Plant Units for Backend
 * ONLY these 7 plants are permitted across all MES operations.
 */

export const AUTHORIZED_PLANTS = [
  {
    code: "RM10",
    name: "New Plant Rolling Mill 10",
    label: "RM10 - New Plant Rolling Mill 10",
    unit_type: "ROLLING_MILL",
    category: "ROLLING_MILL"
  },
  {
    code: "RM16",
    name: "Rolling Mill 16",
    label: "RM16 - Rolling Mill 16",
    unit_type: "ROLLING_MILL",
    category: "ROLLING_MILL"
  },
  {
    code: "RM20",
    name: "New Plant Rolling Mill 20",
    label: "RM20 - New Plant Rolling Mill 20",
    unit_type: "ROLLING_MILL",
    category: "ROLLING_MILL"
  },
  {
    code: "WRM",
    name: "Wire Rod Mill",
    label: "WRM - Wire Rod Mill",
    unit_type: "WIRE_ROD",
    category: "WIRE_ROD"
  },
  {
    code: "BB",
    name: "Bright Bar",
    label: "BB - Bright Bar",
    unit_type: "BRIGHT_BAR",
    category: "BRIGHT_BAR"
  },
  {
    code: "FORGING",
    name: "Forging Plant",
    label: "FORGING - Forging Plant",
    unit_type: "FORGING",
    category: "FORGING"
  },
  {
    code: "SMS",
    name: "Steel Melting Shop / CCM",
    label: "SMS - Steel Melting Shop / CCM",
    unit_type: "SMS",
    category: "SMS"
  }
];

export function formatPlantName(input) {
  if (!input) return "";
  const cleaned = String(input).trim();
  const upper = cleaned.toUpperCase();

  const exact = AUTHORIZED_PLANTS.find(
    (p) => p.label.toUpperCase() === upper || p.code === upper
  );
  if (exact) return exact.label;

  if (upper.includes("RM10") || upper.includes("MILL 10")) return "RM10 - New Plant Rolling Mill 10";
  if (upper.includes("RM16") || upper.includes("MILL 16")) return "RM16 - Rolling Mill 16";
  if (upper.includes("RM20") || upper.includes("MILL 20")) return "RM20 - New Plant Rolling Mill 20";
  if (upper.includes("WRM") || upper.includes("WIRE ROD")) return "WRM - Wire Rod Mill";
  if (upper.includes("BB") || upper.includes("BRIGHT BAR")) return "BB - Bright Bar";
  if (upper.includes("FORGING")) return "FORGING - Forging Plant";
  if (upper.includes("SMS") || upper.includes("MELTING")) return "SMS - Steel Melting Shop / CCM";

  return cleaned;
}

export function isValidPlant(input) {
  if (!input) return false;
  const formatted = formatPlantName(input);
  return AUTHORIZED_PLANTS.some((p) => p.label === formatted);
}
