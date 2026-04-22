import swaggerJsdoc from "swagger-jsdoc";
import path from "node:path";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SplitMate API",
      version: "0.1.0",
      description: "API for the SplitMate group expense splitter.",
    },
    servers: [{ url: "/api", description: "Current host" }],
    tags: [{ name: "System", description: "Health and infrastructure" }],
  },
  apis: [path.join(process.cwd(), "src/app/api/**/*.js")],
};

export function getSwaggerSpec() {
  return swaggerJsdoc(options);
}
