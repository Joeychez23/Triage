// Skill lexicon for tagging jobs, suggesting profile skills from a resume, and
// computing "keywords you're missing". Exact matching is a job for code;
// semantic questions (does the candidate actually meet a requirement?) go to Jev.
//
// Each entry is [canonical name, optional RegExp]. Without a RegExp the name
// is matched case-insensitively on word boundaries. Ambiguous words (Go, R,
// Swift, Rust, Spring, Excel...) use case-sensitive patterns.

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const RAW = [
  // Languages
  ["JavaScript", /\b(?:JavaScript|JS|ES6\+?|ECMAScript)\b/i],
  ["TypeScript", /\bTypeScript\b|\bTS\b(?=[,/)])/],
  ["Python", /\bPython\b/i],
  ["Java", /\bJava\b(?!\s*Script)/],
  ["C++", /(?<![\w])C\+\+(?![\w])/],
  ["C#", /(?<![\w])C#(?![\w])/],
  ["Go", /\bGolang\b|(?<=[,/(]\s?|\bin\s|\bwith\s)Go\b|\bGo\b(?=\s*[,/)]|\s+(?:and|or)\s+[A-Z])/],
  ["Rust", /\bRust\b/],
  ["Ruby", /\bRuby\b/],
  ["PHP", /\bPHP\b/i],
  ["Swift", /\bSwift\b(?!UI)/],
  ["Kotlin", /\bKotlin\b/i],
  ["Scala", /\bScala\b/],
  ["R", /(?<=[,/(]\s?|\bin\s|\bwith\s)R\b(?![&'’-])|\bR\b(?=\s*[,/)]|\s+(?:and|or)\s+[A-Z])|\bRStudio\b/],
  ["MATLAB", /\bMATLAB\b/i],
  ["Perl", /\bPerl\b/],
  ["Elixir", /\bElixir\b/],
  ["Haskell", /\bHaskell\b/],
  ["Dart", /\bDart\b/],
  ["Bash", /\bBash\b|\bshell script(?:ing|s)?\b/i],
  ["PowerShell", /\bPowerShell\b/i],
  ["SQL", /(?<![A-Za-z])SQL\b/],
  ["Solidity", /\bSolidity\b/],
  ["Objective-C", /\bObjective-?C\b/i],
  ["VBA", /\bVBA\b/],
  // Frontend
  ["React", /\bReact(?:\.js|JS)?\b(?!\s*Native)/],
  ["React Native", /\bReact\s*Native\b/i],
  ["Next.js", /\bNext\.?js\b/i],
  ["Vue", /\bVue(?:\.js|JS)?\b/i],
  ["Nuxt", /\bNuxt(?:\.js)?\b/i],
  ["Angular", /\bAngular(?:JS)?\b/i],
  ["Svelte", /\bSvelte(?:Kit)?\b/i],
  ["Redux", /\bRedux\b/i],
  ["HTML", /\bHTML5?\b/i],
  ["CSS", /\bCSS3?\b/i],
  ["Sass", /\b(?:Sass|SCSS)\b/i],
  ["Tailwind CSS", /\bTailwind(?:\s*CSS)?\b/i],
  ["jQuery", /\bjQuery\b/i],
  ["Webpack", /\bWebpack\b/i],
  ["Vite", /\bVite\b/],
  ["GraphQL", /\bGraphQL\b/i],
  ["Storybook", /\bStorybook\b/i],
  ["Accessibility", /\b(?:accessibility|a11y|WCAG)\b/i],
  ["D3.js", /\bD3(?:\.js)?\b/],
  ["Three.js", /\bThree\.js\b/i],
  // Backend
  ["Node.js", /\bNode(?:\.js|JS)?\b(?![-\s]*(?:red|s\b))/],
  ["Express.js", /\bExpress(?:\.js|JS)\b|\bNode(?:\.js)?\s*\/\s*Express\b/i],
  ["NestJS", /\bNest\.?JS\b/i],
  ["Django", /\bDjango\b/i],
  ["Flask", /\bFlask\b/],
  ["FastAPI", /\bFastAPI\b/i],
  ["Spring Boot", /\bSpring(?:\s*Boot)?\b(?=[\s,/)]|$)(?!\s+(?:semester|break|term|internship))/],
  ["Ruby on Rails", /\b(?:Ruby on )?Rails\b/],
  ["Laravel", /\bLaravel\b/i],
  [".NET", /(?<![\w])(?:ASP)?\.NET(?:\s*Core)?\b/i],
  ["REST APIs", /\bREST(?:ful)?\b/],
  ["gRPC", /\bgRPC\b/i],
  ["Microservices", /\bmicro-?services?\b/i],
  ["Kafka", /\bKafka\b/i],
  ["RabbitMQ", /\bRabbitMQ\b/i],
  ["Redis", /\bRedis\b/i],
  ["Elasticsearch", /\bElastic\s?search\b|\bELK\b/i],
  ["WebSockets", /\bWeb\s?Sockets?\b/i],
  ["OAuth", /\bOAuth\s?2?(?:\.0)?\b|\bOIDC\b|\bSSO\b/],
  // Data & ML
  ["PostgreSQL", /\bPostgre(?:SQL|s)\b/i],
  ["MySQL", /\bMySQL\b/i],
  ["MongoDB", /\bMongo(?:DB)?\b/i],
  ["SQL Server", /\b(?:MS\s?)?SQL Server\b|\bT-SQL\b/i],
  ["Oracle Database", /\bOracle\s*(?:DB|database|SQL|PL\/SQL)\b|\bPL\/SQL\b/i],
  ["DynamoDB", /\bDynamo\s?DB\b/i],
  ["Cassandra", /\bCassandra\b/],
  ["Snowflake", /\bSnowflake\b/],
  ["BigQuery", /\bBig\s?Query\b/i],
  ["Redshift", /\bRedshift\b/i],
  ["Databricks", /\bDatabricks\b/i],
  ["Spark", /\b(?:Apache\s+|Py)?Spark\b/],
  ["Hadoop", /\bHadoop\b/i],
  ["Airflow", /\bAirflow\b/i],
  ["dbt", /\bdbt\b/],
  ["ETL", /\bETL\b|\bELT\b/],
  ["Pandas", /\bPandas\b/i],
  ["NumPy", /\bNumPy\b/i],
  ["scikit-learn", /\bscikit-?learn\b|\bsklearn\b/i],
  ["TensorFlow", /\bTensor\s?Flow\b/i],
  ["PyTorch", /\bPy\s?Torch\b/i],
  ["Machine Learning", /\bmachine learning\b|\bML\b(?!\s*(?:Kit))/i],
  ["Deep Learning", /\bdeep learning\b|\bneural networks?\b/i],
  ["NLP", /\bNLP\b|\bnatural language processing\b/i],
  ["Computer Vision", /\bcomputer vision\b|\bOpenCV\b/i],
  ["LLMs", /\bLLMs?\b|\blarge language models?\b/i],
  ["Generative AI", /\bgen(?:erative)?\s?AI\b|\bGenAI\b/i],
  ["Prompt Engineering", /\bprompt engineering\b/i],
  ["Statistics", /\bstatistic(?:s|al (?:analysis|modeling))\b/i],
  ["Data Analysis", /\bdata analy(?:sis|tics)\b/i],
  ["Data Visualization", /\bdata visuali[sz]ation\b/i],
  ["Tableau", /\bTableau\b/i],
  ["Power BI", /\bPower\s?BI\b/i],
  ["Looker", /\bLooker\b/],
  ["Excel", /\bExcel\b/],
  ["A/B Testing", /\bA\/B test(?:s|ing)?\b|\bexperimentation\b/i],
  // Cloud & DevOps
  ["AWS", /\bAWS\b|\bAmazon Web Services\b/],
  ["Azure", /\bAzure\b/i],
  ["GCP", /\bGCP\b|\bGoogle Cloud(?: Platform)?\b/],
  ["Docker", /\bDocker\b/i],
  ["Kubernetes", /\bKubernetes\b|\bK8s\b|\bEKS\b|\bGKE\b|\bAKS\b/i],
  ["Terraform", /\bTerraform\b/i],
  ["Ansible", /\bAnsible\b/i],
  ["Jenkins", /\bJenkins\b/i],
  ["GitHub Actions", /\bGitHub Actions\b/i],
  ["GitLab CI", /\bGitLab(?:\s*CI)?\b/i],
  ["CI/CD", /\bCI\s*\/\s*CD\b|\bcontinuous (?:integration|delivery|deployment)\b/i],
  ["Linux", /\bLinux\b|\bUnix\b/i],
  ["Git", /\bGit\b(?!Hub|Lab)/],
  ["Serverless", /\bserverless\b|\bAWS Lambda\b|\bLambda functions?\b/i],
  ["Prometheus", /\bPrometheus\b/],
  ["Grafana", /\bGrafana\b/i],
  ["Datadog", /\bDatadog\b/i],
  ["Nginx", /\bNginx\b/i],
  ["Observability", /\bobservability\b|\bOpenTelemetry\b/i],
  ["SRE", /\bSRE\b|\bsite reliability\b/i],
  ["Cybersecurity", /\bcyber\s?security\b|\binformation security\b|\bInfoSec\b/i],
  ["Penetration Testing", /\bpen(?:etration)?\s?test(?:ing)?\b/i],
  ["SIEM", /\bSIEM\b|\bSplunk\b/],
  ["IAM", /\bIAM\b|\bidentity and access management\b/i],
  // Mobile
  ["iOS", /\biOS\b/],
  ["Android", /\bAndroid\b/i],
  ["SwiftUI", /\bSwiftUI\b/i],
  ["Flutter", /\bFlutter\b/i],
  // Testing
  ["Jest", /\bJest\b/],
  ["Cypress", /\bCypress\b/],
  ["Playwright", /\bPlaywright\b/i],
  ["Selenium", /\bSelenium\b/i],
  ["Unit Testing", /\bunit test(?:s|ing)?\b/i],
  ["TDD", /\bTDD\b|\btest[- ]driven\b/i],
  ["QA", /\bQA\b|\bquality assurance\b/],
  // Design & product
  ["Figma", /\bFigma\b/i],
  ["Sketch", /\bSketch\b(?=\s*[,/)]|\s+(?:and|or)\s)/],
  ["Photoshop", /\bPhotoshop\b/i],
  ["Illustrator", /\bIllustrator\b/],
  ["Adobe Creative Suite", /\bAdobe Creative (?:Suite|Cloud)\b/i],
  ["UX Research", /\bUX research\b|\buser research\b|\busability testing\b/i],
  ["UI/UX Design", /\bUI\s?\/\s?UX\b|\bUX\s?\/\s?UI\b|\b(?:UI|UX|interaction|product) design\b/i],
  ["Prototyping", /\bprototyp(?:e|es|ing)\b/i],
  ["Product Management", /\bproduct management\b|\bproduct roadmap\b/i],
  ["Agile", /\bAgile\b/i],
  ["Scrum", /\bScrum\b/i],
  ["Jira", /\bJira\b/i],
  ["Confluence", /\bConfluence\b/],
  // Business & operations
  ["Salesforce", /\bSalesforce\b|\bSFDC\b/i],
  ["HubSpot", /\bHubSpot\b/i],
  ["CRM", /\bCRM\b/],
  ["SEO", /\bSEO\b|\bsearch engine optimi[sz]ation\b/i],
  ["Google Analytics", /\bGoogle Analytics\b|\bGA4\b/i],
  ["Content Marketing", /\bcontent marketing\b|\bcontent strategy\b/i],
  ["Social Media", /\bsocial media\b/i],
  ["Copywriting", /\bcopywriting\b/i],
  ["Project Management", /\bproject management\b|\bPMP\b/i],
  ["Stakeholder Management", /\bstakeholder (?:management|communication)\b/i],
  ["Customer Service", /\bcustomer (?:service|support)\b/i],
  ["Financial Modeling", /\bfinancial model(?:ing|ling|s)?\b/i],
  ["Accounting", /\baccounting\b|\bGAAP\b|\bCPA\b/],
  ["QuickBooks", /\bQuickBooks\b/i],
  ["SAP", /\bSAP\b/],
  ["Six Sigma", /\b(?:Lean )?Six Sigma\b/i],
  ["Spanish", /\bSpanish\b/],
  // Healthcare, engineering, trades
  ["EHR/EMR", /\bEHR\b|\bEMR\b|\bEpic Systems?\b/],
  ["HIPAA", /\bHIPAA\b/],
  ["CPR/BLS", /\bCPR\b|\bBLS\b/],
  ["AutoCAD", /\bAutoCAD\b/i],
  ["SolidWorks", /\bSolid\s?Works\b/i],
  ["PLC", /\bPLCs?\b/],
  ["OSHA", /\bOSHA\b/],
  ["Forklift", /\bforklift\b/i],
];

const LEXICON = RAW.map(([name, re]) => ({
  name,
  re: new RegExp((re || new RegExp(`\\b${esc(name)}\\b`, "i")).source, (re ? re.flags : "i").replace("g", "") + "g"),
}));

const CANONICAL = new Map(LEXICON.map((s) => [s.name.toLowerCase(), s.name]));
// Case-insensitive twins of each pattern, used only to canonicalize short
// user-typed skill names ("reactjs", "golang").
const LOOSE = LEXICON.map((s) => ({ name: s.name, re: new RegExp(s.re.source, "i") }));

// Returns canonical skill names in order of first appearance.
function extractSkills(text, { max = 40 } = {}) {
  const source = String(text || "");
  if (!source) return [];
  const hits = [];
  for (const skill of LEXICON) {
    skill.re.lastIndex = 0;
    const m = skill.re.exec(source);
    if (m) hits.push({ name: skill.name, at: m.index });
  }
  hits.sort((a, b) => a.at - b.at);
  return hits.slice(0, max).map((h) => h.name);
}

// Maps a user's free-typed skill ("reactjs", "postgres") onto the lexicon
// name when one matches, so comparisons line up.
function canonicalSkill(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  const direct = CANONICAL.get(s.toLowerCase());
  if (direct) return direct;
  for (const { name, re } of LOOSE) {
    const m = re.exec(s);
    // Only when the pattern covers (nearly) the whole input.
    if (m && m[0].length >= s.length - 2) return name;
  }
  return s;
}

module.exports = { extractSkills, canonicalSkill, SKILL_NAMES: LEXICON.map((s) => s.name) };
