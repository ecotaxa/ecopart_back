import * as shell from "shelljs";

// Copy all the html mailer templates
shell.cp("-R", "src/infra/mailer/templates", "dist/infra/mailer/");

// If needed we will copy assets folder

// Note: Migration .ts files are compiled by tsc to .js in dist/data/migrations/
// No additional copy needed — the migration-manager loads .js files at runtime in production.
