import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    currentUser: vi.fn(),
    getVideoTask: vi.fn(),
    queryVideoTaskUpstream: vi.fn(),
    persistVideoTaskResult: vi.fn(),
    fetchInternalApi: vi.fn(),
    readReferenceAsset: vi.fn(),
    getLocalMediaRegistration: vi.fn(),
    createLocalMediaResponse: vi.fn(),
    createExternalMediaReadUrl: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/lib/server/video-task-store", () => ({ getVideoTask: mocks.getVideoTask }));
vi.mock("@/lib/server/internal-origin", () => ({ resolveInternalOrigin: vi.fn(() => "http://localhost"), fetchInternalApi: mocks.fetchInternalApi }));
vi.mock("@/lib/server/reference-asset-store", () => ({ readReferenceAsset: mocks.readReferenceAsset }));
vi.mock("@/lib/server/local-media-registry", () => ({ getLocalMediaRegistration: mocks.getLocalMediaRegistration }));
vi.mock("@/lib/server/local-media-response", () => ({ createLocalMediaResponse: mocks.createLocalMediaResponse }));
vi.mock("@/lib/server/object-storage-service", () => ({ createExternalMediaReadUrl: mocks.createExternalMediaReadUrl }));
vi.mock("@/lib/server/video-task-runtime", () => ({
    queryVideoTaskUpstream: mocks.queryVideoTaskUpstream,
    persistVideoTaskResult: mocks.persistVideoTaskResult,
}));

import { GET } from "./route";

const context = { params: Promise.resolve({ id: "video-one" }) };

describe("GET /api/video-tasks/[id]/download", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.currentUser.mockResolvedValue({ id: "user-one", role: "user" });
        mocks.createExternalMediaReadUrl.mockResolvedValue(null);
        mocks.queryVideoTaskUpstream.mockResolvedValue({ state: "result_ready", status: "completed", resultUrl: "https://supplier.example/video.mp4" });
    });

    it("redirects successful local results as downloadable originals", async () => {
        mocks.getVideoTask.mockResolvedValue({ id: "video-one", userId: "user-one", status: "success", result: { url: "/api/reference-assets/permanent/2026/08/25/videos/video.mp4" } });

        const response = await GET(new Request("http://localhost/api/video-tasks/video-one/download"), context);

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://localhost/api/reference-assets/permanent/2026/08/25/videos/video.mp4");
        expect(mocks.queryVideoTaskUpstream).not.toHaveBeenCalled();
    });

    it("streams the remote result with the browser session for a download", async () => {
        mocks.getVideoTask.mockResolvedValue({ id: "video-one", userId: "user-one", status: "success", result: { url: "/api/reference-assets/permanent/2026/08/25/videos/video.mp4" } });
        mocks.fetchInternalApi.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "video/mp4" } }));

        const response = await GET(new Request("http://localhost/api/video-tasks/video-one/download?download=1", { headers: { cookie: "session=test" } }), context);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-disposition")).toContain("attachment");
        expect(await response.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer);
        expect(mocks.fetchInternalApi).toHaveBeenCalledWith("http://localhost/api/reference-assets/permanent/2026/08/25/videos/video.mp4?download=original", expect.objectContaining({ headers: { cookie: "session=test" } }));
    });

    it("streams a local backup directly without a second unauthenticated request", async () => {
        mocks.getVideoTask.mockResolvedValue({ id: "video-one", userId: "user-one", status: "success", result: { url: "/api/reference-assets/permanent/2026/08/25/videos/video.mp4" } });
        mocks.readReferenceAsset.mockResolvedValue({ filePath: "/media/video.mp4", mimeType: "video/mp4" });
        mocks.getLocalMediaRegistration.mockResolvedValue({ ownerUserId: "user-one" });
        mocks.createLocalMediaResponse.mockResolvedValue(new Response(new Uint8Array([4, 5]), { status: 200 }));

        const response = await GET(new Request("http://localhost/api/video-tasks/video-one/download?download=1"), context);

        expect(response.status).toBe(200);
        expect(mocks.createLocalMediaResponse).toHaveBeenCalledWith(expect.any(Request), "/media/video.mp4", "video/mp4", expect.objectContaining({ "Content-Disposition": expect.stringContaining("attachment") }));
        expect(mocks.fetchInternalApi).not.toHaveBeenCalled();
    });

    it("uses the signed object-storage URL for a remotely stored local asset", async () => {
        mocks.getVideoTask.mockResolvedValue({ id: "video-one", userId: "user-one", status: "success", result: { url: "/api/reference-assets/permanent/2026/08/25/videos/video.mp4" } });
        mocks.readReferenceAsset.mockResolvedValue(null);
        mocks.getLocalMediaRegistration.mockResolvedValue({ ownerUserId: "user-one", storageProvider: "object", externalObjectKey: "media/video.mp4" });
        mocks.createExternalMediaReadUrl.mockResolvedValue("https://objects.example/video.mp4?signature=redacted");

        const response = await GET(new Request("http://localhost/api/video-tasks/video-one/download"), context);

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("https://objects.example/video.mp4?signature=redacted");
    });

    it("backs up a completed supplier result when explicitly asked to repair", async () => {
        const task = { id: "video-one", userId: "user-one", status: "success", result: undefined, upstream: { resultUrl: "https://supplier.example/video.mp4" } };
        mocks.getVideoTask.mockResolvedValue(task);
        mocks.queryVideoTaskUpstream.mockResolvedValue({ state: "result_ready", status: "completed", resultUrl: "https://supplier.example/video.mp4" });
        mocks.persistVideoTaskResult.mockResolvedValue({ result: { url: "/api/reference-assets/permanent/2026/08/25/videos/video.mp4" } });

        const response = await GET(new Request("http://localhost/api/video-tasks/video-one/download?repair=1", { headers: { cookie: "session=test" } }), context);

        expect(response.status).toBe(200);
        expect(mocks.queryVideoTaskUpstream).toHaveBeenCalledWith(task, "http://localhost", "session=test", "", true);
        expect(mocks.persistVideoTaskResult).toHaveBeenCalledWith(task, "https://supplier.example/video.mp4", "http://localhost", "session=test", "", true);
        expect((await response.json()).data.url).toContain("/api/reference-assets/");
    });

    it("does not silently repair or download a remote result during playback", async () => {
        mocks.getVideoTask.mockResolvedValue({ id: "video-one", userId: "user-one", status: "success", result: { url: "https://supplier.example/video.mp4" } });

        const response = await GET(new Request("http://localhost/api/video-tasks/video-one/download"), context);

        expect(response.status).toBe(409);
        expect(mocks.queryVideoTaskUpstream).not.toHaveBeenCalled();
        expect(mocks.persistVideoTaskResult).not.toHaveBeenCalled();
    });

    it("forces a fresh provider download when the existing local URL is stale", async () => {
        const task = { id: "video-one", userId: "user-one", status: "success", result: { url: "/api/reference-assets/permanent/old.mp4" }, upstream: { resultUrl: "https://supplier.example/current.mp4" } };
        mocks.getVideoTask.mockResolvedValue(task);
        mocks.queryVideoTaskUpstream.mockResolvedValue({ state: "result_ready", status: "completed", resultUrl: "https://supplier.example/current.mp4" });
        mocks.persistVideoTaskResult.mockResolvedValue({ result: { url: "/api/reference-assets/permanent/new.mp4" } });

        const response = await GET(new Request("http://localhost/api/video-tasks/video-one/download?repair=1"), context);

        expect(response.status).toBe(200);
        expect(mocks.persistVideoTaskResult).toHaveBeenCalledWith(task, "https://supplier.example/current.mp4", "http://localhost", "", "", true);
        expect((await response.json()).data.url).toBe("/api/reference-assets/permanent/new.mp4");
    });

    it("replaces a legacy remote result with the persistent local copy", async () => {
        const task = { id: "video-one", userId: "user-one", status: "success", result: { url: "https://supplier.example/video.mp4" }, upstream: { resultUrl: "https://supplier.example/video.mp4" } };
        mocks.getVideoTask.mockResolvedValue(task);
        mocks.queryVideoTaskUpstream.mockResolvedValue({ state: "result_ready", status: "completed", resultUrl: task.result.url });
        mocks.persistVideoTaskResult.mockResolvedValue({ result: { url: "/api/reference-assets/permanent/2026/08/25/videos/video.mp4" } });

        const response = await GET(new Request("http://localhost/api/video-tasks/video-one/download?repair=1"), context);

        expect(response.status).toBe(200);
        expect(mocks.persistVideoTaskResult).toHaveBeenCalledOnce();
        expect((await response.json()).data.url).toContain("/api/reference-assets/");
    });
});
