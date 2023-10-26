# ecopart_back

[![Tests CI](https://github.com/ecotaxa/ecopart_back/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/ecotaxa/ecopart_back/actions/workflows/main.yml)

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

### Building and Serving the Application

To build the application and serve it, use the following commands:

```bash
npm run dev:build
npm run dev:serve
```
### Glossary
**Clean Architecture** is a software design principle that emphasizes separation of concerns and modularity, aiming to create a flexible and maintainable codebase. It divides the application into layers, such as *presentation*, *domain*, and *data*, ensuring that dependencies flow inward, maintaining a clear boundary between the layers. This approach allows developers to change the implementation details of one layer without affecting the others, promoting code reusability and testability.


**REST API** (Representational State Transfer API) is a set of guidelines and principles for designing web services that communicate over HTTP. It follows a stateless client-server architecture where each resource is uniquely identified by a URL, and standard HTTP methods (GET, POST, PUT, DELETE) are used to perform CRUD (Create, Read, Update, Delete) operations on these resources. REST APIs are designed to be scalable, simple, and easily integrated with various platforms, making them a popular choice for building web services.
