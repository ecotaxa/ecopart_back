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

// The first instant from which `months` full months have elapsed since `from`, as monthsBetween
// counts them: midnight UTC of the same day of the month, or of the 1st of the following month when
// the target month has no such day (31 January + 1 month is reached on 1 March).
export function privacyMilestone(oldest_sample_utc_date_time: string | null, months: number): string | null {
    if (!oldest_sample_utc_date_time) return null;
    const from = new Date(oldest_sample_utc_date_time);
    if (Number.isNaN(from.getTime())) return null;
    const day = from.getUTCDate();
    const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, day));
    const milestone = target.getUTCDate() === day ? target : new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months + 1, 1));
    return milestone.toISOString();
}

// When the project becomes visible, public and open; all null while it has no sample.
export function privacyMilestones(
    oldest_sample_utc_date_time: string | null,
    privacy_duration: number,
    visible_duration: number,
    public_duration: number,
): { visible: string | null; public: string | null; open: string | null } {
    return {
        visible: privacyMilestone(oldest_sample_utc_date_time, privacy_duration),
        public: privacyMilestone(oldest_sample_utc_date_time, privacy_duration + visible_duration),
        open: privacyMilestone(oldest_sample_utc_date_time, privacy_duration + visible_duration + public_duration),
    };
}
