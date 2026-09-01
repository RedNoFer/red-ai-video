"use client";

import { prefetchAssetPage } from "@/app/(user)/assets/use-asset-page";
import { useCanvasStore } from "@/app/(user)/canvas/stores/use-canvas-store";
import { useDramaStore } from "@/app/(user)/drama/stores/use-drama-store";
import type { NavigationToolSlug } from "@/constant/navigation-tools";
import { useUserStore } from "@/stores/use-user-store";

export function prefetchNavigationToolData(slug: NavigationToolSlug) {
    const userId = useUserStore.getState().user?.id || "";
    if (!userId) return;
    if (slug === "canvas") void useCanvasStore.getState().hydrate().catch(() => undefined);
    if (slug === "drama") void useDramaStore.getState().hydrate().catch(() => undefined);
    if (slug === "assets") void prefetchAssetPage({ userId }).catch(() => undefined);
}
