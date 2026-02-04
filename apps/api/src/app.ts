import express from "express";

import { registerResumeRoutes } from "./routes/resume.js";
import { registerStudentRoutes } from "./routes/student.js";
import { registerTpoRoutes } from "./routes/tpo.js";

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  registerResumeRoutes(app);
  registerStudentRoutes(app);
  registerTpoRoutes(app);

  return app;
}
