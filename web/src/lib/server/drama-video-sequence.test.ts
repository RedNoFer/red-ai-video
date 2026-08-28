import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    ffmpegAvailable: vi.fn(),
    runFfmpeg: vi.fn(),
    runFfprobe: vi.fn(),
    fetchInternalApi: vi.fn(),
    fetchSafeOutbound: vi.fn(),
    writeReferenceMediaFile: vi.fn(),
}));

vi.mock("@/lib/server/ffmpeg", () => ({ ffmpegAvailable: mocks.ffmpegAvailable, runFfmpeg: mocks.runFfmpeg, runFfprobe: mocks.runFfprobe }));
vi.mock("@/lib/server/internal-origin", () => ({ fetchInternalApi: mocks.fetchInternalApi }));
vi.mock("@/lib/server/safe-outbound-fetch", () => ({ fetchSafeOutbound: mocks.fetchSafeOutbound }));
vi.mock("@/lib/server/reference-asset-store", () => ({ writeReferenceMediaFile: mocks.writeReferenceMediaFile }));

import { composeDramaVideoSegments } from "./drama-video-sequence";

describe("composeDramaVideoSegments", () => {
    it("normalizes each ordered clip and concatenates them without contacting a paid provider", async () => {
        vi.clearAllMocks();
        mocks.ffmpegAvailable.mockResolvedValue(true);
        mocks.runFfmpeg.mockResolvedValue({ stdout: "", stderr: "" });
        mocks.runFfprobe.mockResolvedValue({ stdout: "audio\n", stderr: "" });
        mocks.fetchInternalApi.mockImplementation(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "video/mp4" } }));
        mocks.writeReferenceMediaFile.mockResolvedValue({ url: "/api/reference-assets/combined.mp4", token: "combined" });

        await expect(
            composeDramaVideoSegments({
                clips: [
                    { url: "/api/video-tasks/one", duration: 2 },
                    { url: "/api/video-tasks/two", duration: 4 },
                ],
                ratio: "9:16",
                origin: "http://localhost:3010",
                cookie: "session=test",
                ownerUserId: "user-one",
                projectId: "project-one",
                runId: "run-one",
                shotId: "shot-one",
                title: "镜头一",
            }),
        ).resolves.toBe("/api/reference-assets/combined.mp4");

        expect(mocks.fetchInternalApi).toHaveBeenCalledTimes(2);
        expect(mocks.runFfmpeg).toHaveBeenCalledTimes(3);
        const concatCall = mocks.runFfmpeg.mock.calls[2]?.[0] as string[];
        expect(concatCall).toEqual(expect.arrayContaining(["-f", "concat", "-i", "concat.txt", "-c", "copy"]));
        expect(mocks.writeReferenceMediaFile).toHaveBeenCalledWith(expect.stringContaining("joined.mp4"), "video", "video/mp4", true, expect.objectContaining({ runId: "run-one", taskId: "shot-one" }));
        expect(mocks.fetchSafeOutbound).not.toHaveBeenCalled();
    });

    it("rejects an empty sequence before starting media processing", async () => {
        vi.clearAllMocks();
        await expect(
            composeDramaVideoSegments({
                clips: [],
                ratio: "9:16",
                origin: "http://localhost:3010",
                cookie: "",
                ownerUserId: "user-one",
                projectId: "project-one",
                runId: "run-one",
                shotId: "shot-one",
                title: "镜头一",
            }),
        ).rejects.toThrow("没有可拼接");
        expect(mocks.ffmpegAvailable).not.toHaveBeenCalled();
    });
});
