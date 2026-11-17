import { describe, expect, it } from "vitest";

import { isYinglingFaceProcessingModel, withYinglingFaceProcessing } from "./yingling-face-processing";

describe("yingling face processing", () => {
    it("matches only the seedance-2.0 family", () => {
        for (const model of ["seedance-2.0", "seedance2.0-15s", "seedance-2.0-fast", "SEEDANCE-2.0"]) {
            expect(isYinglingFaceProcessingModel(model)).toBe(true);
        }
        for (const model of ["seedance-2.5", "seedance2.5-30s", "dola-seedance2.5-15s", "kling-omni-4.0", "wan-3.0-pro"]) {
            expect(isYinglingFaceProcessingModel(model)).toBe(false);
        }
    });

    it("adds the face processing fields for a Yingling seedance-2.0 request with images", () => {
        const payload = { model: "seedance-2.0", prompt: "海边", images: ["https://cdn.example.com/face.png"] };
        expect(withYinglingFaceProcessing(payload, { protocol: "yinglingapi", model: "seedance-2.0" })).toMatchObject({
            face_processing: true,
            face_processing_method: "grid",
        });
    });

    it("uses the configured face processing method", () => {
        const payload = { model: "seedance-2.0", images: ["https://cdn.example.com/face.png"] };
        expect(withYinglingFaceProcessing(payload, { protocol: "yinglingapi", model: "seedance-2.0", method: "feature_split" })).toMatchObject({
            face_processing: true,
            face_processing_method: "feature_split",
        });
    });

    it("keeps the payload untouched when disabled, text-only, or outside the seedance-2.0 family", () => {
        const payload = { model: "seedance-2.0", images: ["https://cdn.example.com/face.png"] };
        expect(withYinglingFaceProcessing(payload, { protocol: "yinglingapi", model: "seedance-2.0", enabled: false })).toBe(payload);
        expect(withYinglingFaceProcessing({ model: "seedance-2.0" }, { protocol: "yinglingapi", model: "seedance-2.0" })).toEqual({ model: "seedance-2.0" });
        expect(withYinglingFaceProcessing({ model: "seedance-2.5", images: ["https://cdn.example.com/face.png"] }, { protocol: "yinglingapi", model: "seedance-2.5" })).toEqual({
            model: "seedance-2.5",
            images: ["https://cdn.example.com/face.png"],
        });
        expect(withYinglingFaceProcessing(payload, { protocol: "buming-seedance", model: "seedance-2.0" })).toBe(payload);
        expect(withYinglingFaceProcessing(undefined, { protocol: "yinglingapi", model: "seedance-2.0" })).toBeUndefined();
    });
});
