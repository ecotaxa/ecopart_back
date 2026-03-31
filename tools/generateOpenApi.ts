import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import fs from 'fs';

const swaggerDefinition: swaggerJsdoc.SwaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'EcoPart API',
        version: '1.0.0',
        description: 'EcoPart backend API for managing oceanographic particle data, projects, samples, tasks, and user accounts.',
        license: {
            name: 'LGPL-3.0-only',
            url: 'https://www.gnu.org/licenses/lgpl-3.0.html',
        },
    },
    servers: [
        {
            url: process.env.API_URL || 'http://localhost:4000',
            description: 'API server',
        },
    ],
    tags: [
        { name: 'Auth', description: 'Authentication and password management' },
        { name: 'Users', description: 'User account management' },
        { name: 'Projects', description: 'Project management' },
        { name: 'Samples', description: 'Sample data within projects' },
        { name: 'EcoTaxa Samples', description: 'EcoTaxa sample management within projects' },
        { name: 'Tasks', description: 'Background task management' },
        { name: 'Instrument Models', description: 'Instrument model reference data' },
        { name: 'EcoTaxa Instances', description: 'EcoTaxa instance management' },
    ],
    components: {
        securitySchemes: {
            cookieAccessToken: {
                type: 'apiKey',
                in: 'cookie',
                name: 'access_token',
                description: 'JWT access token stored in an httpOnly cookie.',
            },
            cookieRefreshToken: {
                type: 'apiKey',
                in: 'cookie',
                name: 'refresh_token',
                description: 'JWT refresh token stored in an httpOnly cookie.',
            },
        },
    },
};

const options: swaggerJsdoc.Options = {
    swaggerDefinition,
    apis: [
        path.join(__dirname, '../src/presentation/routers/*.ts'),
        path.join(__dirname, '../src/presentation/routers/*.js'),
        path.join(__dirname, '../src/presentation/openapi/schemas/*.yaml'),
    ],
};

const spec = swaggerJsdoc(options);

const outputPath = path.join(__dirname, '../openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf-8');
console.log(`OpenAPI spec generated at: ${outputPath}`);
