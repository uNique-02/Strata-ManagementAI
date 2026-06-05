import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnquiryWorkspace } from "@/components/enquiry-workspace";

describe("EnquiryWorkspace", () => {
  it("shows validation error when enquiry text is empty", async () => {
    render(<EnquiryWorkspace initialResult={null} defaultModel="openai/gpt-4o-mini" />);

    fireEvent.click(screen.getByRole("button", { name: /analyze enquiry/i }));

    expect(
      await screen.findByText("Please enter a client enquiry before submitting."),
    ).toBeInTheDocument();
  });

  it("renders returned AI result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "enq_1",
        user_id: "user_1",
        client_name: "Alex",
        client_email: "alex@example.com",
        enquiry_text: "Please share your onboarding pricing details.",
        classification: "New Client",
        confidence: 0.9,
        urgency: "Medium",
        summary: "Potential client asking onboarding and pricing details.",
        recommended_action: "Route to sales onboarding.",
        suggested_response: "Thanks for reaching out, we will connect shortly.",
        manual_review: false,
        model_used: "openai/gpt-4o-mini",
        prompt_version: "v1",
        raw_ai_json: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<EnquiryWorkspace initialResult={null} defaultModel="openai/gpt-4o-mini" />);

    fireEvent.change(screen.getByPlaceholderText("Paste the full client enquiry..."), {
      target: { value: "Please share your onboarding pricing details." },
    });
    fireEvent.click(screen.getByRole("button", { name: /analyze enquiry/i }));

    await waitFor(() => {
      expect(screen.getByText("Potential client asking onboarding and pricing details.")).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });
});
