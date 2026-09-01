import { beforeEach, describe, expect, it, vi } from "vitest";

import { completeDramaAsset } from "./drama-asset-completion-service";

const getProject = vi.hoisted(() => vi.fn());
const updateProject = vi.hoisted(() => vi.fn());
const createVoice = vi.hoisted(() => vi.fn());
const planVoice = vi.hoisted(() => vi.fn());

vi.mock("./drama-project-service", () => ({ getDramaProjectForUser: getProject, updateDramaProjectForUser: updateProject }));
vi.mock("./drama-voice-creation", () => ({ createDramaVoiceCreationTask: createVoice }));
vi.mock("./drama-voice-planning", () => ({ planDramaVoice: planVoice }));

describe("drama asset completion", () => {
    beforeEach(() => vi.clearAllMocks());

    it("does not create a voice unless the caller explicitly enables it", async () => {
        const project = {
            id: "project-one",
            characters: [
                {
                    id: "character-one",
                    name: "Karin",
                    description: "侦察员",
                    profile: { visualIdentity: "短发", styling: "皮衣", colorPalette: "黑金", consistencyRules: "年龄固定" },
                    primaryReferenceId: "reference-one",
                    references: [{ id: "reference-one", url: "/media/karin.webp", source: "generated", label: "基准", status: "approved", createdAt: "2026-08-27T00:00:00.000Z" }],
                },
            ],
            scenes: [],
            props: [],
            clues: [],
        };
        getProject.mockResolvedValue(project);
        updateProject.mockImplementation(async (_userId: string, _projectId: string, next: typeof project) => next);

        await completeDramaAsset({ userId: "user-one", projectId: "project-one", kind: "characters", assetId: "character-one", requestId: "complete-one", origin: "https://vozeb.example", cookie: "" });

        expect(createVoice).not.toHaveBeenCalled();
    });

    it("creates a voice only when the request explicitly enables it", async () => {
        const project = {
            id: "project-one",
            characters: [
                {
                    id: "character-one",
                    name: "Karin",
                    description: "侦察员",
                    profile: { visualIdentity: "短发", styling: "皮衣", colorPalette: "黑金", consistencyRules: "年龄固定" },
                    primaryReferenceId: "reference-one",
                    references: [{ id: "reference-one", url: "/media/karin.webp", source: "generated", label: "基准", status: "approved", createdAt: "2026-08-27T00:00:00.000Z" }],
                },
            ],
            scenes: [],
            props: [],
            clues: [],
        };
        getProject.mockResolvedValue(project);
        updateProject.mockImplementation(async (_userId: string, _projectId: string, next: typeof project) => next);
        planVoice.mockResolvedValue({ blueprint: { age: "adult" }, instructions: "冷静", designPrompt: "女声" });
        createVoice.mockResolvedValue({ project, task: { id: "voice-one", status: "running" } });

        await completeDramaAsset({ userId: "user-one", projectId: "project-one", kind: "characters", assetId: "character-one", requestId: "complete-one", origin: "https://vozeb.example", cookie: "", config: { generateVoice: true } });

        expect(createVoice).toHaveBeenCalledOnce();
    });
});
