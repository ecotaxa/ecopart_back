import express from 'express';
import compression from 'compression';
import cookieParser from "cookie-parser";
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './presentation/openapi/swagger-definition';

const server = express();
// gzip for the clients that accept it. JSON shrinks about 7 times (the QC graphs above all); archives
// (zip, tar.zst) are left as they are, their types not being compressible.
server.use(compression());
// Export requests list their sample ids: a selection of tens of thousands of samples is over the
// 100 KB default. Parsed here first, the body is skipped by the default parser below.
server.use("/exports", express.json({ limit: "5mb" }));
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