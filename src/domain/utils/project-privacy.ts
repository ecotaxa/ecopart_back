import { ProjectPrivacyLevel } from "../entities/project";

function monthsBetween(from: Date, to: Date): number {
    const years = to.getUTCFullYear() - from.getUTCFullYear();
    const months = to.getUTCMonth() - from.getUTCMonth();
    let total = years * 12 + months;
    if (to.getUTCDate() < from.getUTCDate()) total -= 1;
    return total;
}

// The delays run from the acquisition date of the project's oldest sample, as in the former EcoPart
// (oldestsampledate). A project without any sample date stays private.
export function computeProjectPrivacy(
    oldest_sample_utc_date_time: string | null,
    privacy_duration: number,
    visible_duration: number,
    public_duration: number,
    now: Date,
): ProjectPrivacyLevel {
    if (!oldest_sample_utc_date_time) return "private";
    const elapsed = monthsBetween(new Date(oldest_sample_utc_date_time), now);
    // The binned export decides access with this level: an unreadable date must not open a project.
    if (!Number.isFinite(elapsed)) return "private";
    if (elapsed < privacy_duration) return "private";
    if (elapsed < privacy_duration + visible_duration) return "visible";
    if (elapsed < privacy_duration + visible_duration + public_duration) return "public";
    return "open";
}
