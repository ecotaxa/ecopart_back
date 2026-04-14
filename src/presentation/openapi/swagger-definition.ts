import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

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
            url: process.env.API_URL,
            description: process.env.NODE_ENV === 'PROD' ? 'Production server' : process.env.NODE_ENV === 'TEST' ? 'Testing server' : 'Development server',
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
                description: 'JWT access token stored in an httpOnly cookie. Obtained via POST /auth/login.',
            },
            cookieRefreshToken: {
                type: 'apiKey',
                in: 'cookie',
                name: 'refresh_token',
                description: 'JWT refresh token stored in an httpOnly cookie. Used to obtain a new access token via POST /auth/refreshToken.',
            },
        },
    },
};

const options: swaggerJsdoc.Options = {
    swaggerDefinition,
    apis: [
        path.join(__dirname, '../routers/*.ts'),
        path.join(__dirname, '../routers/*.js'),
        path.join(__dirname, './schemas/*.yaml'),
    ],
};

export const swaggerSpec = swaggerJsdoc(options);
