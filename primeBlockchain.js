"use strict";

const { Blockchain } = require('spartan-gold');
const BigInteger = require('jsbn').BigInteger;

const CUNNINGHAM_CHAIN_1 = "CUNNINGHAM_CHAIN_1";
const CUNNINGHAM_CHAIN_2 = "CUNNINGHAM_CHAIN_2";
const BITWIN_CHAIN = "BITWIN_CHAIN";

const BLOCK_HEADER_HASH_MIN = new BigInteger("1").shiftLeft(new BigInteger("255"));
const PRIME_CHAIN_BASE_TARGET = 2;

module.exports = class PrimeBlockchain extends Blockchain {

  // Types of prime chains as string
  static get CUNNINGHAM_CHAIN_1() { return CUNNINGHAM_CHAIN_1; }
  static get CUNNINGHAM_CHAIN_2() { return CUNNINGHAM_CHAIN_2; }
  static get BITWIN_CHAIN() { return BITWIN_CHAIN; }
  
  // BigInteger min value for block header hash
  static get BLOCK_HEADER_HASH_MIN() { return BLOCK_HEADER_HASH_MIN; }

  /**
   * Generate genesis block from parent, but replace cfg.powTarget
   *
   * @returns {Block} - The genesis block
   */
  static makeGenesis(cfg) {
    // Generating the default genesis block from the parent
    let genesis = super.makeGenesis(cfg);

    Blockchain.cfg.powTarget = PRIME_CHAIN_BASE_TARGET;

    return genesis;
  }

  /**
   * Converts a string representation of a block to a new Block instance.
   * Replaces proof of base Block for prime proof properties for PrimeBlock.
   * 
   * @param {Object} o - An object representing a block, but not necessarily an instance of Block.
   * 
   * @returns {Block}
   */
  static deserializeBlock(o) {
    if (o instanceof Blockchain.cfg.blockClass) {
      return o;
    }

    let b = new Blockchain.cfg.blockClass();
    b.chainLength = parseInt(o.chainLength, 10);
    b.timestamp = o.timestamp;

    if (b.isGenesisBlock()) {
      // Balances need to be recreated and restored in a map.
      o.balances.forEach(([clientID,amount]) => {
        b.balances.set(clientID, amount);
      });
    } else {
      // Likewise, transactions need to be recreated and restored in a map.
      b.transactions = new Map();
      if (o.transactions) o.transactions.forEach(([txID,txJson]) => {
        let tx = new Blockchain.cfg.transactionClass(txJson);
        b.transactions.set(txID, tx);
      });
      b.prevBlockHash = o.prevBlockHash;
      b.primeNonce = o.primeNonce;
      b.primeMultiplier = new BigInteger(o.primeMultiplier);
      b.primeChainLength = o.primeChainLength;
      b.primeChainType = o.primeChainType;
      b.rewardAddr = o.rewardAddr;
    }

    return b;
  }

}