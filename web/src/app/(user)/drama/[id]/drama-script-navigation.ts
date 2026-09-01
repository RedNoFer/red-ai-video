import type { DramaShot, DramaStoryScene } from "../types";

export type DramaScriptTextRange = { from: number; to: number };
export type DramaScriptAnchorKind = "shot" | "scene" | "missing";
export type DramaScriptAnchorTarget = DramaScriptTextRange & { kind: DramaScriptAnchorKind; label: string };

export function findDramaScriptTextRange(text: string, values: readonly string[]): DramaScriptTextRange | undefined {
    for (const value of values) {
        const source = value.trim();
        if (!source) continue;
        for (const candidate of [source, source.slice(0, 160), source.slice(0, 80)].filter((item, index, items) => (index === 0 || item.length >= 12) && items.indexOf(item) === index)) {
            const exact = text.indexOf(candidate);
            if (exact >= 0) return { from: exact, to: exact + candidate.length };

            const normalizedText = normalizeTextWithOffsets(text);
            const normalizedCandidate = normalizeTextWithOffsets(candidate).text;
            const normalizedIndex = normalizedText.text.indexOf(normalizedCandidate);
            if (normalizedIndex >= 0) {
                return {
                    from: normalizedText.offsets[normalizedIndex],
                    to: normalizedText.offsets[normalizedIndex + normalizedCandidate.length - 1] + 1,
                };
            }
        }
    }
}

export function findDramaSceneHeadingRange(text: string, scene: Pick<DramaStoryScene, "order" | "title"> & Partial<Pick<DramaStoryScene, "timeOfDay" | "timeRange">>) {
    const candidates = [
        `### 场${scene.order}｜${scene.title}${scene.timeOfDay ? `｜${scene.timeOfDay}` : ""}${scene.timeRange ? `｜${scene.timeRange}` : ""}`,
        `### 场${scene.order} | ${scene.title}${scene.timeOfDay ? ` | ${scene.timeOfDay}` : ""}${scene.timeRange ? ` | ${scene.timeRange}` : ""}`,
        `### 场${scene.order}｜${scene.title}`,
        `### 场${scene.order} | ${scene.title}`,
        `### 场${scene.order}`,
    ];
    return findDramaScriptTextRange(text, candidates);
}

export function resolveDramaShotAnchor(
    text: string,
    shot: Pick<DramaShot, "code" | "order" | "title" | "description" | "sourceText">,
    scene?: Pick<DramaStoryScene, "order" | "title"> & Partial<Pick<DramaStoryScene, "timeOfDay" | "timeRange">>,
): DramaScriptAnchorTarget {
    const exact = findDramaScriptTextRange(text, [shot.sourceText, shot.description, shot.title]);
    if (exact) return { ...exact, kind: "shot", label: shot.code || shot.title || `镜头 ${shot.order}` };
    if (scene) {
        const sceneRange = findDramaSceneHeadingRange(text, scene);
        if (sceneRange) return { ...sceneRange, kind: "scene", label: `场${scene.order}${scene.title ? ` · ${scene.title}` : ""}` };
    }
    return { from: 1, to: 1, kind: "missing", label: shot.code || shot.title || `镜头 ${shot.order}` };
}

function normalizeTextWithOffsets(value: string) {
    let text = "";
    const offsets: number[] = [];
    let pendingSpace = false;
    for (let index = 0; index < value.length; index += 1) {
        if (/\s/.test(value[index])) {
            pendingSpace = text.length > 0;
            continue;
        }
        if (pendingSpace) {
            text += " ";
            offsets.push(index);
            pendingSpace = false;
        }
        text += value[index];
        offsets.push(index);
    }
    return { text, offsets };
}
