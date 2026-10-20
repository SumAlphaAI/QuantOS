import{operations as command}from'./bff-fe-002-contract.mjs';
import{operations as platform}from'./bff-fe-011-contract.mjs';
export const operations=[...command,...platform];
export const domains=[['command','scripts/test-bff-fe-002-http.mjs'],['platform','scripts/test-bff-fe-011-http.mjs']];
