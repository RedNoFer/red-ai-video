"use client";

import { useCallback, useEffect, useState } from "react";

import type { Asset, AssetKind } from "@/lib/library-asset-contract";
import { listLibraryAssetPage, type LibraryAssetPage } from "@/services/api/library-assets";

type AssetPageInput = { userId: string; page: number; pageSize: number; kind: AssetKind | "all"; keyword: string };

const prefetchedAssetPages = new Map<string, LibraryAssetPage>();
const assetPageRequests = new Map<string, Promise<LibraryAssetPage>>();

export function prefetchAssetPage(input: Partial<AssetPageInput> & { userId: string }) {
    const normalized = normalizeAssetPageInput(input);
    if (!normalized.userId) return Promise.resolve();
    return loadAssetPage(normalized).then(() => undefined, () => undefined);
}

export function useAssetPage(input: AssetPageInput) {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [reloadToken, setReloadToken] = useState(0);
    const [keyword, setKeyword] = useState(input.keyword.trim());

    useEffect(() => {
        const timer = setTimeout(() => setKeyword(input.keyword.trim()), 220);
        return () => clearTimeout(timer);
    }, [input.keyword]);

    useEffect(() => {
        const normalized = normalizeAssetPageInput({ ...input, keyword });
        if (!normalized.userId) {
            setAssets([]);
            setTotal(0);
            setError("");
            setLoading(false);
            return;
        }
        const key = assetPageKey(normalized);
        let cancelled = false;
        setLoading(true);
        setError("");
        void loadAssetPage(normalized)
            .then((result) => {
                prefetchedAssetPages.delete(key);
                if (cancelled) return;
                setAssets(result.assets);
                setTotal(result.total);
            })
            .catch((reason) => {
                if (cancelled) return;
                setAssets([]);
                setTotal(0);
                setError(reason instanceof Error ? reason.message : "素材加载失败");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [input.kind, input.page, input.pageSize, input.userId, keyword, reloadToken]);

    const reload = useCallback(() => {
        prefetchedAssetPages.clear();
        setReloadToken((value) => value + 1);
    }, []);
    return { assets, total, loading, error, reload };
}

function loadAssetPage(input: AssetPageInput) {
    const key = assetPageKey(input);
    const cached = prefetchedAssetPages.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = assetPageRequests.get(key);
    if (pending) return pending;
    const request = listLibraryAssetPage(toAssetPageQuery(input))
        .then((result) => {
            prefetchedAssetPages.set(key, result);
            return result;
        })
        .finally(() => {
            if (assetPageRequests.get(key) === request) assetPageRequests.delete(key);
        });
    assetPageRequests.set(key, request);
    return request;
}

function normalizeAssetPageInput(input: Partial<AssetPageInput> & { userId: string }): AssetPageInput {
    return {
        userId: input.userId,
        page: input.page || 1,
        pageSize: input.pageSize || 10,
        kind: input.kind || "all",
        keyword: input.keyword?.trim() || "",
    };
}

function toAssetPageQuery(input: AssetPageInput) {
    return {
        page: input.page,
        pageSize: input.pageSize,
        kind: input.kind === "all" ? undefined : input.kind,
        keyword: input.keyword,
    };
}

function assetPageKey(input: AssetPageInput) {
    return JSON.stringify([input.userId, input.page, input.pageSize, input.kind, input.keyword]);
}
