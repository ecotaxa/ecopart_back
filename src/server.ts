import express from 'express';
import cookieParser from "cookie-parser";

const server = express();
server.use(express.json());
server.use(express.urlencoded({ extended: false }))
server.use(cookieParser());

export default server