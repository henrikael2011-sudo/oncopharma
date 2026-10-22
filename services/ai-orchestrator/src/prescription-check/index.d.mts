export type Status = 'ok' | 'divergente' | 'incerto';
export type Check = { status: Status; rule: string; suggestion: string };
export type ItemResult = { drug: string; checks: Record<'dose_vs_bsa' | 'protocol' | 'dilution' | 'infusion_order', Check> };
export type CheckResult = { synthetic: true; decision: string; bsaM2: number; provider: 'gemini' | 'groq' | 'mock'; model: string | null; fallbackFrom?: string; fallbackReason?: string; items: ItemResult[]; disclaimer: string };
export type PrescriptionInput = { fictional: true; protocol: string; patient: { name?: string; weightKg: number; heightCm: number; bsaM2?: number }; items: { drug: string; doseMg: number; diluent: string; volumeMl: number; order: number }[] };
export const DISCLAIMER: string;
export const DEMO_PRESCRIPTION: PrescriptionInput;
export class GuardError extends Error { status: number }
export class ProviderError extends Error { status: number }
export function guardInput(input: unknown): true;
export function checkPrescription(input: unknown, opts?: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch }): Promise<CheckResult>;
