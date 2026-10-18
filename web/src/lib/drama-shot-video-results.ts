import type { DramaShot, DramaShotVideoResult } from "@/lib/drama-project-contract";

export function mergeDramaShotVideoResults(shot: DramaShot, additions: DramaShotVideoResult[]): DramaShot {
    const results = new Map((shot.videoResults || []).map((result) => [result.id, result]));
    const knownUrls = new Set([...results.values()].map((result) => result.url));

    if (shot.videoUrl && !knownUrls.has(shot.videoUrl) && !additions.some((result) => result.url === shot.videoUrl)) {
        const id = `shot-output:${shot.generationTaskId || shot.id}:${shot.videoUrl}`;
        results.set(id, { id, taskId: shot.generationTaskId, url: shot.videoUrl });
    }

    for (const result of additions) {
        if (!result.id || !result.url) continue;
        if (!results.has(result.id) && !result.taskId && [...results.values()].some((existing) => existing.url === result.url)) continue;
        results.set(result.id, { ...results.get(result.id), ...result });
    }

    return {
        ...shot,
        videoResults: [...results.values()].sort((left, right) => (left.createdAt || "").localeCompare(right.createdAt || "") || left.id.localeCompare(right.id)),
    };
}

export function visibleDramaShotVideoResults(shot: DramaShot): DramaShotVideoResult[] {
    const results = mergeDramaShotVideoResults(shot, []).videoResults || [];
    return results.toSorted((left, right) => {
        if (left.url === shot.videoUrl && right.url !== shot.videoUrl) return -1;
        if (right.url === shot.videoUrl && left.url !== shot.videoUrl) return 1;
        return (right.createdAt || "").localeCompare(left.createdAt || "") || right.id.localeCompare(left.id);
    });
}
