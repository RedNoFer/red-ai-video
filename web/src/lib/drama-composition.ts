export type DramaCompositionProfile = {
    aspectRatio: string;
    orientation: "portrait" | "landscape" | "square" | "custom";
    subjectPriority: string;
    framingStrategy: string;
    movementStrategy: string;
    clarityContract: string;
};

export function resolveDramaCompositionProfile(ratio: string | undefined): DramaCompositionProfile {
    const normalized = String(ratio || "").trim();
    if (normalized === "9:16") {
        return {
            aspectRatio: normalized,
            orientation: "portrait",
            subjectPriority: "优先单人、双人关系、过肩和关键道具；不为全员入画缩小主角",
            framingStrategy: "使用上下纵深、前中后层级和有限宽度构图；全景只在确有空间职责时使用",
            movementStrategy: "沿纵深推进、后退或跟随主体；横向移动必须有明确的视线或空间关系动机",
            clarityContract: "主角脸部、完整头顶、下巴、主要衣领和关键手部清晰可辨；信息过载时拆镜",
        };
    }
    if (normalized === "16:9") {
        return {
            aspectRatio: normalized,
            orientation: "landscape",
            subjectPriority: "优先横向空间关系、多人关系和群像定场；主次人物保持清晰层级",
            framingStrategy: "使用横向关系、视线链、柱列递退和真实空间尺度，不把画面旋转或裁切成竖屏",
            movementStrategy: "横移、摇镜或横向跟拍只在空间关系和视线转移需要时使用",
            clarityContract: "三位主角、重要道具和空间锚点清楚可辨；背景人物不以无意义超广角缩小",
        };
    }
    if (normalized === "1:1") {
        return {
            aspectRatio: normalized,
            orientation: "square",
            subjectPriority: "优先单人或紧凑双人关系，减少横向并列主体",
            framingStrategy: "使用中心关系、上下层次和适度留白，不把横屏群像强行塞入方形",
            movementStrategy: "以锁定、短推近或小幅跟随为主，只有信息转移需要时改变机位",
            clarityContract: "主体脸部、手部和关键道具清晰可辨，避免过度裁脸或过度虚化",
        };
    }
    return {
        aspectRatio: normalized || "custom",
        orientation: "custom",
        subjectPriority: "根据实际可见宽高、主体数量和空间拓扑自适应分配主体",
        framingStrategy: "先保证主体、动作、空间锚点和安全边界可读，再选择景别与构图",
        movementStrategy: "只使用能服务当前信息转移的单一主运镜",
        clarityContract: "所有可见重要主体在当前景别下清晰可辨；过载时拆镜而非缩小或虚化",
    };
}

export function formatDramaCompositionContract(ratio: string | undefined) {
    const profile = resolveDramaCompositionProfile(ratio);
    return `画幅构图合同（${profile.aspectRatio}）：${profile.subjectPriority}；构图：${profile.framingStrategy}；运镜：${profile.movementStrategy}；清晰度：${profile.clarityContract}。禁止把其他画幅的站位、景别和运镜只替换比例后直接复用。`;
}
