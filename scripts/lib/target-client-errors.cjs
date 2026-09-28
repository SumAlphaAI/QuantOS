// pg emits idle transport failures outside query promises. Latch them so target
// receipts fail normally instead of crashing with a stale RUNNING receipt.
module.exports = function observeClientErrors(client, onFailure) {
  let failure;
  client.on('error', error => {
    failure = error;
    onFailure();
  });
  return () => { if (failure) throw Error('Target database connection failed outside a query'); };
};
