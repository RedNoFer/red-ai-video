export function resolveDramaSupplierPrompt(override: string | undefined, automaticPrompt: string, projectRatio?: string) {
    if (override === undefined) return automaticPrompt;
    if (!projectRatio) return override;

    const parts = projectRatio.match(/^(\d+(?:\.\d+)?)\s*[:x×]\s*(\d+(?:\.\d+)?)$/u);
    if (!parts) return override;
    const width = Number(parts[1]);
    const height = Number(parts[2]);
    if (width <= 0 || height <= 0) return override;
    const ratio = projectRatio.replace(/\s+/gu, "");
    const orientation = width === height ? "方形" : width > height ? "横向" : "竖向";
    const ratioPattern = /\d+(?:\.\d+)?\s*[:x×]\s*\d+(?:\.\d+)?(?:\s*(?:横向|竖向|方形))?/gu;
    const compositionPattern = /^(构图与画幅[：:][^\n]*)$/mu;
    const composition = override.match(compositionPattern)?.[1];
    const updated = override.replace(ratioPattern, `${ratio} ${orientation}`);

    if (updated !== override) return updated;
    return composition ? override.replace(composition, `${composition}；画幅与项目成片一致：${ratio} ${orientation}`) : `${override}\n构图与画幅：${ratio} ${orientation}`;
}
