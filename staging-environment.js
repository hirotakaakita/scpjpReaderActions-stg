'use strict';

const PROJECT_ID = 'scpjp-reader-stg';
const REPOSITORY = 'hirotakaakita/scpjpReaderActions-stg';
const TOPIC_PREFIX = 'stg_new_scp_';

function validateNotificationTarget(serviceAccount, repository = process.env.GITHUB_REPOSITORY) {
  if (repository && repository !== REPOSITORY) {
    throw new Error('Staging notifications may only run in the staging repository.');
  }
  if (serviceAccount.type !== 'service_account' || serviceAccount.project_id !== PROJECT_ID) {
    throw new Error(`Staging notifications require a service account from ${PROJECT_ID}.`);
  }
}

module.exports = { PROJECT_ID, REPOSITORY, TOPIC_PREFIX, validateNotificationTarget };
