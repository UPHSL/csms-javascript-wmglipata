import { dashboardRoutes } from './routes/dashboardRoutes.js';
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { notFound } from "./middleware/notFound.js";
import mainRoutes from "./routes/index.js";
import { serviceRequestRoutes } from './routes/serviceRequestRoutes.js';
import residentRoutes from "./routes/residentRoutes.js"; // <-- Add this import here

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

/**
 * Create and configure the CSMS Express application.
 *
 * @returns {import("express").Express} Configured Express application.
 */
export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.set("views", path.join(currentDirectory, "views"));
  app.set("view engine", "ejs");

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(currentDirectory, "..", "public")));

  app.use(mainRoutes);

  app.use('/service-requests', serviceRequestRoutes);
  
  app.use('/dashboard', dashboardRoutes);
  
  app.use('/residents', residentRoutes); // <-- Move this BEFORE notFound

  app.use(notFound);

  // Global error handler — must be 4-argument to be recognized by Express as an error handler.
  // Catches any synchronous throw or next(err) that escapes a route handler.
  // Does NOT expose stack traces or internal error messages to the client.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('An unexpected error occurred.');
  });

  return app;
}