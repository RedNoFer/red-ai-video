"use client";

import { Button } from "antd";
import { Sparkles } from "lucide-react";

import type { DramaEpisode, DramaProject, DramaShot, DramaStoryScene } from "../types";
import { findDramaSceneHeadingRange, resolveDramaShotAnchor } from "./drama-script-navigation";

export function DramaSceneStructure({
    project,
    episode,
    selectedShotId,
    onSelect,
    onSelectScene,
    analyzing = false,
    onAnalyze,
    scriptText = "",
}: {
    project: DramaProject;
    episode: DramaEpisode;
    selectedShotId?: string;
    onSelect: (shot: DramaShot) => void;
    onSelectScene?: (scene: DramaStoryScene) => void;
    analyzing?: boolean;
    onAnalyze?: () => void;
    scriptText?: string;
}) {
    const sceneNames = new Map(project.scenes.map((scene) => [scene.id, scene.name]));
    const storyScenes = [...(episode.storyScenes || [])].sort((left, right) => left.order - right.order);
    const renderShot = (shot: DramaShot, storyScene?: DramaStoryScene) => {
        const active = shot.id === selectedShotId;
        const anchor = resolveDramaShotAnchor(scriptText, shot, storyScene || storyScenes.find((item) => item.id === shot.storySceneId || item.shotIds.includes(shot.id)));
        return (
            <button
                key={shot.id}
                type="button"
                className={`w-full rounded-md border px-2.5 py-2 text-left transition ${active ? "border-violet-300 bg-violet-50/70 dark:border-violet-700/70 dark:bg-violet-950/25" : "border-transparent hover:border-border hover:bg-background"}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(shot)}
                aria-current={active ? "true" : undefined}
            >
                <span className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                    <span className="tabular-nums">{shot.code || `镜头 ${String(shot.order).padStart(2, "0")}`}</span>
                    {!storyScenes.length ? <span className="truncate">{sceneNames.get(shot.sceneId || "") || "未分配地点"}</span> : null}
                </span>
                <span className="mt-1 block truncate text-xs font-medium text-foreground">{shot.title || "未命名镜头"}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {compactShotSource(shot.sourceText || shot.description || "暂无原文依据")} · {anchor.kind === "shot" ? "正文已关联" : anchor.kind === "scene" ? `定位到${anchor.label}` : "未关联正文"}
                </span>
            </button>
        );
    };
    return (
        <aside className="flex h-full min-h-0 min-w-0 flex-col bg-card" data-drama-scene-structure>
            <div className="shrink-0 border-b border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h3 className="text-sm font-semibold">场景结构</h3>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{storyScenes.length ? `${storyScenes.length} 个剧情场次 / ${episode.shots.length} 个镜头` : `${episode.shots.length} 个镜头`}</p>
                    </div>
                </div>
            </div>
            <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
                {episode.shots.length ? (
                    <div className="space-y-2">
                        {storyScenes.length
                            ? storyScenes.map((storyScene) => {
                                  const shots = storyScene.shotIds.map((id) => episode.shots.find((shot) => shot.id === id)).filter((shot): shot is DramaShot => Boolean(shot));
                                  const sceneAnchor = findDramaSceneHeadingRange(scriptText, storyScene);
                                  return (
                                      <section key={storyScene.id} className="rounded-md border border-border/70 bg-background/45 p-1.5">
                                          <div className="px-1 pb-1.5">
                                              {onSelectScene ? (
                                                  <button
                                                      type="button"
                                                      className="block w-full rounded-sm text-left transition hover:bg-muted/35"
                                                      onMouseDown={(event) => event.preventDefault()}
                                                      onClick={() => onSelectScene(storyScene)}
                                                      aria-label={`定位到${storyScene.title}`}
                                                  >
                                                      <div className="flex items-center gap-2 text-[11px] font-semibold">
                                                          <span>{storyScene.code || `场 ${storyScene.order}`}</span>
                                                          <span className="min-w-0 truncate">{storyScene.title}</span>
                                                      </div>
                                                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                                          {[sceneNames.get(storyScene.locationId || ""), storyScene.timeOfDay, storyScene.timeRange].filter(Boolean).join(" · ") || "未设置地点与时间"}
                                                      </div>
                                                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{sceneAnchor ? "正文已关联" : "未关联正文"}</div>
                                                  </button>
                                              ) : (
                                                  <>
                                                      <div className="flex items-center gap-2 text-[11px] font-semibold">
                                                          <span>{storyScene.code || `场 ${storyScene.order}`}</span>
                                                          <span className="min-w-0 truncate">{storyScene.title}</span>
                                                      </div>
                                                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                                          {[sceneNames.get(storyScene.locationId || ""), storyScene.timeOfDay, storyScene.timeRange].filter(Boolean).join(" · ") || "未设置地点与时间"}
                                                      </div>
                                                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{sceneAnchor ? "正文已关联" : "未关联正文"}</div>
                                                  </>
                                              )}
                                          </div>
                                          <div className="space-y-0.5">{shots.map((shot) => renderShot(shot, storyScene))}</div>
                                      </section>
                                  );
                              })
                            : episode.shots.map((shot) => renderShot(shot))}
                    </div>
                ) : (
                    <div className="rounded-md bg-muted/25 p-3">
                        <div className="text-xs font-medium text-foreground">暂无场景结构</div>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">完成剧本后整理为可定位场景</p>
                        {onAnalyze ? (
                            <Button className="!mt-2.5 !h-7 !px-2.5 !text-xs" size="small" icon={<Sparkles className="size-3" />} loading={analyzing} disabled={!episode.script.trim()} onClick={onAnalyze}>
                                AI 整理
                            </Button>
                        ) : null}
                    </div>
                )}
            </div>
        </aside>
    );
}

function compactShotSource(value: string) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 30 ? `${normalized.slice(0, 30)}…` : normalized;
}
