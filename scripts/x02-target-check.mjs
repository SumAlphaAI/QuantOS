// Deliberately fail closed. This task does not grant a deployed target campaign.
console.error('X02 target NOT_RUN: requires separately authorized deployed identity/key custody, durable kill/duplicate state, atomic X03 issuer and representative P95/CI evidence. Local fixtures cannot satisfy this target group.');
process.exitCode=2;
