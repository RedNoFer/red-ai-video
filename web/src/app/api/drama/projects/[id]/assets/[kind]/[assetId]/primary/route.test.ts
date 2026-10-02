import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ approve: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => ({ id: "user-one" })) }));
vi.mock("@/lib/server/drama-project-service", () => ({ approveDramaAssetReferenceForUser: mocks.approve, DramaProjectServiceError: class extends Error {} }));
import { POST } from "./route";

it("returns only asset updates when confirmation requests a compact acknowledgement", async () => {
    mocks.approve.mockResolvedValue({
        id: "project-one",
        updatedAt: "json-version",
        characters: [{ id: "character-one", primaryReferenceId: "candidate-one" }],
        scenes: [],
        props: [],
        clues: [],
        episodes: [{ shots: ["unchanged"] }],
        sourceAssets: [{ textContent: "large source" }],
        productionArchive: { content: "archive" },
    });
    const response = await POST(new Request("http://localhost", { method: "POST", headers: { "X-Drama-Response": "asset-update" }, body: JSON.stringify({ referenceId: "candidate-one" }) }), {
        params: Promise.resolve({ id: "project-one", kind: "characters", assetId: "character-one" }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data.project).toEqual({ id: "project-one", updatedAt: "json-version", characters: [{ id: "character-one", primaryReferenceId: "candidate-one" }], scenes: [], props: [], clues: [] });
});
