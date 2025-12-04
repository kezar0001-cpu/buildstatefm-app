const { defineConfig } = require("@prisma/client");

module.exports = defineConfig({
  schema: "./schema.prisma",
  datasource: {
    provider: "postgresql",
    url: process.env.DATABASE_URL
  }
});
