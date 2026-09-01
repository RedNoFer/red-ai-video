import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getProject: vi.fn(),
    updateProject: vi.fn(),
    persistMedia: vi.fn(),
}));

vi.mock("@/lib/server/drama-project-service", () => ({ getDramaProjectForUser: mocks.getProject, updateDramaProjectForUser: mocks.updateProject }));
vi.mock("@/lib/server/drama-asset-reference-media", () => ({ persistDramaGeneratedImageReference: mocks.persistMedia }));

import { persistDramaGeneratedCandidates } from "./drama-generated-candidate-persistence";

describe("persistDramaGeneratedCandidates", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getProject.mockResolvedValue({
            id: "drama-one",
            updatedAt: "2026-08-27T00:00:00.000Z",
            characters: [{ id: "character-one", name: "城门检查官", references: [] }],
            scenes: [],
            props: [],
        });
        mocks.persistMedia.mockResolvedValue({ url: "/api/generation-log-assets/permanent/candidate.png", remoteUrl: "https://provider.example/candidate.png" });
        mocks.updateProject.mockImplementation(async (_userId: string, _projectId: string, project: unknown) => project);
    });

    it("writes a successful drama image task into its asset candidate list", async () => {
        await expect(
            persistDramaGeneratedCandidates({
                ownerUserId: "user-one",
                projectId: "drama-one",
                assetKind: "characters",
                assetId: "character-one",
                taskId: "task-one",
                prompt: "城门检查官，站在城门前",
                results: [{ serverUrl: "/api/generation-log-assets/permanent/candidate.png", width: 2160, height: 3840 }],
            }),
        ).resolves.toBe(1);

        expect(mocks.updateProject).toHaveBeenCalledWith(
            "user-one",
            "drama-one",
            expect.objectContaining({
                characters: [
                    expect.objectContaining({
                        references: [
                            expect.objectContaining({
                                id: "reference-task-one-0",
                                generationTaskId: "task-one",
                                status: "candidate",
                                reviewStatus: "pending",
                                url: "/api/generation-log-assets/permanent/candidate.png",
                            }),
                        ],
                    }),
                ],
            }),
        );
    });

    it("does not append the same task twice", async () => {
        mocks.getProject.mockResolvedValueOnce({
            id: "drama-one",
            updatedAt: "2026-08-27T00:00:00.000Z",
            characters: [{ id: "character-one", name: "城门检查官", references: [{ id: "reference-task-one-0", url: "/api/generation-log-assets/permanent/candidate.png", source: "generated", label: "AI 候选图", createdAt: "2026-08-27T00:00:00.000Z", generationTaskId: "task-one" }] }],
            scenes: [],
            props: [],
        });

        await expect(
            persistDramaGeneratedCandidates({ ownerUserId: "user-one", projectId: "drama-one", assetId: "character-one", taskId: "task-one", prompt: "prompt", results: [{ serverUrl: "/api/generation-log-assets/permanent/candidate.png" }] }),
        ).resolves.toBe(0);
        expect(mocks.persistMedia).not.toHaveBeenCalled();
        expect(mocks.updateProject).not.toHaveBeenCalled();
    });
});
