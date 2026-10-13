import { beforeEach, describe, expect, it, vi } from "vitest";

import { completeDramaAsset } from "./drama-asset-completion-service";

const getProject = vi.hoisted(() => vi.fn());
const updateProject = vi.hoisted(() => vi.fn());
const createVoice = vi.hoisted(() => vi.fn());
const planVoice = vi.hoisted(() => vi.fn());
const fetchInternal = vi.hoisted(() => vi.fn());

vi.mock("./drama-project-service", () => ({ getDramaProjectForUser: getProject, updateDramaProjectForUser: updateProject }));
vi.mock("./drama-voice-creation", () => ({ createDramaVoiceCreationTask: createVoice }));
vi.mock("./drama-voice-planning", () => ({ planDramaVoice: planVoice }));
vi.mock("./internal-origin", () => ({ fetchInternalApi: fetchInternal }));

describe("drama asset completion", () => {
    beforeEach(() => vi.clearAllMocks());

    it("submits saved image prose unchanged when only the reference image is missing", async () => {
        const authored = "\n角色：窄长脸、短黑发。\r\n服装：炭黑防风外套、灰色内层、登山鞋。\n";
        getProject.mockResolvedValue({
            id: "project-one",
            title: "原稿保护",
            ratio: "16:9",
            characters: [{ id: "character-one", name: "阿泽", description: "救援参与者", supplierPrompt: authored, profile: { visualIdentity: "窄长脸、短黑发", styling: "炭黑防风外套", colorPalette: "炭黑、深灰", consistencyRules: "脸型与发际线固定" } }],
            scenes: [],
            props: [],
            clues: [],
        });
        fetchInternal.mockResolvedValue(Response.json({ task: { id: "reference-task" } }));
        await completeDramaAsset({ userId: "user-one", projectId: "project-one", kind: "characters", assetId: "character-one", requestId: "complete-authored", origin: "https://vozeb.example", cookie: "" });
        expect(fetchInternal).toHaveBeenCalledOnce();
        expect(JSON.parse(fetchInternal.mock.calls[0][1].body).prompt).toBe(authored);
        expect(updateProject).not.toHaveBeenCalled();
        expect(createVoice).not.toHaveBeenCalled();
    });

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
