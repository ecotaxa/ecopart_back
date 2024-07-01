import * as shell from "shelljs";

// Copy all the html mailer templates
shell.cp("-R", "src/infra/mailer/templates", "lib/infra/mailer/");

// If needed we will copy assets folder

