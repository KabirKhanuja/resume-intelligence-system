import express from "express";

import { registerResumeRoutes } from "./routes/resume.js";
import { registerStudentRoutes } from "./routes/student.js";
import { registerTpoRoutes } from "./routes/tpo.js";

export function createApp(): express.Express {
  const app = express();

  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - startedAt;
      console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
    });
    next();
  });

  app.use(express.json());

  const rootRouter = express.Router();
  registerResumeRoutes(rootRouter);
  registerStudentRoutes(rootRouter);
  registerTpoRoutes(rootRouter);
  app.use(rootRouter);

  const v1Router = express.Router();
  registerResumeRoutes(v1Router);
  registerStudentRoutes(v1Router);
  registerTpoRoutes(v1Router);
  app.use("/api/v1", v1Router);

  return app;
}
