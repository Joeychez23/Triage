// Skill names from the server's lexicon (server/lib/skills.js), used for
// autocomplete, plus common aliases so "reactjs" and "React" compare equal.
export const SKILL_NAMES = ["JavaScript","TypeScript","Python","Java","C++","C#","Go","Rust","Ruby","PHP","Swift","Kotlin","Scala","R","MATLAB","Perl","Elixir","Haskell","Dart","Bash","PowerShell","SQL","Solidity","Objective-C","VBA","React","React Native","Next.js","Vue","Nuxt","Angular","Svelte","Redux","HTML","CSS","Sass","Tailwind CSS","jQuery","Webpack","Vite","GraphQL","Storybook","Accessibility","D3.js","Three.js","Node.js","Express.js","NestJS","Django","Flask","FastAPI","Spring Boot","Ruby on Rails","Laravel",".NET","REST APIs","gRPC","Microservices","Kafka","RabbitMQ","Redis","Elasticsearch","WebSockets","OAuth","PostgreSQL","MySQL","MongoDB","SQL Server","Oracle Database","DynamoDB","Cassandra","Snowflake","BigQuery","Redshift","Databricks","Spark","Hadoop","Airflow","dbt","ETL","Pandas","NumPy","scikit-learn","TensorFlow","PyTorch","Machine Learning","Deep Learning","NLP","Computer Vision","LLMs","Generative AI","Prompt Engineering","Statistics","Data Analysis","Data Visualization","Tableau","Power BI","Looker","Excel","A/B Testing","AWS","Azure","GCP","Docker","Kubernetes","Terraform","Ansible","Jenkins","GitHub Actions","GitLab CI","CI/CD","Linux","Git","Serverless","Prometheus","Grafana","Datadog","Nginx","Observability","SRE","Cybersecurity","Penetration Testing","SIEM","IAM","iOS","Android","SwiftUI","Flutter","Jest","Cypress","Playwright","Selenium","Unit Testing","TDD","QA","Figma","Sketch","Photoshop","Illustrator","Adobe Creative Suite","UX Research","UI/UX Design","Prototyping","Product Management","Agile","Scrum","Jira","Confluence","Salesforce","HubSpot","CRM","SEO","Google Analytics","Content Marketing","Social Media","Copywriting","Project Management","Stakeholder Management","Customer Service","Financial Modeling","Accounting","QuickBooks","SAP","Six Sigma","Spanish","EHR/EMR","HIPAA","CPR/BLS","AutoCAD","SolidWorks","PLC","OSHA","Forklift"];

const ALIASES = {
  js: "JavaScript", javascript: "JavaScript", es6: "JavaScript", ts: "TypeScript", typescript: "TypeScript",
  reactjs: "React", "react.js": "React", react: "React", "react native": "React Native", nextjs: "Next.js", next: "Next.js",
  vuejs: "Vue", "vue.js": "Vue", angularjs: "Angular", nodejs: "Node.js", node: "Node.js", "node.js": "Node.js",
  express: "Express.js", expressjs: "Express.js", nestjs: "NestJS", golang: "Go", postgres: "PostgreSQL", postgresql: "PostgreSQL",
  mongo: "MongoDB", mongodb: "MongoDB", k8s: "Kubernetes", kubernetes: "Kubernetes", "amazon web services": "AWS",
  "google cloud": "GCP", gcp: "GCP", tailwind: "Tailwind CSS", scss: "Sass", sklearn: "scikit-learn", "scikit learn": "scikit-learn",
  ml: "Machine Learning", "machine learning": "Machine Learning", ai: "Generative AI", genai: "Generative AI", llm: "LLMs", llms: "LLMs",
  "ci/cd": "CI/CD", cicd: "CI/CD", "rest api": "REST APIs", rest: "REST APIs", restful: "REST APIs", "power bi": "Power BI",
  "c sharp": "C#", csharp: "C#", cpp: "C++", "objective c": "Objective-C", rails: "Ruby on Rails", "ruby on rails": "Ruby on Rails",
  "spring boot": "Spring Boot", spring: "Spring Boot", dotnet: ".NET", ".net": ".NET", "asp.net": ".NET", "ux research": "UX Research",
  "ui/ux": "UI/UX Design", "ux/ui": "UI/UX Design", "ui design": "UI/UX Design", "ux design": "UI/UX Design",
};

const BY_LOWER = new Map(SKILL_NAMES.map((s) => [s.toLowerCase(), s]));

export function canonicalSkill(input) {
  const s = String(input || "").trim();
  const k = s.toLowerCase();
  return ALIASES[k] || BY_LOWER.get(k) || s;
}
