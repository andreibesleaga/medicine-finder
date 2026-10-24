// Railway infrastructure for this repository (replaces railway.json, which Railway stops reading
// on 2026-12-01). Preview changes with `railway config plan`; apply them with `railway config apply`.
// Variables (AI keys, HEALTH_CANADA, RAILWAY_RUN_UID) stay in the Railway dashboard: not managed here.
import { defineRailway, github, project, service, volume } from "railway/iac";

// This repository manages only its own resources in the environment.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "medicine-finder";

export default defineRailway(() => {
  const medicineFinder = service("medicine-finder", {
    source: github("andreibesleaga/medicine-finder", { branch: "main", checkSuites: false }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/api/health",
    healthcheckTimeout: 60,
    replicas: { "europe-west4-drams3a": 1 },
    // restarts on failure (Railway default), at most 5 times
    deploy: { sleepApplication: true, restartPolicyMaxRetries: 5 },
    // the SQLite database (server/db/store.js, DATA_DIR) survives deploys; the image runs as
    // `node`, so the service sets RAILWAY_RUN_UID=0 to write to the root-owned volume
    volumeMounts: {
      "/app/data": volume("medicine-finder-data", { sizeMB: 1024, region: "europe-west4-drams3a" }),
    },
  });

  return project("medicine-finder", {
    variables: { managed: false },
    resources: [medicineFinder],
  });
});
