import express from 'express';
import cookieParser from "cookie-parser";
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './presentation/openapi/swagger-definition';

const server = express();
server.use(express.json());
server.use(express.urlencoded({ extended: false }))
server.use(cookieParser());

// OpenAPI documentation - disable with ENABLE_SWAGGER=false
if (process.env.ENABLE_SWAGGER !== 'false') {
    server.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customSiteTitle: 'EcoPart API Documentation',
    }));
    server.get('/api-docs.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
}

export default server