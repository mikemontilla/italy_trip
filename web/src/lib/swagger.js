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
    tags: [
      { name: "System", description: "Health and infrastructure" },
      { name: "Events", description: "Group expense events" },
      { name: "Participants", description: "Event participants (registered and fictitious)" },
    ],
    components: {
      schemas: {
        Event: {
          type: "object",
          properties: {
            id:                 { type: "integer" },
            code:               { type: "string", example: "A1B2C3D4" },
            name:               { type: "string" },
            description:        { type: "string", nullable: true },
            photo_path:         { type: "string", nullable: true },
            status:             { type: "string", enum: ["active", "finalized"] },
            created_by_user_id: { type: "integer" },
            created_at:         { type: "string", format: "date-time" },
            finalized_at:       { type: "string", format: "date-time", nullable: true },
          },
        },
        Participant: {
          type: "object",
          properties: {
            id:        { type: "integer" },
            type:      { type: "string", enum: ["registered", "fictitious"] },
            role:      { type: "string", enum: ["admin", "participant"] },
            joined_at: { type: "string", format: "date-time" },
            user: {
              type: "object",
              nullable: true,
              properties: {
                id:         { type: "integer" },
                name:       { type: "string" },
                email:      { type: "string" },
                avatar_url: { type: "string", nullable: true },
              },
            },
            fictitious: {
              type: "object",
              nullable: true,
              properties: {
                id:   { type: "integer" },
                name: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
  apis: [path.join(process.cwd(), "src/app/api/**/*.js")],
};

export function getSwaggerSpec() {
  return swaggerJsdoc(options);
}
