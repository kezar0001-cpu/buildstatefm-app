const { defineConfig } = require("prisma");
module.exports = defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    provider: "postgresql",
    url: process.env.DATABASE_URL
  }
});
