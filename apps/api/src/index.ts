import express from "express";
import multer from "multer";

import { buildResumeSchema, scoreResume } from "resume-core";
import { compareToCohort } from "resume-core";
import { matchJDToResumes } from "resume-core";

const app = express();
const upload = multer();
app.use(express.json());

// in memory store 
const resumes: any[] = [];

app.post("/resume/parse", upload.single("resume"), async (req, res) => {
  const resumeText = req.body.text;

  if (!resumeText) {
    return res.status(400).json({ error: "resume text required" });
  }

  const schema = buildResumeSchema(resumeText, req.body.meta);
  resumes.push(schema);

  res.json(schema);
});

app.post("/student/score", (req, res) => {
  const { resumeId } = req.body;

  const resume = resumes.find(r => r.meta.resumeId === resumeId);
  if (!resume) return res.status(404).json({ error: "not found" });

  const score = scoreResume(resume);
  res.json(score);
});

app.post("/student/compare", (req, res) => {
  const { resumeId } = req.body;

  const student = resumes.find(r => r.meta.resumeId === resumeId);
  if (!student) return res.status(404).json({ error: "not found" });

  const cohort = resumes.filter(
    r => r.meta.batch === student.meta.batch
  );

  const comparison = compareToCohort(student, cohort);
  res.json(comparison);
});

app.post("/tpo/shortlist", async (req, res) => {
  const { jdText, topN = 10 } = req.body;

  if (!jdText) {
    return res.status(400).json({ error: "JD text required" });
  }

  const results = await matchJDToResumes(jdText, resumes, topN);
  res.json(results);
});

app.listen(4000, () => {
  console.log("API running on http://localhost:4000");
});