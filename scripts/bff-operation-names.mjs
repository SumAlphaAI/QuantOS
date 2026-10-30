// Shared by page traceability and complete operation coverage. Every published
// verb must be recognized in both checks, including controlled review actions.
export function operationNames(text) {
  return text.match(/\b(?:get|download|list|search|create|save|update|delete|ack|unack|open|resolve|run|submit|request|engage|release|decide|approve|endorse|authorize|retain|cancel|subscribe|revoke|setup|clear|check)[A-Z][A-Za-z0-9]*\b|\b(?:reauth|mfaChallenge|logout)\b/g) ?? [];
}
