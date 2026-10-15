import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ preview: vi.fn(), project: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => ({ id: "author" }) }));
vi.mock("@/lib/server/drama-project-service", () => ({
    getDramaProjectForUser: mocks.project,
    previewDramaProductionPackageForUser: mocks.preview,
    applyDramaProductionPackageForUser: vi.fn(),
    DramaProjectServiceError: class extends Error {},
}));

import { POST } from "./route";

beforeEach(() => {
    vi.clearAllMocks();
    mocks.project.mockResolvedValue({ id: "book" });
    mocks.preview.mockReturnValue({ summary: { episodes: 12 } });
});

it("accepts a production package larger than the generic creative upload limit", async () => {
    const source = "x".repeat(21 * 1024 * 1024);
    const response = await POST(new Request("http://localhost/api/drama/projects/book/production-package", { method: "POST", body: JSON.stringify({ source, fileName: "book.md" }) }), {
        params: Promise.resolve({ id: "book" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.preview).toHaveBeenCalledOnce();
});
