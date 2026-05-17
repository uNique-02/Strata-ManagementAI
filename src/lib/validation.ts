import { z } from "zod";
import {
  CLASSIFICATIONS,
  FALLBACK_CONFIDENCE,
  URGENCY_LEVELS,
  type Classification,
  type Urgency,
} from "@/lib/constants";
import { clampNumber } from "@/lib/utils";

const classificationEnum = z.enum(CLASSIFICATIONS);
const urgencyEnum = z.enum(URGENCY_LEVELS);

export const analyzeRequestSchema = z.object({
  clientName: z.string().trim().min(1).max(120).optional().or(z.literal("")),
  clientEmail: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(200)
    .optional()
    .or(z.literal("")),
  enquiryText: z
    .string()
    .trim()
    .min(8, "Please provide more detail in the enquiry.")
    .max(4000, "Enquiry is too long."),
  modelOverride: z.string().trim().min(3).max(120).optional(),
});

export const aiResponseSchema = z.object({
  classification: classificationEnum,
  urgency: urgencyEnum,
  summary: z.string().trim().min(10).max(800),
  recommended_action: z.string().trim().min(10).max(1200),
  suggested_response: z.string().trim().min(10).max(2400),
});

export type ValidAnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type ParsedAiResponse = z.infer<typeof aiResponseSchema>;

export type ParsedAnalysisResponse = ParsedAiResponse & {
  confidence: number;
};

export function normalizeOptionalString(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseAiJson(rawContent: string) {
  const stripped = rawContent
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/, "")
    .trim();

  return JSON.parse(stripped) as unknown;
}

export function fallbackAiResponse(
  enquiryText: string,
  confidence = FALLBACK_CONFIDENCE,
): ParsedAnalysisResponse {
  return {
    classification: "Other",
    confidence: clampNumber(confidence, 0, 1),
    urgency: "Low",
    summary:
      enquiryText.length < 30
        ? "The enquiry is too short to classify confidently."
        : "The enquiry could not be reliably parsed by AI output validation.",
    recommended_action:
      "Ask the client for more detail and route to manual staff review.",
    suggested_response:
      "Thank you for your message. Could you share more detail so we can direct your enquiry to the right team member?",
  };
}

export function sanitizeAiResponse(
  data: ParsedAiResponse,
  confidence: number,
): ParsedAnalysisResponse & {
  classification: Classification;
  urgency: Urgency;
  confidence: number;
} {
  return {
    ...data,
    confidence: clampNumber(confidence, 0, 1),
    summary: data.summary.trim(),
    recommended_action: data.recommended_action.trim(),
    suggested_response: data.suggested_response.trim(),
  };
}