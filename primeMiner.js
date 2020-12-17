"use strict";

const { Miner } = require('spartan-gold');
const BigInteger = require('jsbn').BigInteger;
const PrimeBlockchain = require('./primeBlockchain.js');
const PrimeBlock = require('./primeBlock.js');
const Prime = require('./prime.js');


module.exports = class PrimeMiner extends Miner {

  constructor(args) {
    super(args);
    this.primeChains = [];
  }

  /**
   * Remove proof property from default block.
   */
  startNewSearch(txSet=new Set()) {
    super.startNewSearch(txSet);

    // Remove original proof property
    delete this.currentBlock.proof;
  }

  /**
   * Looks for a prime number chain as proof-of-work that must meet target
   * chain length. Pauses to listen for messages like parent method. Proof
   * attached to block is composed of a multiplier, chain length, chain type.
   * Proper block nonce must also be looked for before looking for proof.
   * Block header hash is the hash of block including nonce, but without prime 
   * multiplier, chain length, and chain type.
   *
   * 1. Increment block nonce until block header hash meets minimum size.
   * 2. Multiply block header hash by a primorial and multiplier to obtain a chain origin number.
   *  a. The primorial 7# is used and serves to hopefully aid in finding prime chains.
   * 3. Test if the chain origin has a prime chain of any of three possible types that meets target length.
   * 4. If no suitable chain, increment the multiplier.
   * 5. If chain is found, set prime multiplier, chain length, and chain type as proof.
   * 
   * @param {boolean} oneAndDone - Give up after the first PoW search (testing only).
   */
  findProof(oneAndDone=false) {
    // Find nonce that makes block header hash larger than min size
    let blockHeaderHash = new BigInteger(this.currentBlock.hashHeader(), 16);
    while (blockHeaderHash.compareTo(PrimeBlockchain.BLOCK_HEADER_HASH_MIN) < 0) {
      this.currentBlock.primeNonce++;
      blockHeaderHash = new BigInteger(this.currentBlock.hashHeader(), 16);
    }

    // Try incrementing primeMultiplier until a suitable prime chain is found
    let roundsDone = 0;
    while (roundsDone < this.miningRounds) {
      let multiplier = Prime.BI_BASE_PRIMORIAL.multiply(this.currentBlock.primeMultiplier);
      //let multiplier = this.currentBlock.primeMultiplier;
      let { chainLength, chainType } = Prime.findPrimeChain(blockHeaderHash.multiply(multiplier), this.currentBlock.target);

      if (chainLength >= this.currentBlock.target) {
        this.currentBlock.primeMultiplier = multiplier;
        this.currentBlock.primeChainLength = chainLength;
        this.currentBlock.primeChainType = chainType;
        this.log(`found proof prime chain with length ${this.currentBlock.primeChainLength} for block ${this.currentBlock.chainLength}`);
        this.announceProof();
        this.receiveBlock(this.currentBlock);
        this.startNewSearch();
        break;
      }
      this.currentBlock.primeMultiplier = this.currentBlock.primeMultiplier.add(Prime.BI_ONE);
      roundsDone++;
    }

    // If we are testing, don't continue the search.
    if (!oneAndDone) {
      // Check if anyone has found a block, and then return to mining.
      setTimeout(() => this.emit(PrimeBlockchain.START_MINING), 0);
    }
  }

  /**
   * Copied from Client and Miner classes, but uses PrimeBlockchain's deserializeBlock().
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

    if (block === null) return null;

    // We switch over to the new chain only if it is better.
    if (this.currentBlock && block.chainLength >= this.currentBlock.chainLength) {
      this.log(`cutting over to new chain.`);
      let txSet = this.syncTransactions(block);
      this.startNewSearch(txSet);
    }
  }
  
}