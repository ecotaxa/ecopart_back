export type ProjectPrivacyLevel = "private" | "visible" | "public" | "open";

function monthsBetween(from: Date, to: Date): number {
    const years = to.getUTCFullYear() - from.getUTCFullYear();
    const months = to.getUTCMonth() - from.getUTCMonth();
    let total = years * 12 + months;
    if (to.getUTCDate() < from.getUTCDate()) total -= 1;
    return total;
}

export function computeProjectPrivacy(
    project_creation_utc_date_time: string,
    privacy_duration: number,
    visible_duration: number,
    public_duration: number,
    now: Date,
): ProjectPrivacyLevel {
    const elapsed = monthsBetween(new Date(project_creation_utc_date_time), now);
    if (elapsed < privacy_duration) return "private";
    if (elapsed < privacy_duration + visible_duration) return "visible";
    if (elapsed < privacy_duration + visible_duration + public_duration) return "public";
    return "open";
}
