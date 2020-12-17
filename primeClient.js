"use strict";

const { Client } = require('spartan-gold');
const PrimeBlockchain = require('./primeBlockchain.js');
const PrimeBlock = require('./primeBlock.js');

module.exports = class PrimeClient extends Client {

  constructor(args) {
    super(args);
    this.primeChains = [];
  }

  /**
   * Copied from parent class, but uses PrimeBlockchain's deserializeBlock().
   * Also saves proof-of-work prime chain info to array. Prime chain info can be
   * saved to a file from the CLI by running tcpPrimeMiner.js
   *
   * Validates and adds a block to the list of blocks, possibly updating the head
   * of the blockchain.  Any transactions in the block are rerun in order to
   * update the gold balances for all clients.  If any transactions are found to be
   * invalid due to lack of funds, the block is rejected and 'null' is returned to
   * indicate failure.
   * 
   * If any blocks cannot be connected to an existing block but seem otherwise valid,
   * they are added to a list of pending blocks and a request is sent out to get the
   * missing blocks from other clients.
   * 
   * @param {Block | Object} block - The block to add to the clients list of available blocks.
   * 
   * @returns {Block | null} The block with rerun transactions, or null for an invalid block.
   */
  receiveBlock(block) {
    // If the block is a string, then deserialize it.
    block = PrimeBlockchain.deserializeBlock(block);

    // Ignore the block if it has been received previously.
    if (this.blocks.has(block.id)) return null;

    // First, make sure that the block has a valid proof. 
    if (!block.hasValidProof() && !block.isGenesisBlock()) {
      this.log(`Block ${block.id} does not have a valid proof.`);
      return null;
    }

    // Make sure that we have the previous blocks, unless it is the genesis block.
    // If we don't have the previous blocks, request the missing blocks and exit.
    let prevBlock = this.blocks.get(block.prevBlockHash);
    if (!prevBlock && !block.isGenesisBlock()) {
      let stuckBlocks = this.pendingBlocks.get(block.prevBlockHash);

      // If this is the first time that we have identified this block as missing,
      // send out a request for the block.
      if (stuckBlocks === undefined) { 
        this.requestMissingBlock(block);
        stuckBlocks = new Set();
      }
      stuckBlocks.add(block);

      this.pendingBlocks.set(block.prevBlockHash, stuckBlocks);
      return null;
    }

    if (!block.isGenesisBlock()) {
      // Verify the block, and store it if everything looks good.
      // This code will trigger an exception if there are any invalid transactions.
      let success = block.rerun(prevBlock);
      if (!success) return null;
    }

    // Storing the block.
    this.blocks.set(block.id, block);

    // Storing the prime chain info
    this.primeChains.push({
      blockNumber: block.chainLength,
      blockHash: block.hashVal(),
      blockHeaderHash: block.hashHeader(),
      primeMultiplier: block.primeMultiplier.toString(),
      primeChainLength: block.primeChainLength,
      primeChainType: block.primeChainType,
    });

    // If it is a better block than the client currently has, set that
    // as the new currentBlock, and update the lastConfirmedBlock.
    if (this.lastBlock.chainLength < block.chainLength) {
      this.lastBlock = block;
      this.setLastConfirmed();
    }

    // Go through any blocks that were waiting for this block
    // and recursively call receiveBlock.
    let unstuckBlocks = this.pendingBlocks.get(block.id) || [];
    // Remove these blocks from the pending set.
    this.pendingBlocks.delete(block.id);
    unstuckBlocks.forEach((b) => {
      this.log(`Processing unstuck block ${b.id}`);
      this.receiveBlock(b);
    });

    return block;
  }
}