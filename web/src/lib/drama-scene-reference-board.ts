export const DRAMA_SCENE_REFERENCE_BOARD_VIEWS = [
    { key: "northwest", label: "西北斜向", position: "top-left" },
    { key: "north", label: "北向", position: "top-center" },
    { key: "northeast", label: "东北斜向", position: "top-right" },
    { key: "west", label: "西向", position: "middle-left" },
    { key: "hero", label: "主视角", position: "middle-center" },
    { key: "east", label: "东向", position: "middle-right" },
    { key: "southwest", label: "西南斜向", position: "bottom-left" },
    { key: "south", label: "南向", position: "bottom-center" },
    { key: "southeast", label: "东南斜向", position: "bottom-right" },
] as const;

export type DramaSceneReferenceViewKey = (typeof DRAMA_SCENE_REFERENCE_BOARD_VIEWS)[number]["key"];

export type DramaSceneReferenceBoard = {
    layout: "3x3";
    referenceId?: string;
};
