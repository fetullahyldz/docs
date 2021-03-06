#!/usr/bin/env node

const fs = require('fs');
const {Signale} = require('signale');
// initialize Github API with custom accept headers to be able to use
// experimental Projects and Emoji APIs
const octokit = require('@octokit/rest')({
  headers: {
    accept: 'application/vnd.github.inertia-preview+json,application/vnd.github.symmetra-preview+json',
  },
});

const gitHubImporter = require('./gitHubImporter');

const DESTINATION_JSON = __dirname + '/../../../pages/content/amp-dev/community/roadmap.json';

const log = new Signale({
  'interactive': true,
  'scope': 'Roadmap Importer',
});

async function importRoadmap() {
  log.start('Starting import of roadmap.');

  gitHubImporter.checkCredentials();
  octokit.authenticate(gitHubImporter.CLIENT_TOKEN ? {
    type: 'token',
    token: gitHubImporter.CLIENT_TOKEN,
  } : {
    type: 'oauth',
    key: gitHubImporter.CLIENT_ID,
    secret: gitHubImporter.CLIENT_SECRET,
  });

  const result = await octokit.projects.listColumns({project_id: '1344133'});

  log.await('Fetching cards per column ...');
  // grab all card data for each column
  const columns = await Promise.all(result.data.map((column) => octokit.projects.listCards({column_id: column.id}).then((result) => {
    // strip out stuff we don't need
    let cards = result.data.map((card) => ({
      url: card.url,
      createdAt: card.created_at,
      updatedAt: card.updated_at,
      issueUrl: card.content_url,
    }));

    // filter cards that don't have attached issues
    cards = cards.filter((card) => card.issueUrl);

    return {cards: cards, id: column.id, name: column.name};
  })));

  // create a flattened cards array
  const cards = columns.reduce((accumulator, currentValue) => [...accumulator, ...currentValue.cards], []);

  // fetch all related issues
  const issues = await Promise.all(cards.map((card) => {
    const issue = card.issueUrl.match(/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    return octokit.issues.get({owner: issue[1], repo: issue[2], number: issue[3]}).then((result) => {
      result.url = card.issueUrl;
      return result;
    });
  }));

  // create a map for better lookup
  const issueMap = Object.assign({}, ...issues.map((item) => ({[item['url']]: item})));

  // attach issues to cards
  cards.forEach((card) => {
    const issue = issueMap[card.issueUrl];
    card.issue = {
      url: issue.data.html_url,
      title: issue.data.title.replace(/\[Master [fF]eature\] /, ''),
      description: issue.data.body
          .replace('Feature description:\r\n\r\n', '')
          .replace(/\[ \]/g, '')
          .split('\r\n\r\n')[0],
      labels: (issue.data.labels || []).map((label) => {
        return label.name.startsWith('Category:') ? {url: label.url, name: label.name.replace('Category:', '').trim(), color: label.color} : false;
      }).filter((label) => !!label),
    };

    delete card.url;
    delete card.issueUrl;
  });

  // create a list of unique labels
  const labels = cards
      .map((card) => card.issue.labels.map((label) => label.name))
      .reduce((acc, val) => acc.concat(val), [])
      .filter((value, index, self) => self.indexOf(value) === index);

  // Write finalized JSON to config file that gets imported by the roadmap template
  fs.writeFileSync(DESTINATION_JSON, JSON.stringify({labels: labels, columns: columns}, null, '  '));

  log.success('Successfully imported roadmap!');
}

module.exports = {
  'importRoadmap': importRoadmap,
};
