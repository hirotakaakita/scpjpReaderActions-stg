// Checks the actual GitHub environment credential and FCM permission WITHOUT delivery.
const { validateNotificationTarget, PROJECT_ID, TOPIC_PREFIX } = require('./staging-environment');
const { getAccessToken, sendTopicNotification } = require('./send-new-scp-notifications');

async function main() {
  const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
  validateNotificationTarget(account);
  const token = await getAccessToken(account);
  await sendTopicNotification(token, PROJECT_ID, `${TOPIC_PREFIX}en`,
    '[STG] Configuration validation', 'Validation only; no notification is delivered.', true);
  console.log('Staging credential and FCM validate_only request verified. No notification sent.');
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
