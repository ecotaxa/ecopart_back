import { ExploreContact, ExploreMapSample, ExploreProjectRow, ExploreSampleRow, ExploreSelection, ExploreSummary, LabelCount, PressureHistogramBin, ProfilePoint } from "../../entities/explore";
import { MinimalUserModel } from "../../entities/user";
import { aaInMm2, esdMm } from "../export/binned-computation";
import { ExploreProjectContext, ExploreUser } from "./explore-selection";

/* Pure statistics of a list of samples: what the "Selected data stats" and "Exportable selection"
 * tabs show, computed from the light rows and the project contexts, without any further IO. */

export const PRESSURE_HISTOGRAM_STEP_DB = 100;

const isFinite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

export function buildExploreSummary(samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>): ExploreSummary | null {
    if (samples.length === 0) return null;
    const project_ids = new Set<number>();
    let particles = 0;
    let images = 0;
    let depth = 0;
    let max_pressure: number | null = null;
    let size_min: number | null = null;
    let size_max: number | null = null;
    let time_start: number | null = null;
    let time_end: number | null = null;
    const instruments = new Map<string, number>();
    const histogram = new Map<number, number>();
    const profiles: ProfilePoint[] = [];

    for (const sample of samples) {
        project_ids.add(sample.project_id);
        particles += sample.nb_particles ?? 0;
        images += sample.nb_vignettes;
        if (sample.sample_type_label === "Depth") depth++;
        const context = projects.get(sample.project_id);
        const instrument = context?.project.instrument_model ?? "unknown";
        instruments.set(instrument, (instruments.get(instrument) ?? 0) + 1);

        if (isFinite(sample.max_pressure)) {
            if (max_pressure === null || sample.max_pressure > max_pressure) max_pressure = sample.max_pressure;
            const bin = Math.floor(Math.max(0, sample.max_pressure) / PRESSURE_HISTOGRAM_STEP_DB);
            histogram.set(bin, (histogram.get(bin) ?? 0) + 1);
        }
        if (context && isFinite(sample.particle_min_area_px) && isFinite(sample.particle_max_area_px) && sample.instrument_settings_aa > 0 && sample.instrument_settings_exp > 0) {
            const aa_mm2 = aaInMm2(context.project.instrument_model, sample.instrument_settings_aa);
            const smallest = esdMm(sample.particle_min_area_px, aa_mm2, sample.instrument_settings_exp) * 1000;
            const largest = esdMm(sample.particle_max_area_px, aa_mm2, sample.instrument_settings_exp) * 1000;
            if (size_min === null || smallest < size_min) size_min = smallest;
            if (size_max === null || largest > size_max) size_max = largest;
        }
        const time = Date.parse(sample.sampling_utc_date_time);
        if (Number.isFinite(time)) {
            if (time_start === null || time < time_start) time_start = time;
            if (time_end === null || time > time_end) time_end = time;
            if (isFinite(sample.latitude)) profiles.push({ date: new Date(time).toISOString(), latitude: sample.latitude });
        }
    }

    const max_pressure_histogram: PressureHistogramBin[] = [];
    if (histogram.size > 0) {
        let last_bin = 0;
        for (const bin of histogram.keys()) if (bin > last_bin) last_bin = bin;
        for (let bin = 0; bin <= last_bin; bin++) {
            max_pressure_histogram.push({ max_pressure: (bin + 1) * PRESSURE_HISTOGRAM_STEP_DB, nb_profiles: histogram.get(bin) ?? 0 });
        }
    }
    const instrument_counts: LabelCount[] = Array.from(instruments.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => a.label.localeCompare(b.label));

    return {
        counts: { projects: project_ids.size, samples: samples.length, particles, images },
        sample_types: { depth, time: samples.length - depth, total: samples.length },
        pressure_range: max_pressure === null ? null : { min: 0, max: max_pressure },
        size_range: size_min === null || size_max === null ? null : { min: size_min, max: size_max },
        time_range: time_start === null || time_end === null ? null : { start: new Date(time_start).toISOString(), end: new Date(time_end).toISOString() },
        instruments: instrument_counts,
        max_pressure_histogram,
        profiles,
    };
}

// Contact details are personal data: the e-mail is only served to a logged-in user.
export function toContact(user: MinimalUserModel | null | undefined, viewer: ExploreUser): ExploreContact | null {
    if (!user) return null;
    return { user_name: user.user_name, email: viewer.user_id === null ? "" : user.email };
}

export function buildExploreProjectRows(samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>, viewer: ExploreUser): ExploreProjectRow[] {
    const selected = new Map<number, number>();
    for (const sample of samples) selected.set(sample.project_id, (selected.get(sample.project_id) ?? 0) + 1);
    const rows: ExploreProjectRow[] = [];
    for (const [project_id, nb_selected_samples] of selected) {
        const context = projects.get(project_id);
        if (!context) continue;
        rows.push({
            project_id,
            project_title: context.project.project_title,
            instrument_model: context.project.instrument_model,
            ecotaxa_project_name: context.project.ecotaxa_project_name ?? null,
            nb_selected_samples,
            nb_samples: context.nb_samples,
            privacy_status: context.privacy,
            is_my_project: context.is_my_project,
            contact: toContact(context.privileges?.contact, viewer),
            managers: (context.privileges?.managers ?? []).map(manager => toContact(manager, viewer) as ExploreContact),
        });
    }
    return rows.sort((a, b) => a.project_title.localeCompare(b.project_title) || a.project_id - b.project_id);
}

export function buildExploreSelection(samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>, viewer: ExploreUser): ExploreSelection {
    return { summary: buildExploreSummary(samples, projects), projects: buildExploreProjectRows(samples, projects, viewer) };
}

export function buildExploreMap(samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>): ExploreMapSample[] {
    const points: ExploreMapSample[] = [];
    for (const sample of samples) {
        const context = projects.get(sample.project_id);
        if (!context || !isFinite(sample.latitude) || !isFinite(sample.longitude)) continue;
        points.push({
            sample_id: sample.sample_id,
            sample_name: sample.sample_name,
            project_id: sample.project_id,
            project_title: context.project.project_title,
            latitude: sample.latitude,
            longitude: sample.longitude,
            instrument_model: context.project.instrument_model,
            privacy_status: context.privacy,
            is_my_project: context.is_my_project,
        });
    }
    return points;
}
