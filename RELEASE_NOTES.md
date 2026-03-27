# Release Notes — EcoPart Back

## [Unreleased] — 2025-03-27

### New Features

#### Batch Delete EcoTaxa Samples
- New `DELETE /projects/:id/ecotaxa_samples` endpoint to remove EcoTaxa objects for selected samples without deleting particle data from EcoPart.
- Accepts an array of sample names. 
- Uses the generic EcoTaxa account (per instance) internally for API authentication.
- Validates user permissions (admin or project manager) before proceeding.
- Queries the EcoTaxa API to find matching object IDs, deletes them, and clears the `ecotaxa_sample_imported` flag in the local database.

#### Cascading EcoTaxa Cleanup on Sample Deletion
- `DELETE /projects/:id/samples/:sample_id` now automatically removes associated EcoTaxa objects before deleting the particle sample.
- Validates user permissions (admin or project manager) before proceeding.
- Uses a generic EcoTaxa account (per instance) for API authentication during cleanup.

#### Cascading EcoTaxa Cleanup on Project Deletion
- `DELETE /projects/:id` now cleans up all EcoTaxa samples and deletes the linked EcoTaxa project before removing the EcoPart project.
- Validates user permissions (admin or project manager) before proceeding.
- Full cascade: EcoTaxa objects → particle samples → EcoTaxa project → EcoPart project.

### New EcoTaxa API Integration Methods
- `api_ecotaxa_query_objects_by_sample()` — Query EcoTaxa for object IDs matching sample names.
- `api_ecotaxa_delete_objects()` — Delete objects from an EcoTaxa project.
- `api_delete_ecotaxa_project()` — Delete an entire EcoTaxa project.
- `getEcotaxaGenericAccountForInstance()` — Retrieve the generic EcoTaxa account for a given instance.

### Breaking Changes
- Renamed `DeleteEcoTaxaSampleUseCase` (singular) → `DeleteEcoTaxaSamplesUseCase` (batch).
- Renamed `deleteEcoTaxaSamples()` → `deleteEcoTaxaSamplesFromDb()` in `SampleRepository` interface to clarify it is a DB-only operation.
- `DeleteProject` and `DeleteSample` use cases now require additional dependencies (`SampleRepository`, `EcotaxaAccountRepository`, `ProjectRepository`).

### Dependencies
- Added `@babel/preset-env@^7.29.2`.
- Updated Babel toolchain (`@babel/generator`, `@babel/parser`, `@babel/traverse`, `@babel/types`, `@babel/template`) from 7.22.x to 7.28–7.29.x.
- Updated `browserslist`, `caniuse-lite`, `semver`, and other transitive dependencies.
