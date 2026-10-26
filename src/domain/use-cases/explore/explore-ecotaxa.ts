import { ECOTAXA_BIOTA_TAXO_ID } from "../../constants/ecotaxa-living-taxo";
import { EcoTaxaTaxon } from "../../entities/ecotaxa_account";
import { ClassificationShares, EcoTaxaImportedSample, EcoTaxaObjectCounts, ExploreClassificationState, ExploreEcoTaxaSummary, ExploreFilters, ExploreImage, ExploreSampleRow, StoredEcoTaxaStats } from "../../entities/explore";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { EcoTaxaThrottle } from "./ecotaxa-throttle";
import { ExploreProjectContext } from "./explore-selection";

/* What the Explore page asks EcoTaxa: the classification counts of the samples (stats), the names of
 * the taxa they use, and a few random object images. Every call goes through the generic account of
 * the instance and the shared throttle.
 *
 * The stats are the costly part (EcoTaxa scans every object of the samples asked), so EcoPart keeps
 * them in its database: a request is served from there, refreshes synchronously only a few missing
 * or stale samples, and hands the rest to a background queue, answering `partial` meanwhile. A daily
 * sweep refreshes every sample older than a day, gently, so that the queue rarely has much to do. */

export interface EcoTaxaSampleStat {
    ecotaxa_sample_id: number;
    used_taxa: number[];
    nb_unclassified: number;
    nb_validated: number;
    nb_dubious: number;
    nb_predicted: number;
}

interface InstanceAccess {
    instance_id: number;
    base_url: string;
    token: string;
}

interface SampleOnInstance {
    sample: EcoTaxaImportedSample;
    ecotaxa_project_id: number;
    access: InstanceAccess;
}

// A project as the service needs it: its EcoTaxa link.
export type EcoTaxaProjectLink = { project_id: number; ecotaxa_project_id: number | null; ecotaxa_instance_id: number | null };

export const ECOTAXA_STATS_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
// Memory caches (instance access, object totals of the images, names looked up) live this long; taxa names never change.
export const ECOTAXA_CACHE_TTL_MS = 10 * 60 * 1000;
// EcoTaxa reads every object of the samples asked: small batches keep each query short.
export const ECOTAXA_STATS_BATCH = 50;
// Beyond this many samples to refresh, a request answers with what it has and queues the rest.
export const ECOTAXA_SYNC_REFRESH_LIMIT = 100;
export const ECOTAXA_MAX_IN_FLIGHT = 2;
// The queue breathes between two batches, the sweep between two as well: EcoTaxa's own users first.
export const ECOTAXA_QUEUE_PAUSE_MS = 500;
export const ECOTAXA_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const ECOTAXA_SWEEP_FIRST_DELAY_MS = 60 * 1000;
export const EXPLORE_IMAGES_DEFAULT = 4;
export const EXPLORE_IMAGES_MAX = 12;
const IMAGE_FIELDS = ["img.file_name", "obj.depth_min", "obj.objdate", "obj.objtime", "txo.display_name"];

const totalOf = (stat: EcoTaxaSampleStat) => stat.nb_unclassified + stat.nb_validated + stat.nb_dubious + stat.nb_predicted;

export function matchesClassificationState(stat: EcoTaxaSampleStat, state: ExploreClassificationState): boolean {
    const total = totalOf(stat);
    if (state === "all") return true;
    if (total === 0) return false;
    if (state === "fully_validated") return stat.nb_validated === total;
    return stat.nb_predicted === total;
}

// Exclusive states, in percent of the samples with stats: a sample with any validated object is
// (fully or partially) validated, otherwise (fully or partially) predicted when any is predicted.
export function classificationSharesOf(stats: EcoTaxaSampleStat[]): ClassificationShares {
    const shares = { fully_validated: 0, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 };
    let counted = 0;
    for (const stat of stats) {
        const total = totalOf(stat);
        if (total === 0) continue;
        counted++;
        if (stat.nb_validated === total) shares.fully_validated++;
        else if (stat.nb_validated > 0) shares.partially_validated++;
        else if (stat.nb_predicted === total) shares.fully_predicted++;
        else if (stat.nb_predicted > 0) shares.partially_predicted++;
    }
    const percent = (n: number) => counted === 0 ? 0 : Math.round((n / counted) * 1000) / 10;
    return {
        fully_validated: percent(shares.fully_validated),
        fully_predicted: percent(shares.fully_predicted),
        partially_validated: percent(shares.partially_validated),
        partially_predicted: percent(shares.partially_predicted),
    };
}

export function objectCountsOf(stats: EcoTaxaSampleStat[]): EcoTaxaObjectCounts {
    const counts = { total: 0, validated: 0, predicted: 0 };
    for (const stat of stats) {
        counts.total += totalOf(stat);
        counts.validated += stat.nb_validated;
        counts.predicted += stat.nb_predicted;
    }
    return counts;
}

export function toSampleStat(stored: StoredEcoTaxaStats): EcoTaxaSampleStat {
    return { ecotaxa_sample_id: stored.ecotaxa_sample_id, used_taxa: stored.used_taxa, nb_unclassified: stored.nb_unclassified, nb_validated: stored.nb_validated, nb_dubious: stored.nb_dubious, nb_predicted: stored.nb_predicted };
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class ExploreEcoTaxaService {
    private readonly taxa_cache = new Map<string, EcoTaxaTaxon>();
    private readonly totals_cache = new Map<string, { at: number; total: number }>();
    private readonly access_cache = new Map<number, { at: number; access: InstanceAccess | null }>();
    // EcoTaxa projects whose sample names were looked up: a name EcoTaxa does not know is not asked again for a while.
    private readonly resolved_projects = new Map<number, number>();
    private readonly throttle: EcoTaxaThrottle;
    // The background refresh: samples waiting, by id, drained by one worker at a time.
    private readonly queue = new Map<number, SampleOnInstance>();
    private draining: Promise<void> | null = null;
    private sweep_timer: NodeJS.Timeout | null = null;

    constructor(
        private readonly ecotaxaAccountRepository: EcotaxaAccountRepository,
        private readonly sampleRepository: SampleRepository,
        private readonly projectRepository: ProjectRepository,
        private readonly now: () => number = () => Date.now(),
        private readonly random: () => number = Math.random,
        throttle: EcoTaxaThrottle = new EcoTaxaThrottle(ECOTAXA_MAX_IN_FLIGHT),
        private readonly pause: (ms: number) => Promise<void> = sleep,
    ) {
        this.throttle = throttle;
    }

    /* ─── instances and sample ids ─── */

    private async accessOf(instance_id: number): Promise<InstanceAccess | null> {
        const now = this.now();
        const cached = this.access_cache.get(instance_id);
        if (cached && now - cached.at < ECOTAXA_CACHE_TTL_MS) return cached.access;
        let access: InstanceAccess | null = null;
        try {
            const [instance, account] = await Promise.all([
                this.ecotaxaAccountRepository.getOneEcoTaxaInstance(instance_id),
                this.ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance(instance_id),
            ]);
            if (instance) access = { instance_id, base_url: instance.ecotaxa_instance_url, token: account.ecotaxa_account_token };
        } catch (error) {
            console.log(new Date().toISOString(), `Explore: EcoTaxa instance ${instance_id} unavailable`, (error as Error).message);
        }
        this.access_cache.set(instance_id, { at: now, access });
        return access;
    }

    // The samples imported in EcoTaxa, with the access to their instance; the ids EcoPart never
    // stored (samples imported through EcoPart, which only the migration path numbered) are resolved
    // from the EcoTaxa project and written back, once.
    private async samplesOnInstances(samples: (EcoTaxaImportedSample & { ecotaxa_sample_imported?: boolean })[], links: Map<number, EcoTaxaProjectLink>): Promise<SampleOnInstance[]> {
        const now = this.now();
        const result: SampleOnInstance[] = [];
        const unresolved = new Map<number, SampleOnInstance[]>();
        for (const sample of samples) {
            if (sample.ecotaxa_sample_imported === false) continue;
            const link = links.get(sample.project_id);
            if (!link || link.ecotaxa_project_id === null || link.ecotaxa_instance_id === null) continue;
            const access = await this.accessOf(link.ecotaxa_instance_id);
            if (!access) continue;
            const entry = { sample, ecotaxa_project_id: link.ecotaxa_project_id, access };
            if (sample.ecotaxa_sample_id !== null) result.push(entry);
            else {
                const list = unresolved.get(link.project_id) ?? [];
                list.push(entry);
                unresolved.set(link.project_id, list);
            }
        }
        for (const entries of unresolved.values()) {
            const { access, ecotaxa_project_id } = entries[0];
            const looked_up = this.resolved_projects.get(ecotaxa_project_id);
            if (looked_up !== undefined && now - looked_up < ECOTAXA_CACHE_TTL_MS) continue;
            this.resolved_projects.set(ecotaxa_project_id, now);
            try {
                const by_name = new Map((await this.throttle.run(() => this.ecotaxaAccountRepository.api_ecotaxa_get_samples_in_project(access.base_url, access.token, ecotaxa_project_id))).map(s => [s.orig_id, s.sampleid]));
                for (const entry of entries) {
                    const ecotaxa_sample_id = by_name.get(entry.sample.sample_name);
                    if (ecotaxa_sample_id === undefined) continue;
                    entry.sample.ecotaxa_sample_id = ecotaxa_sample_id;
                    await this.sampleRepository.standardUpdateManySamples({ ecotaxa_sample_id }, { sample_id: entry.sample.sample_id });
                    result.push(entry);
                }
            } catch (error) {
                console.log(new Date().toISOString(), `Explore: cannot resolve the EcoTaxa sample ids of project ${ecotaxa_project_id}`, (error as Error).message);
            }
        }
        return result;
    }

    private static linksOf(projects: Map<number, ExploreProjectContext>): Map<number, EcoTaxaProjectLink> {
        return new Map(Array.from(projects.values()).map(context => [context.project.project_id, context.project]));
    }

    /* ─── stats: the database first, EcoTaxa for what is missing or stale ─── */

    // Reads EcoTaxa for these samples, in small batches through the throttle, and keeps the answers.
    private async fetchStats(entries: SampleOnInstance[]): Promise<Map<number, EcoTaxaSampleStat>> {
        const stats = new Map<number, EcoTaxaSampleStat>();
        const by_instance = new Map<number, SampleOnInstance[]>();
        for (const entry of entries) {
            const list = by_instance.get(entry.access.instance_id) ?? [];
            list.push(entry);
            by_instance.set(entry.access.instance_id, list);
        }
        for (const list of by_instance.values()) {
            const access = list[0].access;
            const by_ecotaxa_id = new Map(list.map(entry => [entry.sample.ecotaxa_sample_id as number, entry.sample]));
            for (let i = 0; i < list.length; i += ECOTAXA_STATS_BATCH) {
                const batch = list.slice(i, i + ECOTAXA_STATS_BATCH).map(entry => entry.sample.ecotaxa_sample_id as number);
                try {
                    const rows = await this.throttle.run(() => this.ecotaxaAccountRepository.api_ecotaxa_get_sample_stats(access.base_url, access.token, batch));
                    const fetched_utc_date_time = new Date(this.now()).toISOString();
                    const stored: StoredEcoTaxaStats[] = [];
                    for (const row of rows) {
                        const sample = by_ecotaxa_id.get(row.sample_id);
                        if (!sample) continue;
                        const stat: EcoTaxaSampleStat = { ecotaxa_sample_id: row.sample_id, used_taxa: row.used_taxa ?? [], nb_unclassified: row.nb_unclassified, nb_validated: row.nb_validated, nb_dubious: row.nb_dubious, nb_predicted: row.nb_predicted };
                        stats.set(sample.sample_id, stat);
                        stored.push({ sample_id: sample.sample_id, ...stat, fetched_utc_date_time });
                    }
                    await this.sampleRepository.saveEcoTaxaStats(stored);
                } catch (error) {
                    console.log(new Date().toISOString(), `Explore: EcoTaxa sample stats unavailable on instance ${access.instance_id}`, (error as Error).message);
                }
            }
        }
        return stats;
    }

    private enqueue(entries: SampleOnInstance[]): void {
        for (const entry of entries) if (!this.queue.has(entry.sample.sample_id)) this.queue.set(entry.sample.sample_id, entry);
        if (this.draining === null && this.queue.size > 0) this.draining = this.drain();
    }

    // The worker releases its place inside its own body: whatever is queued once it has left the
    // loop finds the place free and starts a new worker.
    private async drain(): Promise<void> {
        try {
            while (this.queue.size > 0) {
                const batch = Array.from(this.queue.values()).slice(0, ECOTAXA_STATS_BATCH);
                for (const entry of batch) this.queue.delete(entry.sample.sample_id);
                await this.fetchStats(batch);
                if (this.queue.size > 0) await this.pause(ECOTAXA_QUEUE_PAUSE_MS);
            }
        } catch (error) {
            console.log(new Date().toISOString(), "Explore: EcoTaxa stats refresh queue stopped", error);
        } finally {
            this.draining = null;
        }
    }

    // The work the background refresh still has to do.
    get queued(): number { return this.queue.size; }

    // Waits for the queue to be drained (tests, shutdown).
    async idle(): Promise<void> { await this.draining; }

    // Stats of the entries: from the database when read less than a day ago; otherwise read from
    // EcoTaxa now when they are few (`sync_limit`), else queued, with the stale ones served meanwhile.
    private async statsOfEntries(entries: SampleOnInstance[], sync_limit: number): Promise<{ stats: Map<number, EcoTaxaSampleStat>; pending: number }> {
        const stats = new Map<number, EcoTaxaSampleStat>();
        const stored = await this.sampleRepository.getEcoTaxaStats(entries.map(entry => entry.sample.sample_id));
        const by_sample = new Map(stored.map(row => [row.sample_id, row]));
        const now = this.now();
        const to_refresh: SampleOnInstance[] = [];
        for (const entry of entries) {
            const row = by_sample.get(entry.sample.sample_id);
            const fresh = row !== undefined && row.ecotaxa_sample_id === entry.sample.ecotaxa_sample_id && now - Date.parse(row.fetched_utc_date_time) < ECOTAXA_STATS_STALE_AFTER_MS;
            if (row) stats.set(entry.sample.sample_id, toSampleStat(row));
            if (!fresh) to_refresh.push(entry);
        }
        if (to_refresh.length === 0) return { stats, pending: 0 };
        if (to_refresh.length <= sync_limit) {
            for (const [sample_id, stat] of await this.fetchStats(to_refresh)) stats.set(sample_id, stat);
            return { stats, pending: 0 };
        }
        this.enqueue(to_refresh);
        return { stats, pending: to_refresh.filter(entry => !stats.has(entry.sample.sample_id)).length };
    }

    async statsOf(samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>): Promise<Map<number, EcoTaxaSampleStat>> {
        const entries = await this.samplesOnInstances(samples, ExploreEcoTaxaService.linksOf(projects));
        return (await this.statsOfEntries(entries, ECOTAXA_SYNC_REFRESH_LIMIT)).stats;
    }

    // The samples whose classification state is the asked one; samples without any stats yet are
    // left out (they are being read in the background).
    async filterByClassificationState(samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>, filters: ExploreFilters): Promise<ExploreSampleRow[]> {
        if (filters.classification_state === "all") return samples;
        const stats = await this.statsOf(samples, projects);
        return samples.filter(sample => {
            const stat = stats.get(sample.sample_id);
            return stat !== undefined && matchesClassificationState(stat, filters.classification_state);
        });
    }

    private async taxaOf(access: InstanceAccess, taxon_ids: Set<number>): Promise<EcoTaxaTaxon[]> {
        const missing = Array.from(taxon_ids).filter(id => !this.taxa_cache.has(`${access.instance_id}:${id}`));
        if (missing.length > 0) {
            try {
                for (const taxon of await this.throttle.run(() => this.ecotaxaAccountRepository.api_ecotaxa_get_taxa(access.base_url, access.token, missing))) {
                    this.taxa_cache.set(`${access.instance_id}:${taxon.id}`, taxon);
                }
            } catch (error) {
                console.log(new Date().toISOString(), `Explore: EcoTaxa taxa unavailable on instance ${access.instance_id}`, (error as Error).message);
            }
        }
        return Array.from(taxon_ids).map(id => this.taxa_cache.get(`${access.instance_id}:${id}`)).filter((taxon): taxon is EcoTaxaTaxon => taxon !== undefined);
    }

    async summaryOf(samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>, exclude_not_living: boolean): Promise<ExploreEcoTaxaSummary> {
        const entries = await this.samplesOnInstances(samples, ExploreEcoTaxaService.linksOf(projects));
        const { stats, pending } = await this.statsOfEntries(entries, ECOTAXA_SYNC_REFRESH_LIMIT);
        const taxa_by_instance = new Map<number, { access: InstanceAccess; ids: Set<number> }>();
        for (const entry of entries) {
            const stat = stats.get(entry.sample.sample_id);
            if (!stat) continue;
            let bucket = taxa_by_instance.get(entry.access.instance_id);
            if (!bucket) { bucket = { access: entry.access, ids: new Set() }; taxa_by_instance.set(entry.access.instance_id, bucket); }
            for (const id of stat.used_taxa) bucket.ids.add(id);
        }
        const categories = new Set<string>();
        for (const { access, ids } of taxa_by_instance.values()) {
            for (const taxon of await this.taxaOf(access, ids)) {
                if (exclude_not_living && !taxon.id_lineage.includes(ECOTAXA_BIOTA_TAXO_ID)) continue;
                categories.add(taxon.display_name);
            }
        }
        const stats_list = Array.from(stats.values());
        return {
            categories: Array.from(categories).sort((a, b) => a.localeCompare(b)),
            classification: classificationSharesOf(stats_list),
            objects: objectCountsOf(stats_list),
            nb_samples_with_stats: stats_list.filter(stat => totalOf(stat) > 0).length,
            partial: pending > 0,
            nb_samples_pending: pending,
        };
    }

    /* ─── the daily sweep ─── */

    // Queues every sample imported in EcoTaxa whose stats are older than a day, or absent.
    async sweep(): Promise<number> {
        const now = this.now();
        const samples = (await this.sampleRepository.listEcoTaxaImportedSamples())
            .filter(sample => sample.fetched_utc_date_time === null || now - Date.parse(sample.fetched_utc_date_time) >= ECOTAXA_STATS_STALE_AFTER_MS);
        if (samples.length === 0) return 0;
        const links = new Map<number, EcoTaxaProjectLink>((await this.projectRepository.listProjects()).map(project => [project.project_id, project]));
        const entries = await this.samplesOnInstances(samples, links);
        this.enqueue(entries);
        return entries.length;
    }

    // Starts the sweep: once after a delay, then every day. Timers never keep the process alive.
    startSweeper(): void {
        if (this.sweep_timer) return;
        const run = () => this.sweep()
            .then(count => { if (count > 0) console.log(new Date().toISOString(), `Explore: EcoTaxa stats of ${count} sample(s) queued for refresh`); })
            .catch(error => console.log(new Date().toISOString(), "Explore: EcoTaxa stats sweep failed", error));
        const first = setTimeout(() => {
            run();
            this.sweep_timer = setInterval(run, ECOTAXA_SWEEP_INTERVAL_MS);
            this.sweep_timer.unref();
        }, ECOTAXA_SWEEP_FIRST_DELAY_MS);
        first.unref();
        this.sweep_timer = first;
    }

    stopSweeper(): void {
        if (this.sweep_timer) clearTimeout(this.sweep_timer);
        this.sweep_timer = null;
    }

    /* ─── images ─── */

    private async totalObjectsOf(entry: SampleOnInstance): Promise<number> {
        const key = `${entry.access.instance_id}:${entry.sample.ecotaxa_sample_id}`;
        const cached = this.totals_cache.get(key);
        const now = this.now();
        if (cached && now - cached.at < ECOTAXA_CACHE_TTL_MS) return cached.total;
        const page = await this.throttle.run(() => this.ecotaxaAccountRepository.api_ecotaxa_query_object_set(entry.access.base_url, entry.access.token, entry.ecotaxa_project_id, {
            filters: { samples: String(entry.sample.ecotaxa_sample_id) }, fields: [], window_start: 0, window_size: 1,
        }));
        this.totals_cache.set(key, { at: now, total: page.total_ids });
        return page.total_ids;
    }

    // `count` random objects of random samples, one object per draw; a sample without object is dropped.
    async randomImagesOf(samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>, count: number): Promise<ExploreImage[]> {
        const pool = await this.samplesOnInstances(samples, ExploreEcoTaxaService.linksOf(projects));
        const images: ExploreImage[] = [];
        const seen = new Set<number>();
        let attempts = 0;
        while (images.length < count && pool.length > 0 && attempts < count * 3) {
            attempts++;
            const index = Math.floor(this.random() * pool.length);
            const entry = pool[index];
            try {
                const total = await this.totalObjectsOf(entry);
                if (total === 0) { pool.splice(index, 1); continue; }
                const page = await this.throttle.run(() => this.ecotaxaAccountRepository.api_ecotaxa_query_object_set(entry.access.base_url, entry.access.token, entry.ecotaxa_project_id, {
                    filters: { samples: String(entry.sample.ecotaxa_sample_id) }, fields: IMAGE_FIELDS, window_start: Math.floor(this.random() * total), window_size: 1,
                }));
                const object_id = page.object_ids[0];
                const details = page.details[0] ?? [];
                if (object_id === undefined || seen.has(object_id) || typeof details[0] !== "string") continue;
                seen.add(object_id);
                images.push({
                    object_id,
                    image_url: `${entry.access.base_url}vault/${details[0]}`,
                    sample_name: entry.sample.sample_name,
                    depth: typeof details[1] === "number" ? details[1] : null,
                    date: objectDate(details[2], details[3]),
                });
            } catch (error) {
                console.log(new Date().toISOString(), `Explore: cannot pick an image of sample ${entry.sample.sample_name}`, (error as Error).message);
                pool.splice(index, 1);
            }
        }
        return images;
    }
}

// EcoTaxa gives objdate as "YYYY-MM-DD" and objtime as "HH:MM:SS".
export function objectDate(objdate: unknown, objtime: unknown): string | null {
    if (typeof objdate !== "string" || objdate === "") return null;
    const time = typeof objtime === "string" && objtime !== "" ? objtime : "00:00:00";
    const ms = Date.parse(`${objdate}T${time}Z`);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
