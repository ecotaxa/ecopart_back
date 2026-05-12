import * as shell from "shelljs";

// Copy all the html mailer templates
shell.cp("-R", "src/infra/mailer/templates", "dist/infra/mailer/");

// Copy OpenAPI YAML schema files (not compiled by tsc, must be copied manually)
shell.mkdir("-p", "dist/presentation/openapi/schemas");
shell.cp("-R", "src/presentation/openapi/schemas", "dist/presentation/openapi/");

// Note: Migration .ts files are compiled by tsc to .js in dist/data/migrations/
// No additional copy needed — the migration-manager loads .js files at runtime in production.
