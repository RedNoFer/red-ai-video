import type { DramaCharacter, DramaNamedAsset } from "./drama-project-contract";
import { approvedAssetReference } from "./drama-asset-baseline";

export type DramaAssetCompletionKind = "characters" | "scenes" | "props" | "clues";
export type DramaAssetMissingItem = {
    key: "description" | "visualIdentity" | "styling" | "colorPalette" | "consistencyRules" | "payoff" | "voice" | "reference";
    label: string;
    task: "planning" | "voice" | "reference";
};

export function getDramaAssetMissingItems(asset: DramaNamedAsset | DramaCharacter | (DramaNamedAsset & { payoff?: string }), kind: DramaAssetCompletionKind): DramaAssetMissingItem[] {
    const profile = asset.profile;
    const missing: DramaAssetMissingItem[] = [];
    const add = (key: DramaAssetMissingItem["key"], label: string, task: DramaAssetMissingItem["task"]) => missing.push({ key, label, task });
    if (!asset.description.trim()) add("description", "剧情身份或用途", "planning");
    if (!profile?.visualIdentity?.trim()) add("visualIdentity", "视觉识别", "planning");
    if (!profile?.styling?.trim()) add("styling", "造型材质", "planning");
    if (!profile?.colorPalette?.trim()) add("colorPalette", kind === "characters" ? "标志色" : kind === "scenes" ? "环境色" : kind === "props" ? "固定色彩" : "提示色", "planning");
    if (!profile?.consistencyRules?.trim()) add("consistencyRules", "一致性规则", "planning");
    if (kind === "clues" && "payoff" in asset && (typeof asset.payoff !== "string" || !asset.payoff.trim())) add("payoff", "线索回收位置", "planning");
    if (kind === "characters") {
        const voice = (asset as DramaCharacter).voiceProfile;
        if (!voice?.blueprint || !voice.instructions.trim() || !voice.voiceId?.trim()) add("voice", "音色画像与项目音色", "voice");
    }
    if (kind !== "clues" && !approvedAssetReference(asset)) add("reference", "基准图", "reference");
    return missing;
}

export function dramaAssetCompletionSummary(asset: DramaNamedAsset | DramaCharacter | (DramaNamedAsset & { payoff?: string }), kind: DramaAssetCompletionKind) {
    const missingItems = getDramaAssetMissingItems(asset, kind);
    return {
        missingItems,
        planningCount: missingItems.filter((item) => item.task === "planning").length,
        voiceCount: missingItems.filter((item) => item.task === "voice").length,
        referenceCount: missingItems.filter((item) => item.task === "reference").length,
    };
}
