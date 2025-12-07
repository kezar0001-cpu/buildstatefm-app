const { defineConfig } = require("@prisma/client");

module.exports = defineConfig({
  schema: "./schema.prisma",
  datasource: {
    provider: "postgresql",
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL
  }
});
