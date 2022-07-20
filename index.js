const core = require('@actions/core');
const github = require('@actions/github'); /// https://octokit.github.io/
const minimatch = require('minimatch');
const parse = require('lcov-parse');
const fs = require('fs');

function run() {
  const lcovPath = core.getInput('path');
  const minCoverage = core.getInput('min_coverage');
  const excluded = core.getInput('exclude');
  const excludedFiles = excluded.split(' ');
  const githubToken = core.getInput('github_token');

  if (!canParse(lcovPath)) {
    return;
  }

  parse(lcovPath, (err, data) => {
    if (typeof data === 'undefined') {
      core.setFailed('parsing error!');
      return;
    }

    const linesMissingCoverage = [];

    let totalFinds = 0;
    let totalHits = 0;
    data.forEach((element) => {
      if (shouldCalculateCoverageForFile(element['file'], excludedFiles)) {
        totalFinds += element['lines']['found'];
        totalHits += element['lines']['hit'];

        for (const lineDetails of element['lines']['details']) {
          const hits = lineDetails['hit'];

          if (hits === 0) {
            const fileName = element['file'];
            const lineNumber = lineDetails['line'];
            linesMissingCoverage[fileName] =
              linesMissingCoverage[fileName] || [];
            linesMissingCoverage[fileName].push(lineNumber);
          }
        }
      }
    });

    const coverage = (totalHits / totalFinds) * 100;
    const isValidBuild = coverage >= minCoverage;
    if (!isValidBuild) {
      const linesMissingCoverageByFile = Object.entries(
        linesMissingCoverage
      ).map(([file, lines]) => {
        return `${file}: ${lines.join(', ')}`;
      });

      core.setFailed(
        `${coverage} is less than min_coverage ${minCoverage}\n\n` +
          'Lines not covered:\n' +
          linesMissingCoverageByFile.map((line) => `  ${line}`).join('\n')
      );
    }

    if (githubToken) {
      const message = `Hello world 3`;
      postOrUpdateComment(githubToken, message);
    }
  });
}

function shouldCalculateCoverageForFile(fileName, excludedFiles) {
  for (let i = 0; i < excludedFiles.length; i++) {
    const isExcluded = minimatch(fileName, excludedFiles[i]);
    if (isExcluded) {
      core.debug(`Excluding ${fileName} from coverage`);
      return false;
    }
  }
  return true;
}

function canParse(path) {
  if (fs.existsSync(path) && fs.readFileSync(path).length === 0) {
    core.setFailed('lcov is empty!');
    return false;
  }

  return true;
}

/**
 * Comments on the GitHub PR with the given message.
 *
 * If a comment already exists, it will be updated. In order to avoid,
 * polluting the comment history.
 *
 * @param {string} githubToken
 * @param {string} message
 * @returns
 */
async function postOrUpdateComment(githubToken, message) {
  if (!githubToken) return;

  const octokit = github.getOctokit(githubToken);
  const context = github.context;
  octokit.rest.issues.updateComment;

  let commentIdentifier;
  for (let comment of await context.issue.comments) {
    if (comment.user.type === 'Bot' && comment.body.includes('Hello World 2')) {
      commentIdentifier = comment.id;
      break;
    }
  }

  const comment = {
    ...context.repo,
    issue_number: context.payload.number,
    body: message,
    comment_id: commentIdentifier,
  };
  if (commentIdentifier) {
    octokit.rest.issues.updateComment(comment);
  } else {
    octokit.rest.issues.createComment(comment);
  }
}

run();
