import type { DramaReferenceManifestRole, DramaShotReferenceIntent } from "@/lib/drama-project-contract";

export type DramaPackageReferenceEntry = { code: string; guidance: string };

type ScanResult = { sections: string[]; rest: string };

/**
 * Scan authored 【参考】 blocks: a block starts at a line beginning with 【参考】 and
 * continues over its entry/tail-note lines until a blank or structural line ends it.
 */
function scanDramaPackageReferenceSections(text: string): ScanResult {
    const lines = text.replace(/\r\n?/gu, "\n").split("\n");
    const sections: string[] = [];
    const kept: string[] = [];
    let skipping = false;
    for (const line of lines) {
        const value = line.trim();
        if (!skipping && value.startsWith("【参考】")) {
            skipping = true;
            sections.push(value);
            continue;
        }
        if (skipping) {
            if (!value || isStructuralDramaLine(value) || !isReferenceContinuationLine(value)) {
                skipping = false;
                kept.push(line);
                continue;
            }
            sections[sections.length - 1] += `\n${value}`;
            continue;
        }
        kept.push(line);
    }
    return {
        sections,
        rest: kept
            .join("\n")
            .replace(/\n{3,}/gu, "\n\n")
            .trim(),
    };
}

function isStructuralDramaLine(value: string) {
    return value.startsWith("【") || /^(?:\d+(?:\.\d+)?\s*(?:[-–—~～]|至|到)\s*\d+(?:\.\d+)?\s*秒|从\s*\d+(?:\.\d+)?\s*秒)/u.test(value) || /^Cut\s+to\s*[：:]/iu.test(value) || /^(?:开场时|结束时|声音|角色音色|参考图片|镜头模式)[：:，]?/u.test(value);
}

/** Continuation lines are entry pairs (`CODE=`) or 参考-prefixed tail notes; anything else ends the block. */
function isReferenceContinuationLine(value: string) {
    return /^[A-Za-z][A-Za-z0-9_-]*\s*[=＝]/u.test(value) || value.startsWith("参考");
}

/** Parse `CODE=固定元素描述` pairs out of 【参考】 blocks; the trailing note after the last 。 is dropped. */
export function extractDramaPackageReferenceEntries(text: string): DramaPackageReferenceEntry[] {
    const { sections } = scanDramaPackageReferenceSections(text);
    const entries: DramaPackageReferenceEntry[] = [];
    for (const section of sections) {
        const body = section.replace(/^【参考】[：:]?/u, "");
        for (const segment of body.split(/[；;\n]/u)) {
            const match = /^\s*([A-Za-z][A-Za-z0-9_-]*)\s*[=＝]\s*(.*?)\s*$/u.exec(segment);
            if (!match) continue;
            const guidance = match[2].split("。")[0].trim();
            if (guidance) entries.push({ code: match[1], guidance });
        }
    }
    return entries;
}

/** Remove 【参考】 blocks from the public prompt; a no-match input is returned unchanged. */
export function stripDramaPackageReferenceSections(text: string) {
    const { sections, rest } = scanDramaPackageReferenceSections(text);
    return sections.length ? rest : text;
}

/** Replace package asset codes with natural-language asset names inside the public body. */
export function replaceDramaPackageCodeTokens(text: string, resolve: (code: string) => string | undefined) {
    if (!text) return text;
    return text.replace(/\b([A-Za-z][A-Za-z0-9_-]{1,31})\b/gu, (token) => resolve(token) ?? resolve(token.toUpperCase()) ?? token);
}

/** Bind entries to project assets in authored order; duplicate codes keep their first fact. */
export function bindDramaPackageReferenceEntries(entries: DramaPackageReferenceEntry[], resolveAsset: (code: string) => { assetId: string; role: DramaReferenceManifestRole } | undefined): { intents: DramaShotReferenceIntent[]; unknownCodes: string[] } {
    const intents: DramaShotReferenceIntent[] = [];
    const unknownCodes: string[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
        if (seen.has(entry.code)) continue;
        seen.add(entry.code);
        const asset = resolveAsset(entry.code);
        if (!asset) {
            unknownCodes.push(entry.code);
            continue;
        }
        intents.push({ assetId: asset.assetId, code: entry.code, role: asset.role, guidance: entry.guidance });
    }
    return { intents, unknownCodes };
}
