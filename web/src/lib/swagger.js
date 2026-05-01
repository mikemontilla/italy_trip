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
      { name: "Expenses", description: "Shared expenses within events" },
      { name: "Movements", description: "Transfers and loans between participants" },
      { name: "Balances", description: "Per-participant balances and breakdown" },
      { name: "Settlements", description: "Suggested transfers to bring all balances to zero" },
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
        Balance: {
          type: "object",
          properties: {
            participant_id: { type: "integer" },
            name:           { type: "string" },
            type:           { type: "string", enum: ["registered", "fictitious"] },
            role:           { type: "string", enum: ["admin", "participant"] },
            paid:           { type: "string", description: "Total paid in COP (DECIMAL serialized as string)" },
            owed:           { type: "string", description: "Total share owed in COP" },
            sent:           { type: "string" },
            received:       { type: "string" },
            balance:        { type: "string", description: "paid − owed + sent − received" },
          },
        },
        BalanceDetail: {
          type: "object",
          properties: {
            participant: {
              type: "object",
              properties: {
                id:   { type: "integer" },
                name: { type: "string" },
                type: { type: "string", enum: ["registered", "fictitious"] },
                role: { type: "string", enum: ["admin", "participant"] },
              },
            },
            totals: {
              type: "object",
              properties: {
                paid:     { type: "string" },
                owed:     { type: "string" },
                sent:     { type: "string" },
                received: { type: "string" },
                balance:  { type: "string" },
              },
            },
            detail: {
              type: "object",
              properties: {
                paid_expenses: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      expense_id:    { type: "integer" },
                      description:   { type: "string" },
                      expense_date:  { type: "string", format: "date" },
                      expense_total: { type: "string" },
                      amount_paid:   { type: "string" },
                    },
                  },
                },
                owed_expenses: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      expense_id:    { type: "integer" },
                      description:   { type: "string" },
                      expense_date:  { type: "string", format: "date" },
                      expense_total: { type: "string" },
                      share:         { type: "string" },
                    },
                  },
                },
                sent_movements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id:               { type: "integer" },
                      type:             { type: "string", enum: ["transfer", "loan"] },
                      amount:           { type: "string" },
                      movement_date:    { type: "string", format: "date" },
                      other_party_name: { type: "string" },
                    },
                  },
                },
                received_movements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id:               { type: "integer" },
                      type:             { type: "string", enum: ["transfer", "loan"] },
                      amount:           { type: "string" },
                      movement_date:    { type: "string", format: "date" },
                      other_party_name: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        SettlementTransfer: {
          type: "object",
          properties: {
            from_participant_id: { type: "integer" },
            from_name:           { type: "string" },
            to_participant_id:   { type: "integer" },
            to_name:             { type: "string" },
            amount:              { type: "string", description: "Amount in COP (DECIMAL serialized as string)" },
          },
        },
        SettlementOption: {
          type: "object",
          properties: {
            transfers: {
              type: "array",
              items: { $ref: "#/components/schemas/SettlementTransfer" },
            },
            stats: {
              type: "object",
              properties: {
                transfer_count:                 { type: "integer" },
                max_transfers_per_participant:  { type: "integer" },
              },
            },
          },
        },
        Settlement: {
          type: "object",
          properties: {
            option1: { $ref: "#/components/schemas/SettlementOption" },
            option2: { $ref: "#/components/schemas/SettlementOption" },
          },
        },
        Movement: {
          type: "object",
          properties: {
            id:            { type: "integer" },
            event_id:      { type: "integer" },
            type:          { type: "string", enum: ["transfer", "loan"] },
            amount:        { type: "string", description: "DECIMAL(12,2) serialized as string" },
            movement_date: { type: "string", format: "date" },
            bank:          { type: "string", nullable: true },
            note:          { type: "string", nullable: true },
            created_by_event_participant_id: { type: "integer" },
            created_at:    { type: "string", format: "date-time" },
            sender: {
              type: "object",
              properties: {
                participant_id: { type: "integer" },
                name:           { type: "string" },
              },
            },
            recipient: {
              type: "object",
              properties: {
                participant_id: { type: "integer" },
                name:           { type: "string" },
              },
            },
            created_by: {
              type: "object",
              description: "Present on detail responses only",
              properties: {
                participant_id: { type: "integer" },
                name:           { type: "string" },
              },
            },
          },
        },
        Expense: {
          type: "object",
          properties: {
            id:                               { type: "integer" },
            event_id:                         { type: "integer" },
            description:                      { type: "string" },
            amount:                           { type: "string", description: "DECIMAL(12,2) serialized as string" },
            expense_date:                     { type: "string", format: "date" },
            created_by_event_participant_id:  { type: "integer" },
            created_at:                       { type: "string", format: "date-time" },
            payers: {
              type: "array",
              description: "Present on detail responses only",
              items: {
                type: "object",
                properties: {
                  id:             { type: "integer" },
                  participant_id: { type: "integer" },
                  name:           { type: "string" },
                  amount:         { type: "string" },
                },
              },
            },
            splits: {
              type: "array",
              description: "Present on detail responses only",
              items: {
                type: "object",
                properties: {
                  id:             { type: "integer" },
                  participant_id: { type: "integer" },
                  name:           { type: "string" },
                },
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
