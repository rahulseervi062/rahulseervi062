// scripts/update-activity.js
//
// Fetches recent public activity for a GitHub user directly from the
// GitHub REST API and writes a formatted list into README.md between
// the <!--START_SECTION:activity--> / <!--END_SECTION:activity--> markers.
//
// No third-party action involved — this is plain Node.js + the GitHub API.

const fs = require("fs");
const path = require("path");

const USERNAME = process.env.GH_USERNAME || "rahulseervi062";
const TOKEN = process.env.GH_TOKEN; // provided by the workflow (secrets.GITHUB_TOKEN)
const README_PATH = path.join(__dirname, "..", "README.md");
const MAX_ITEMS = 5;

// Map GitHub event types to a human-readable, emoji-prefixed line.
function formatEvent(event) {
  const repo = event.repo.name;

  switch (event.type) {
    case "PushEvent": {
      const commitCount = event.payload.commits?.length || 0;
      return `🔨 Pushed ${commitCount} commit${commitCount === 1 ? "" : "s"} to [${repo}](https://github.com/${repo})`;
    }
    case "PullRequestEvent": {
      const action = event.payload.action; // opened, closed, merged...
      const prNumber = event.payload.pull_request?.number;
      return `🔀 ${capitalize(action)} PR [#${prNumber}](https://github.com/${repo}/pull/${prNumber}) in [${repo}](https://github.com/${repo})`;
    }
    case "IssuesEvent": {
      const action = event.payload.action;
      const issueNumber = event.payload.issue?.number;
      return `❗ ${capitalize(action)} issue [#${issueNumber}](https://github.com/${repo}/issues/${issueNumber}) in [${repo}](https://github.com/${repo})`;
    }
    case "CreateEvent": {
      const refType = event.payload.ref_type; // repository, branch, tag
      return `🌱 Created ${refType} in [${repo}](https://github.com/${repo})`;
    }
    case "ForkEvent":
      return `🍴 Forked [${repo}](https://github.com/${repo})`;
    case "WatchEvent":
      return `⭐ Starred [${repo}](https://github.com/${repo})`;
    case "ReleaseEvent":
      return `🚀 Published a release in [${repo}](https://github.com/${repo})`;
    default:
      return null; // skip event types we don't care about
  }
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function fetchRecentEvents() {
  const url = `https://api.github.com/users/${USERNAME}/events/public`;

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": USERNAME,
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`GitHub API request failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function main() {
  const events = await fetchRecentEvents();

  const lines = [];
  for (const event of events) {
    const line = formatEvent(event);
    if (line) lines.push(`- ${line}`);
    if (lines.length >= MAX_ITEMS) break;
  }

  if (lines.length === 0) {
    lines.push("- No recent public activity found.");
  }

  const block = lines.join("\n");

  let readme = fs.readFileSync(README_PATH, "utf8");

  const startMarker = "<!--START_SECTION:activity-->";
  const endMarker = "<!--END_SECTION:activity-->";

  const startIdx = readme.indexOf(startMarker);
  const endIdx = readme.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      "Could not find activity markers in README.md. Make sure it contains both <!--START_SECTION:activity--> and <!--END_SECTION:activity-->."
    );
  }

  const before = readme.slice(0, startIdx + startMarker.length);
  const after = readme.slice(endIdx);

  const updatedReadme = `${before}\n${block}\n${after}`;

  fs.writeFileSync(README_PATH, updatedReadme, "utf8");
  console.log("README.md activity section updated successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
