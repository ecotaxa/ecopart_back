# TODO

Known gaps, not scheduled yet. Remove an item once it is done.

## EcoTaxa interactions: robustness

Review of 23 Oct 2026, after the Explore branch. The Explore reads are protected (stats kept in `sample_ecotaxa_stats` and refreshed at most once a day, at most 2 EcoTaxa calls in flight, batches of 50, partial answers, see `src/domain/use-cases/explore/explore-ecotaxa.ts`). The points below concern every EcoTaxa interaction and existed before.

1. **Generic account: single point of failure, not monitored.** Every import, read, export and deletion uses the generic EcoTaxa account of the instance. Its expiry check is commented out (`getEcotaxaGenericAccountForInstance`, `src/domain/repositories/ecotaxa_account-repository.ts`), nothing renews its token and nothing warns when it dies: imports then fail with an EcoTaxa error, the Explore EcoTaxa figures stay empty and the deletions skip EcoTaxa silently. To do: a periodic check (`api/users/me` per instance) with its status in the admin pages and an alert, and a written renewal procedure.
2. **No reconciliation between the two applications.**
   - Deleting an EcoPart project or sample ignores an EcoTaxa failure (`delete-project.ts`, `delete-sample.ts`): the objects stay orphaned in EcoTaxa. The failure should be reported on the task or to the user.
   - Objects deleted in EcoTaxa leave the sample marked as imported in EcoPart.
   - An EcoTaxa import interrupted by an EcoPart restart lets the EcoTaxa job finish without the sample being marked imported; relaunching uploads the same files again.
   - To do: have the daily Explore sweep also detect samples that no longer exist in EcoTaxa, and record the EcoTaxa job id of an import so that a recovered task can check its outcome.
3. **Import files never cleaned up on the EcoTaxa side.** Each import uploads the whole archive (TSV and images) into the generic account's file space (`from_EcoPart/<project_id>`, `importEcoTaxaSamplesInEcoTaxa`) and never removes it, which fills the EcoTaxa disk over time. To do: delete the uploaded files once the import job has ended.
4. **No per-client limit on the open Explore routes.** `/explore/ecotaxa` and `/explore/images` are served to anonymous users. The shared throttle protects EcoTaxa, but a client looping on them keeps its two slots busy and slows the EcoTaxa part of Explore for everyone. To do: a rate limit per address or session on these routes (see the rate limits in `src/main.ts`).

Structural, to keep in mind (not fixable in EcoPart alone):
- The generic account is manager of every linked EcoTaxa project: a compromised EcoPart server would have that right everywhere. EcoTaxa has no read-only service role for this case.
- Legacy samples are matched to EcoTaxa samples by name (`orig_id`, migration of EcoTaxa projects and id resolution): a name that differs between the two applications breaks the link.

## Explore

- EcoTaxa concentrations graph (per taxon and depth bin): the dataset is served empty. Needs the object depths from EcoTaxa and the water volume per bin from the pivot.
- Access request endpoint: the front opens a `mailto:` to the managers for now.
- "Export selection" button of the exportable tab: not wired to the export routes yet.
- Renaming / grouping of EcoTaxa categories (modal of the mockups).
- Samples imported before the ISO conversion keep their UVP date formats (`20120520080213`, `20230406-144332-820`). Explore reads them (`EXPLORE_SAMPLING_TIME` in `sqlite-sample-data-source.ts`), but the oldest-sample date of the privacy delays ignores them (`OLDEST_SAMPLE_UTC_DATE_TIME_SQL`), so a project with only such samples stays private. A migration converting them to ISO would align both.
