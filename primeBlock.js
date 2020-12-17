"use strict";

const { Block, utils } = require('spartan-gold');
const BigInteger = require('jsbn').BigInteger;

const PrimeBlockchain = require('./primeBlockchain.js');
const Prime = require('./prime.js');

module.exports = class PrimeBlock extends Block {

  constructor(rewardAddr, prevBlock, target=PrimeBlockchain.PRIME_CHAIN_LENGTH_TARGET, coinbaseReward=PrimeBlockchain.COINBASE_AMT_ALLOWED) {
    super(rewardAddr, prevBlock, target, coinbaseReward);
    this.primeNonce = 0;
    this.primeMultiplier = Prime.BI_TWO;
    this.primeChainLength = 0;
    this.primeChainType = "";
  }

  /**
   * Check if this completed block has valid proof with more primality
   * tests put together.
   *
   * @returns {boolean} - Whether proof is correct or not
   */
  hasValidProof() {
    // Check block header hash has at least 200 bits
    let blockHeaderHash = new BigInteger(this.hashHeader(), 16);
    if (blockHeaderHash.compareTo(PrimeBlockchain.BLOCK_HEADER_HASH_MIN) < 0) {
      console.log("failed hash");
      return false;
    }

    // Check that prime chain length found meets target
    if (this.primeChainLength < this.target) {
      console.log("failed length", this.primeChainLength, this.target);
      return false;
    }

    // Check that multiplier is not less than 2
    if (this.primeMultiplier.compareTo(Prime.BI_TWO) < 0) {
      console.log("failed multiplier");
      return false;
    }

    // Compute prime origin
    let origin = blockHeaderHash.multiply(this.primeMultiplier);

    // Manually test each number in chain depending on type, up to length
    if (this.primeChainType === PrimeBlockchain.CUNNINGHAM_CHAIN_1) {
      let n = origin.subtract(Prime.BI_ONE);
      let testLength = Prime.findCunninghamChain(n, PrimeBlockchain.CUNNINGHAM_CHAIN_1, this.target);
      if (testLength < this.target) {
        return false;
      }
    }else if (this.primeChainType === PrimeBlockchain.CUNNINGHAM_CHAIN_2) {
      let n = origin.add(Prime.BI_ONE);
      let testLength = Prime.findCunninghamChain(n, PrimeBlockchain.CUNNINGHAM_CHAIN_2, this.target);
      if (testLength < this.target) {
        return false;
      }
    }else if (this.primeChainType === PrimeBlockchain.BITWIN_CHAIN) {
      let first = origin.subtract(Prime.BI_ONE);
      let second = origin.add(Prime.BI_ONE);
      let firstLength = Prime.findCunninghamChain(first, PrimeBlockchain.CUNNINGHAM_CHAIN_1, Math.ceil(this.target / 2));
      let secondLength = Prime.findCunninghamChain(second, PrimeBlockchain.CUNNINGHAM_CHAIN_2, Math.floor(this.target / 2));
      if (firstLength + secondLength < this.target) {
        return false;
      }
    }else {
      // Invalid chain type
      return false;
    }
    

    return true;
  }

  /**
   * Only hash certain parts of block, primarily all parts except proof.
   *
   * @returns {String} - Cryptographic hash of the block header
   */
  hashHeader() {
    if (this.isGenesisBlock()) {
      let o = {
        chainLength: this.chainLength,
        timestamp: this.timestamp,
        balances: Array.from(this.balances.entries()),
      };
      return utils.hash(JSON.stringify(o));
    } else {
      let o = {
        chainLength: this.chainLength,
        timestamp: this.timestamp,
        transactions: Array.from(this.transactions.entries()),
        prevBlockHash: this.prevBlockHash,
        primeNonce: this.primeNonce,
        rewardAddr: this.rewardAddr,
      };
      return utils.hash(JSON.stringify(o));
    }
  }

  /**
   * Hash entire block, probably redundant from parent.
   *
   * @returns {String} - Cryptographic hash of the block
   */
  hashVal() {
    return utils.hash(this.serialize());
  }

  /**
   * Pack block object into JSON string from toJSON().
   *
   * @returns {String} - JSON string of block
   */
  serialize() {
    return JSON.stringify(this);
  }

  /**
   * Pack block into generic object before converting to JSON string.
   *
   * @returns {Object} - Object packed with block properties
   */
  toJSON() {
    let o = {
      chainLength: this.chainLength,
      timestamp: this.timestamp,
    };
    if (this.isGenesisBlock()) {
      // The genesis block does not contain a proof or transactions,
      // but is the only block than can specify balances.
      o.balances = Array.from(this.balances.entries());
    } else {
      // Other blocks must specify transactions and proof details.
      o.transactions = Array.from(this.transactions.entries());
      o.prevBlockHash = this.prevBlockHash;
      o.primeNonce = this.primeNonce;
      o.primeMultiplier = this.primeMultiplier.toString();
      o.primeChainLength = this.primeChainLength;
      o.primeChainType = this.primeChainType;
      o.rewardAddr = this.rewardAddr;
    }
    return o;
  }


}