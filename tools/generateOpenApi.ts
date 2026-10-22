import path from 'path';
import fs from 'fs';
// The definition the API serves at /api-docs. This script used to hold its own copy, which had drifted
// from it (different tags and descriptions), so openapi.json and /api-docs disagreed.
import { swaggerSpec } from '../src/presentation/openapi/swagger-definition';

const outputPath = path.join(__dirname, '../openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2), 'utf-8');
console.log(`OpenAPI spec generated at: ${outputPath}`);
