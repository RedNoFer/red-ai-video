import { describe, expect, it } from "vitest";

import { dialogueDirectionKey } from "./drama-review-panel";

describe("dialogueDirectionKey", () => {
    it("keeps dialogue rows distinct when an utterance ID is reused across shots", () => {
        const first = dialogueDirectionKey({ id: "D02", shotCode: "SH01" }, 0);
        const second = dialogueDirectionKey({ id: "D02", shotCode: "SH02" }, 0);

        expect(first).not.toBe(second);
    });

    it("keeps duplicate rows within one shot distinct", () => {
        const first = dialogueDirectionKey({ id: "D02", shotCode: "SH01" }, 0);
        const second = dialogueDirectionKey({ id: "D02", shotCode: "SH01" }, 1);

        expect(first).not.toBe(second);
    });
});
