import { ECOTAXA_BIOTA_TAXO_ID } from "../../constants/ecotaxa-living-taxo";
import { EcoTaxaTaxon } from "../../entities/ecotaxa_account";
import { ClassificationShares, ExploreClassificationState, ExploreEcoTaxaSummary, ExploreFilters, ExploreImage, ExploreSampleRow } from "../../entities/explore";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { ExploreProjectContext } from "./explore-selection";

/* What the Explore page asks EcoTaxa: the classification counts of the samples (stats), the names of
 * the taxa they use, and a few random object images. Every call goes through the generic account of
 * the instance. Results are cached in memory for a while: exploring is iterative, the same samples
 * come back request after request. */

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
    sample: ExploreSampleRow;
    ecotaxa_project_id: number;
    access: InstanceAccess;
}

export const ECOTAXA_STATS_TTL_MS = 10 * 60 * 1000;
export const ECOTAXA_STATS_BATCH = 200;
export const EXPLORE_IMAGES_DEFAULT = 4;
export const EXPLORE_IMAGES_MAX = 12;
// Objects fetched from EcoTaxa in one window, from which the random images are drawn.
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

export class ExploreEcoTaxaService {
    private readonly stats_cache = new Map<string, { at: number; stat: EcoTaxaSampleStat }>();
    private readonly taxa_cache = new Map<string, EcoTaxaTaxon>();
    private readonly totals_cache = new Map<string, { at: number; total: number }>();
    private readonly access_cache = new Map<number, { at: number; access: InstanceAccess | null }>();
    // EcoTaxa projects whose sample names were looked up: a name EcoTaxa does not know is not asked again for a while.
    private readonly resolved_projects = new Map<number, number>();

    constructor(
        private readonly ecotaxaAccountRepository: EcotaxaAccountRepository,
        private readonly sampleRepository: SampleRepository,
        private readonly now: () => number = () => Date.now(),
        private readonly random: () => number = Math.random,
    ) { }

    // The samples imported in EcoTaxa, with the access to their instance; the ids EcoPart never
    // stored (samples imported through EcoPart, which only the migration path numbered) are resolved
    // from the EcoTaxa project and written back, once.
    private async samplesOnInstances(samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>): Promise<SampleOnInstance[]> {
        const now = this.now();
        const accessOf = async (instance_id: number): Promise<InstanceAccess | null> => {
            const cached = this.access_cache.get(instance_id);
            if (cached && now - cached.at < ECOTAXA_STATS_TTL_MS) return cached.access;
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
        };

        const result: SampleOnInstance[] = [];
        const unresolved = new Map<number, SampleOnInstance[]>();
        for (const sample of samples) {
            if (!sample.ecotaxa_sample_imported) continue;
            const project = projects.get(sample.project_id)?.project;
            if (!project || project.ecotaxa_project_id === null || project.ecotaxa_instance_id === null) continue;
            const access = await accessOf(project.ecotaxa_instance_id);
            if (!access) continue;
            const entry = { sample, ecotaxa_project_id: project.ecotaxa_project_id, access };
            if (sample.ecotaxa_sample_id !== null) result.push(entry);
            else {
                const list = unresolved.get(project.project_id) ?? [];
                list.push(entry);
                unresolved.set(project.project_id, list);
            }
        }
        for (const entries of unresolved.values()) {
            const { access, ecotaxa_project_id } = entries[0];
            const looked_up = this.resolved_projects.get(ecotaxa_project_id);
            if (looked_up !== undefined && now - looked_up < ECOTAXA_STATS_TTL_MS) continue;
            this.resolved_projects.set(ecotaxa_project_id, now);
            try {
                const by_name = new Map((await this.ecotaxaAccountRepository.api_ecotaxa_get_samples_in_project(access.base_url, access.token, ecotaxa_project_id)).map(s => [s.orig_id, s.sampleid]));
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

    // The EcoTaxa stats of the samples, by sample id; samples whose instance does not answer are absent.
    async statsOf(samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>): Promise<Map<number, EcoTaxaSampleStat>> {
        return this.statsOfEntries(await this.samplesOnInstances(samples, projects));
    }

    private async statsOfEntries(entries: SampleOnInstance[]): Promise<Map<number, EcoTaxaSampleStat>> {
        const stats = new Map<number, EcoTaxaSampleStat>();
        const to_fetch = new Map<number, SampleOnInstance[]>();
        const now = this.now();
        for (const entry of entries) {
            const cached = this.stats_cache.get(`${entry.access.instance_id}:${entry.sample.ecotaxa_sample_id}`);
            if (cached && now - cached.at < ECOTAXA_STATS_TTL_MS) {
                stats.set(entry.sample.sample_id, cached.stat);
                continue;
            }
            const list = to_fetch.get(entry.access.instance_id) ?? [];
            list.push(entry);
            to_fetch.set(entry.access.instance_id, list);
        }
        for (const list of to_fetch.values()) {
            const access = list[0].access;
            const by_ecotaxa_id = new Map(list.map(entry => [entry.sample.ecotaxa_sample_id as number, entry.sample]));
            for (let i = 0; i < list.length; i += ECOTAXA_STATS_BATCH) {
                const batch = list.slice(i, i + ECOTAXA_STATS_BATCH).map(entry => entry.sample.ecotaxa_sample_id as number);
                try {
                    for (const row of await this.ecotaxaAccountRepository.api_ecotaxa_get_sample_stats(access.base_url, access.token, batch)) {
                        const sample = by_ecotaxa_id.get(row.sample_id);
                        if (!sample) continue;
                        const stat: EcoTaxaSampleStat = { ecotaxa_sample_id: row.sample_id, used_taxa: row.used_taxa ?? [], nb_unclassified: row.nb_unclassified, nb_validated: row.nb_validated, nb_dubious: row.nb_dubious, nb_predicted: row.nb_predicted };
                        this.stats_cache.set(`${access.instance_id}:${row.sample_id}`, { at: now, stat });
                        stats.set(sample.sample_id, stat);
                    }
                } catch (error) {
                    console.log(new Date().toISOString(), `Explore: EcoTaxa sample stats unavailable on instance ${access.instance_id}`, (error as Error).message);
                }
            }
        }
        return stats;
    }

    // The samples whose classification state is the asked one; samples without EcoTaxa stats are left out.
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
                for (const taxon of await this.ecotaxaAccountRepository.api_ecotaxa_get_taxa(access.base_url, access.token, missing)) {
                    this.taxa_cache.set(`${access.instance_id}:${taxon.id}`, taxon);
                }
            } catch (error) {
                console.log(new Date().toISOString(), `Explore: EcoTaxa taxa unavailable on instance ${access.instance_id}`, (error as Error).message);
            }
        }
        return Array.from(taxon_ids).map(id => this.taxa_cache.get(`${access.instance_id}:${id}`)).filter((taxon): taxon is EcoTaxaTaxon => taxon !== undefined);
    }

    async summaryOf(samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>, exclude_not_living: boolean): Promise<ExploreEcoTaxaSummary> {
        const entries = await this.samplesOnInstances(samples, projects);
        const stats = await this.statsOfEntries(entries);
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
            nb_samples_with_stats: stats_list.filter(stat => totalOf(stat) > 0).length,
        };
    }

    private async totalObjectsOf(entry: SampleOnInstance): Promise<number> {
        const key = `${entry.access.instance_id}:${entry.sample.ecotaxa_sample_id}`;
        const cached = this.totals_cache.get(key);
        const now = this.now();
        if (cached && now - cached.at < ECOTAXA_STATS_TTL_MS) return cached.total;
        const page = await this.ecotaxaAccountRepository.api_ecotaxa_query_object_set(entry.access.base_url, entry.access.token, entry.ecotaxa_project_id, {
            filters: { samples: String(entry.sample.ecotaxa_sample_id) }, fields: [], window_start: 0, window_size: 1,
        });
        this.totals_cache.set(key, { at: now, total: page.total_ids });
        return page.total_ids;
    }

    // `count` random objects of random samples, one object per draw; a sample without object is dropped.
    async randomImagesOf(samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>, count: number): Promise<ExploreImage[]> {
        const pool = await this.samplesOnInstances(samples, projects);
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
                const page = await this.ecotaxaAccountRepository.api_ecotaxa_query_object_set(entry.access.base_url, entry.access.token, entry.ecotaxa_project_id, {
                    filters: { samples: String(entry.sample.ecotaxa_sample_id) }, fields: IMAGE_FIELDS, window_start: Math.floor(this.random() * total), window_size: 1,
                });
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
