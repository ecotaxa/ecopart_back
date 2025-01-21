# ecopart_back

[![Tests CI](https://github.com/ecotaxa/ecopart_back/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/ecotaxa/ecopart_back/actions/workflows/main.yml)
[![codecov](https://codecov.io/github/ecotaxa/ecopart_back/graph/badge.svg?token=C0I2UCLP07)](https://codecov.io/github/ecotaxa/ecopart_back)

**Backend of the EcoPart application**

This repository contains the backend codebase for the EcoPart application, built using TypeScript, NodeJS, Express, SQLite, and Jest for testing. The architecture follows a clean structure, and the API is designed based on REST principles.

### Installation

To install the necessary dependencies, run the following command:

```bash
npm install
```

### Running the Backend in Development Mode

To run the backend in development mode with automatic restarts on code changes, use the following command:

```bash
npm run dev:watch
```

### Running Tests and Generating Coverage Report

To execute tests and generate a coverage report, use the following command:

```bash
npm run test
```

### Publishing a New Version of the Application

To publish a new version, create and push a new tag for the application's code. Pushing a tag in the GitHub repository triggers a GitHub Action that builds the Docker image and publishes it on Docker Hub. The Docker image can be found [here](https://hub.docker.com/repository/docker/ecotaxa/ecopart_back/general).

```bash
git tag -a vXX.XX.XX -m "version message"
git push --follow-tags
```


### Production Procedure

To deploy a new version of the application to production, follow these steps:

1. **Prepare the Environment**:
   - Copy the `empty.env` file to your server and rename it to `.env`. Set your environment variables as needed.

2. **Run the Application**:
   - Copy the `docker-compose.yml` file to your server.
   - Run the following command to start the application using Docker Compose:

     ```bash
     docker compose up
     ```

### Glossary

**Clean Architecture** is a software design principle that emphasizes separation of concerns and modularity, aiming to create a flexible and maintainable codebase. It divides the application into layers, such as *presentation*, *domain*, and *data*, ensuring that dependencies flow inward, maintaining a clear boundary between the layers. This approach allows developers to change the implementation details of one layer without affecting the others, promoting code reusability and testability.

**REST API** (Representational State Transfer API) is a set of guidelines and principles for designing web services that communicate over HTTP. It follows a stateless client-server architecture where each resource is uniquely identified by a URL, and standard HTTP methods (GET, POST, PUT, DELETE) are used to perform CRUD (Create, Read, Update, Delete) operations on these resources. REST APIs are designed to be scalable, simple, and easily integrated with various platforms, making them a popular choice for building web services.
