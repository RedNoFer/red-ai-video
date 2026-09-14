export const DEFAULT_IMAGE_SIZE = "1024x1024";

export const IMAGE_SIZE_PRESETS = [
    { value: "1024x1024", label: "1024x1024", width: 1024, height: 1024, icon: "square" },
    { value: "1536x1024", label: "1536x1024", width: 1536, height: 1024, icon: "landscape" },
    { value: "1024x1536", label: "1024x1536", width: 1024, height: 1536, icon: "portrait" },
    { value: "1360x1024", label: "1360x1024", width: 1360, height: 1024, icon: "landscape" },
    { value: "1024x1360", label: "1024x1360", width: 1024, height: 1360, icon: "portrait" },
    { value: "1824x1024", label: "1824x1024", width: 1824, height: 1024, icon: "landscape" },
    { value: "1024x1824", label: "1024x1824", width: 1024, height: 1824, icon: "portrait" },
    { value: "2048x2048", label: "2048x2048", width: 2048, height: 2048, icon: "square" },
    { value: "2048x1152", label: "2048x1152", width: 2048, height: 1152, icon: "landscape" },
    { value: "1152x2048", label: "1152x2048", width: 1152, height: 2048, icon: "portrait" },
    { value: "3840x2160", label: "3840x2160", width: 3840, height: 2160, icon: "landscape" },
    { value: "2160x3840", label: "2160x3840", width: 2160, height: 3840, icon: "portrait" },
] as const;

export const IMAGE_SIZE_OPTIONS = [...IMAGE_SIZE_PRESETS, { value: "auto", label: "智能", width: 0, height: 0, icon: "auto" }] as const;

const LEGACY_IMAGE_SIZE_ALIASES: Record<string, string> = {
    "1:1": "1024x1024",
    "3:2": "1536x1024",
    "2:3": "1024x1536",
    "4:3": "1360x1024",
    "3:4": "1024x1360",
    "16:9": "1824x1024",
    "9:16": "1024x1824",
    "1:1-2k": "2048x2048",
    "16:9-2k": "2048x1152",
    "9:16-2k": "1152x2048",
    "16:9-4k": "3840x2160",
    "9:16-4k": "2160x3840",
};

export const IMAGE_SIZE_VALUES = IMAGE_SIZE_PRESETS.map((item) => item.value);

export function normalizeImagePresetSize(value: string | undefined) {
    const normalized = value?.trim() || DEFAULT_IMAGE_SIZE;
    return LEGACY_IMAGE_SIZE_ALIASES[normalized] || normalized;
}
