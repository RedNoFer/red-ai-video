export type DramaVideoExportVideo = {
    id: string;
    url: string;
    isCurrent: boolean;
    createdAt?: string;
    durationMs?: number;
};

export type DramaVideoExportShot = {
    shotId: string;
    code: string;
    title: string;
    videos: DramaVideoExportVideo[];
};

export type DramaVideoExportEpisode = {
    episodeId: string;
    order: number;
    title: string;
    shots: DramaVideoExportShot[];
};

export type DramaVideoExportPayload = {
    projectId: string;
    projectTitle: string;
    episodes: DramaVideoExportEpisode[];
};

export type DramaVideoExportItem = { episodeId: string; shotId: string; videoId: string };

/** 稳定的复合键，避免 URL 或任务 ID 里的分隔符造成歧义。 */
export function dramaVideoExportEntryKey(episodeId: string, shotId: string, videoId: string) {
    return JSON.stringify([episodeId, shotId, videoId]);
}

export function dramaVideoExportKeys(payload: DramaVideoExportPayload) {
    return payload.episodes.flatMap((episode) => episode.shots.flatMap((shot) => shot.videos.map((video) => dramaVideoExportEntryKey(episode.episodeId, shot.shotId, video.id))));
}

/** 只把当前弹窗里真实存在的视频转换成导出请求项。 */
export function dramaVideoExportSelection(payload: DramaVideoExportPayload, selectedKeys: string[]): DramaVideoExportItem[] {
    const wanted = new Set(selectedKeys);
    const items: DramaVideoExportItem[] = [];
    for (const episode of payload.episodes) {
        for (const shot of episode.shots) {
            for (const video of shot.videos) {
                if (!wanted.has(dramaVideoExportEntryKey(episode.episodeId, shot.shotId, video.id))) continue;
                items.push({ episodeId: episode.episodeId, shotId: shot.shotId, videoId: video.id });
            }
        }
    }
    return items;
}
