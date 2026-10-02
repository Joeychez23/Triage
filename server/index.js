const path = require("path");
const fs = require("fs");
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const multer = require("multer");
const config = require("./config");
const db = require("./db");
const { JevError, usage: jevUsage } = require("./lib/jev");
const { ApifyError } = require("./lib/apify");
const { SOURCES } = require("./lib/sources");
const { apiLimiter } = require("./middleware/limits");
const { optionalAuth } = require("./middleware/auth");

const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);

const buildDir = path.join(__dirname, "..", "client", "build");
const serveClient = fs.existsSync(buildDir);

app.use(
  helmet({
    // The CSP only matters when this server also hosts the built client.
    contentSecurityPolicy: serveClient
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            workerSrc: ["'self'"],
            manifestSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            // Leave HTTP vs HTTPS to the deployment (nginx, a load balancer);
            // forcing upgrades breaks plain-HTTP hosting.
            upgradeInsecureRequests: null,
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);
app.use(compression());
if (!config.isProduction && process.env.NODE_ENV !== "test") app.use(morgan("dev", { skip: (req) => req.path === "/api/health" }));
app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    db: db.dbStatus(),
    accounts: config.accountsEnabled && db.isConnected(),
    jev: config.jevEnabled,
    search: config.apifyEnabled,
    sources: Object.values(SOURCES).map((s) => ({ id: s.id, label: s.label })),
    maxResultsPerSource: config.maxResultsPerSource,
    jevUsage: { requests: jevUsage.requests, failures: jevUsage.failures },
  });
});

app.use("/api", optionalAuth, apiLimiter);
app.use("/api/auth", require("./routes/auth"));
app.use("/api/profile", require("./routes/profile"));
app.use("/api/searches", require("./routes/searches"));
app.use("/api/saved-searches", require("./routes/saved"));
app.use("/api/jobs", require("./routes/jobs"));
app.use("/api/applications", require("./routes/applications"));
app.use("/api/insights", require("./routes/insights"));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// In production the server also hosts the built React app.
if (serveClient) {
  app.use(
    express.static(buildDir, {
      index: false,
      setHeaders(res, file) {
        // Hashed bundles are immutable; the shell and service worker are not.
        if (/[\\/]static[\\/]/.test(file)) res.set("Cache-Control", "public, max-age=31536000, immutable");
        else res.set("Cache-Control", "no-cache");
      },
    })
  );
  app.get("/{*splat}", (req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(buildDir, "index.html"));
  });
}

// Express 5 forwards rejected promises from async handlers here.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Request body must be valid JSON." });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request is too large." });
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "That file is larger than 5 MB." : "That upload couldn't be processed.";
    return res.status(400).json({ error: msg });
  }
  if (err instanceof JevError) {
    if (err.status === 499) return res.status(499).end();
    console.warn(`Jev error ${err.status}: ${err.message}`);
    return res.status(err.status === 429 ? 429 : err.status === 503 ? 503 : 502).json({ error: err.message });
  }
  if (err instanceof ApifyError) return res.status(err.status || 502).json({ error: err.message });
  if (err.name === "ValidationError" || err.name === "CastError") return res.status(400).json({ error: err.message });
  if (err.status && err.status < 600) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side." });
});

function start() {
  db.connect();
  app.listen(config.port, () => {
    console.log(`Triage API listening on http://localhost:${config.port}`);
  });
}

if (require.main === module) start();

module.exports = app;
