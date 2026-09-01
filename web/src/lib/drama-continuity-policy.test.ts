import { describe, expect, it } from "vitest";

import type { DramaShot } from "@/lib/drama-project-contract";
import { acceptedActualEndFrame, createFrameEvidence, invalidateFrameEvidence } from "./drama-continuity-policy";

describe("drama continuity policy", () => {
    it("only exposes an accepted actual tail from the current video revision", () => {
        const shot = {
            id: "shot-one",
            videoUrl: "/api/reference-assets/current.mp4",
            frameEvidence: [
                createFrameEvidence({
                    role: "actual_end",
                    source: "video_extraction",
                    mediaUrl: "/api/reference-assets/tail.png",
                    sourceVideoUrl: "/api/reference-assets/current.mp4",
                    validity: "accepted",
                }),
            ],
        } as DramaShot;

        expect(acceptedActualEndFrame(shot)?.mediaUrl).toBe("/api/reference-assets/tail.png");
        expect(acceptedActualEndFrame({ ...shot, videoUrl: "/api/reference-assets/replaced.mp4" } as DramaShot)).toBeUndefined();
    });

    it("keeps rejected evidence for audit while making it ineligible", () => {
        const evidence = createFrameEvidence({ role: "actual_end", source: "video_extraction", mediaUrl: "/api/reference-assets/tail.png", sourceVideoUrl: "/api/reference-assets/current.mp4", validity: "candidate" });
        const rejected = invalidateFrameEvidence(evidence, "rejected", "人工拒绝当前尾帧");

        expect(rejected).toMatchObject({ validity: "rejected", invalidReason: "人工拒绝当前尾帧" });
    });
});
