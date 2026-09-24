"use client";

import { SlidersHorizontal } from "lucide-react";

import { CreativeGenerationPreferences, generationPreferenceSummary, type CreativeGenerationPreferencePatch } from "@/components/creative-generation-preferences";
import type { CreativeGenerationPreferences as GenerationPreferences } from "@/lib/creative-runtime-contract";
import { DEFAULT_IMAGE_SIZE } from "@/lib/image-generation-sizes";
import type { AiConfig } from "@/stores/use-config-store";
import { useCreativeComposerPopoverPlacement, type CreativeComposerPopoverPlacement } from "@/components/creative-composer-popover";

type CanvasImageSettingsPopoverProps = {
    config: AiConfig;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
    onOpenChange?: (open: boolean) => void;
    buttonClassName?: string;
    placement?: CreativeComposerPopoverPlacement;
    fixedSizeLabel?: string;
};

export function CanvasImageSettingsPopover({ config, onConfigChange, onOpenChange, buttonClassName, placement = "topLeft", fixedSizeLabel }: CanvasImageSettingsPopoverProps) {
    const responsivePlacement = useCreativeComposerPopoverPlacement(placement);
    const preferences: GenerationPreferences = {
        mode: "image",
        image: {
            size: config.size || DEFAULT_IMAGE_SIZE,
            quality: "high",
            count: positiveInteger(config.count),
        },
    };
    const summary = canvasImagePreferenceSummary(preferences, fixedSizeLabel);
    const fullSummary = fixedSizeLabel ? `${fixedSizeLabel} · 4K 高清（模型绑定） · ${preferences.image?.count || 1}张` : generationPreferenceSummary("image", preferences);

    return (
        <CreativeGenerationPreferences
            capability="image"
            preferences={preferences}
            triggerLabel={summary}
            triggerAriaLabel={`图片设置：${fullSummary}`}
            triggerIcon={<SlidersHorizontal className="size-4" />}
            triggerClassName={buttonClassName}
            triggerLabelClassName="whitespace-nowrap text-left !overflow-visible !text-clip"
            placement={responsivePlacement}
            autoAdjustOverflow
            fixedSizeLabel={fixedSizeLabel}
            onOpenChange={onOpenChange}
            onChange={(patch) => applyImagePreferencePatch(patch, onConfigChange)}
        />
    );
}

export function canvasImagePreferenceSummary(preferences: GenerationPreferences, fixedSizeLabel?: string) {
    const image = preferences.image;
    const size = fixedSizeLabel || compactSizeLabel(image?.size);
    const count = image?.count || 1;
    return `${size} · 4K 高清${count > 1 ? ` · ${count}张` : ""}`;
}

function applyImagePreferencePatch(patch: CreativeGenerationPreferencePatch, onChange: (key: keyof AiConfig, value: string) => void) {
    if (patch.size !== undefined) onChange("size", patch.size);
    if (patch.count !== undefined) onChange("count", String(patch.count));
}

function positiveInteger(value: unknown) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function compactSizeLabel(value?: string) {
    return !value || value === "auto" ? "智能" : value.replace("x", "×");
}
