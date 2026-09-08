import { describe, expect, it } from "vitest";

import type { LogicalModel } from "@/lib/auth/store";
import { buildCapabilityVariants, defaultLogicalModelCapabilityProfile } from "./admin-logical-model-manager";

describe("admin logical model editor", () => {
    it("keeps edited capability profiles when applying the current capability variant", () => {
        const original: LogicalModel = {
            id: "alibaba/wan-3.0",
            name: "Wan 3.0",
            capability: "video",
            enabled: true,
            bindings: [
                {
                    id: "wan-binding",
                    channelId: "new-api",
                    upstreamModel: "alibaba/wan-3.0",
                    enabled: true,
                    priority: 1,
                    capabilityProfile: { supportsKeyframes: false, maxReferenceImages: 9 },
                },
            ],
        };
        const draft: LogicalModel = {
            ...original,
            bindings: [{ ...original.bindings[0], capabilityProfile: { supportsKeyframes: true, maxReferenceImages: 9 } }],
        };

        const next = buildCapabilityVariants([original], original, draft, ["video"]);

        expect(next[0]?.bindings[0]?.capabilityProfile).toMatchObject({ supportsKeyframes: true, maxReferenceImages: 9 });
    });

    it("defaults a new model capability profile to allow every advertised capability", () => {
        expect(defaultLogicalModelCapabilityProfile("video")).toEqual({
            supportsReferenceImage: true,
            supportsReferenceVideo: true,
            supportsReferenceAudio: true,
            supportsKeyframes: true,
            supportsAsync: true,
            supportsCancel: true,
            supportsWebhook: true,
        });
    });

    it("persists the default capability profile when a new capability variant is created", () => {
        const original: LogicalModel = {
            id: "seedance-2-5",
            name: "Seedance",
            capability: "video",
            enabled: true,
            bindings: [{ id: "binding", channelId: "channel", upstreamModel: "seedance-2-5", enabled: true, priority: 1 }],
        };

        const next = buildCapabilityVariants([original], original, original, ["video"]);

        expect(next[0]?.bindings[0]?.capabilityProfile).toEqual(defaultLogicalModelCapabilityProfile("video"));
    });
});
