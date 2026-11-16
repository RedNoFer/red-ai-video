import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DramaProject } from "@/lib/drama-project-contract";
import { useUserStore, type LocalUser } from "@/stores/use-user-store";

vi.mock("@/services/api/drama-projects", async () => {
    const actual = await vi.importActual<typeof import("@/services/api/drama-projects")>("@/services/api/drama-projects");
    return {
        ...actual,
        getDramaProject: vi.fn(),
        listDramaProjectSummaries: vi.fn(),
        saveDramaProjectMutation: vi.fn(),
    };
});

import { DramaApiError, getDramaProject, listDramaProjectSummaries, saveDramaProjectMutation } from "@/services/api/drama-projects";

import { useDramaStore } from "./use-drama-store";

const project = {
    id: "project-one",
    title: "旧标题",
    updatedAt: "version-1",
    characters: [],
    scenes: [],
    props: [],
    clues: [],
    episodes: [],
    sourceAssets: [],
} as unknown as DramaProject;

const user = {
    id: "user-one",
    accountId: "0001",
    username: "user",
    displayName: "用户",
    role: "user",
    adminPermissions: [],
    status: "active",
    planId: "plan-free",
    planName: "免费版",
    hasActivePlan: false,
    pointsBalance: 0,
    mfaEnabled: false,
    bio: "",
} as LocalUser;

beforeEach(async () => {
    useUserStore.setState({ user });
    vi.mocked(listDramaProjectSummaries).mockReset();
    vi.mocked(getDramaProject).mockReset();
    vi.mocked(saveDramaProjectMutation).mockReset();
    vi.mocked(listDramaProjectSummaries).mockResolvedValue({ projects: [], total: 0, page: 1, pageSize: 20 });
    vi.mocked(getDramaProject).mockResolvedValue(project);
    await useDramaStore.getState().hydrate(true);
    await useDramaStore.getState().loadProject(project.id, true);
});

afterEach(() => {
    useDramaStore.getState().reset();
    useUserStore.setState({ user: null });
    vi.clearAllMocks();
});

describe("drama autosave version conflicts", () => {
    it("re-publishes the pending edit on the latest project version after a 409", async () => {
        const latest = { ...project, updatedAt: "version-2", episodes: [{ id: "episode-one", shots: [{ id: "shot-one", updatedAt: "server-sync" }] }] } as unknown as DramaProject;
        vi.mocked(getDramaProject).mockResolvedValue(latest);
        vi.mocked(saveDramaProjectMutation).mockRejectedValueOnce(new DramaApiError("短剧项目已在其他页面更新，请刷新后重试", 409)).mockResolvedValueOnce({ projectId: project.id, updatedAt: "version-3" });

        await useDramaStore.getState().saveProjectNow(project.id, (current) => ({ ...current, title: "新标题" }));

        expect(saveDramaProjectMutation).toHaveBeenCalledTimes(2);
        const [first, second] = vi.mocked(saveDramaProjectMutation).mock.calls;
        expect(first[0].expectedUpdatedAt).toBe("version-1");
        expect(second[0].expectedUpdatedAt).toBe("version-2");
        expect(second[0].projectPatch).toEqual({ title: "新标题" });
        expect(useDramaStore.getState().saveStateByProject[project.id]?.status).toBe("saved");
        expect(useDramaStore.getState().projects[0]?.title).toBe("新标题");
        expect(useDramaStore.getState().syncError).toBeUndefined();
    });

    it("keeps the server-side message when the conflict cannot be resolved", async () => {
        vi.mocked(getDramaProject).mockResolvedValue({ ...project, updatedAt: "version-2" } as DramaProject);
        vi.mocked(saveDramaProjectMutation).mockRejectedValue(new DramaApiError("短剧项目已在其他页面更新，请刷新后重试", 409));

        await expect(useDramaStore.getState().saveProjectNow(project.id, (current) => ({ ...current, title: "新标题" }))).rejects.toThrow("短剧项目已在其他页面更新");

        expect(useDramaStore.getState().saveStateByProject[project.id]).toEqual(expect.objectContaining({ status: "error", message: "短剧项目已在其他页面更新，请刷新后重试" }));
        expect(useDramaStore.getState().syncError).toBe("短剧项目已在其他页面更新，请刷新后重试");
        expect(vi.mocked(saveDramaProjectMutation).mock.calls.length).toBeLessThanOrEqual(5);
    });
});
