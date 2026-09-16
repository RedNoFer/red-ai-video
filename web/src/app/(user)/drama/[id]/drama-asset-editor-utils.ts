export function resolveDramaSupplierPrompt(override: string | undefined, automaticPrompt: string) {
    return override === undefined ? automaticPrompt : override;
}
