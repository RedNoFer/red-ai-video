import { describe, expect, it } from "vitest";
import braces from "braces";

describe("braces nesting-depth security patch", () => {
    it("continues to expand ordinary brace patterns", () => {
        expect(braces.expand("{a,b}")).toEqual(["a", "b"]);
    });

    it("rejects deeply nested input before recursive AST walkers run", () => {
        const attack = `${"{".repeat(101)}x${"}".repeat(101)}`;
        expect(() => braces(attack)).toThrow(/nesting depth/u);
        expect(() => braces.expand(attack)).toThrow(/nesting depth/u);
    });
});
