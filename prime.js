"use strict";

const PrimeBlockchain = require('./primeBlockchain.js');
const BigInteger = require('jsbn').BigInteger;

// Frequently used BigInteger constants
const BI_ZERO = new BigInteger("0");
const BI_ONE = new BigInteger("1");
const BI_TWO = new BigInteger("2");
const BI_THREE = new BigInteger("3");
const BI_FOUR = new BigInteger("4");

// 7# = 210, primorial of 7, used as base multiplier for proofs
const BI_BASE_PRIMORIAL = new BigInteger("210");

module.exports = class Prime {

  static get BI_ZERO() { return BI_ZERO; }
  static get BI_ONE() { return BI_ONE; }
  static get BI_TWO() { return BI_TWO; }
  static get BI_THREE() { return BI_THREE; }
  static get BI_FOUR() { return BI_FOUR; }
  static get BI_BASE_PRIMORIAL() { return BI_BASE_PRIMORIAL; }

  /**
   * Fermat's little theorem used as probable primality test
   * For any a where 1 < a < n - 1
   * a ^ (n-1) mod n = 1
   *
   * @param {BigInteger} n - Number to test for probable primality
   *
   * @returns {boolean} - Whether n is a probable prime or not
   */
  static fermatPrimalityTest(n) {
    // 2 is prime
    if (n.compareTo(BI_TWO) === 0) {
      return true;
    }

    // 2 ^ (n-1) mod n = 1
    if (BI_TWO.modPow(n.subtract(BI_ONE), n).compareTo(BI_ONE) === 0) {
      return true;
    }

    return false;
  }

  /**
   * Probably primality test for Sophie-Germain primes generalized from
   * results of Euler-Lagrange theorem. Test expanded for both types of
   * Cunningham chains by Henri Lifchitz.
   * 
   * http://www.primenumbers.net/Henri/us/NouvTh1us.htm
   *
   * @param {BigInteger} p - Base prime number to start chain
   * @param {string} chainType - First or second Cunningham chain
   *
   * @returns {boolean} - Next number in chain is prime or not
   */
  static eulerLagrangePrimalityTest(p, chainType) {
    let pMod4 = p.mod(BI_FOUR);

    // Edge cases for p < 4
    if (p.compareTo(BI_ZERO) > 0 && p.compareTo(BI_FOUR) < 0) {
      return true;
    }

    // Edge case for p = 4
    if (p.compareTo(BI_FOUR) === 0) {
      if (chainType ===  PrimeBlockchain.CUNNINGHAM_CHAIN_2) {
        return true;
      }else {
        return false;
      }
    }

    if (chainType === PrimeBlockchain.CUNNINGHAM_CHAIN_1) {
      if (pMod4.compareTo(BI_ONE) === 0) {
        // (2^p + 1) mod (2p + 1) = 0
        let a = BI_TWO.pow(p).add(BI_ONE);
        let m = p.multiply(BI_TWO).add(BI_ONE);
        if (a.mod(m).compareTo(BI_ZERO) === 0) {
          return true; 
        }
      }else if (pMod4.compareTo(BI_THREE) === 0) {
        // (2^p - 1) mod (2p + 1) = 0
        let a = BI_TWO.pow(p).subtract(BI_ONE);
        let m = p.multiply(BI_TWO).add(BI_ONE);
        if (a.mod(m).compareTo(BI_ZERO) === 0) {
          return true;
        }
      }
    }else if (chainType === PrimeBlockchain.CUNNINGHAM_CHAIN_2) {
      if (pMod4.compareTo(BI_ONE) === 0) {
        // (2^(p-1) - 1) mod (2p - 1) = 0
        let a = BI_TWO.pow(p.subtract(BI_ONE)).subtract(BI_ONE);
        let m = p.multiply(BI_TWO).subtract(BI_ONE);
        if (a.mod(m).compareTo(BI_ZERO) === 0) {
          return true;
        }
      }else if (pMod4.compareTo(BI_THREE) === 0) {
        // (2^(p-1) + 1) mod (2p - 1) = 0
        let a = BI_TWO.pow(p.subtract(BI_ONE)).add(BI_ONE);
        let m = p.multiply(BI_TWO).subtract(BI_ONE);
        if (a.mod(m).compareTo(BI_ZERO) === 0) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Starting from a given number, test for primality and probable
   * prime chain length of a certain type of Cunningham chain. Uses
   * basic Fermat's little theorem for first number and Lifchitz's
   * generalized theorem for rest of chain.
   *
   * @param {BigInteger} n - First number in potential prime chain
   * @param {string} chainType - First or second Cunningham chain
   *
   * @returns {int} - Length of Cunningham chain found
   */
  static findCunninghamChain(n, chainType, target) {
    let chainLength = 1;

    // Test first number for primality with Fermat's little theorem
    if (!Prime.fermatPrimalityTest(n) || !n.isProbablePrime()) {
      return 0;
    }

    // Target met, return early
    if (chainLength >= target) {
      return chainLength;
    }

    // Test next number in chain using Lifchitz's theorem
    while (Prime.eulerLagrangePrimalityTest(n, chainType)) {
      chainLength += 1;

      // Check next number
      if (chainType === PrimeBlockchain.CUNNINGHAM_CHAIN_1) {
        n = n.multiply(BI_TWO).add(BI_ONE);
      }else if (chainType === PrimeBlockchain.CUNNINGHAM_CHAIN_2) {
        n = n.multiply(BI_TWO).subtract(BI_ONE);
      }else {
        throw new Error("Tried to test for Cunningham chain with invalid chain type.");
      }

      // Double check with jsbn.BigInteger primality test
      if (!Prime.fermatPrimalityTest(n) || !n.isProbablePrime()) {
       chainLength -= 1;
       break;
      }

      // Target met, return early
      if (chainLength >= target) {
        return chainLength;
      }
    }

    return chainLength;
  }

  /**
   * Starting from a given chain origin (not prime), find prime
   * chain from (origin + 1) for first Cunningham type chain and
   * (origin - 1) for second Cunningham type chain. Bitwin chains
   * are both types of Cunningham chains. Return best chain type
   * based on longest length.
   *
   * @param {BigInteger} n - Origin number, check n-1, n+1
   * @param {int} target - chain length to reach
   *
   * @returns {int} chainLength - Length of best chain
   * @returns {string} chainType - Type of best chain
   */
  static findPrimeChain(origin, target) {
    let first = origin.subtract(BI_ONE);
    let second = origin.add(BI_ONE);
    let firstChainLength = Prime.findCunninghamChain(first, PrimeBlockchain.CUNNINGHAM_CHAIN_1, target);
    let secondChainLength = Prime.findCunninghamChain(second, PrimeBlockchain.CUNNINGHAM_CHAIN_2, target);
    let bitwinChainLength = 0;

    // If first type of chain is longer, allow for 1 extra prime
    // so bitwin chains can have odd length
    if (firstChainLength > secondChainLength) {
      bitwinChainLength = secondChainLength * 2 + 1;
    }else {
      bitwinChainLength = firstChainLength * 2;
    }

    if (firstChainLength >= secondChainLength && firstChainLength >= bitwinChainLength) {
      return { chainLength: firstChainLength, chainType: PrimeBlockchain.CUNNINGHAM_CHAIN_1 }; 
    }else if (secondChainLength >= firstChainLength && secondChainLength >= bitwinChainLength) {
      return { chainLength: secondChainLength, chainType: PrimeBlockchain.CUNNINGHAM_CHAIN_2 };
    }else {
      return { chainLength: bitwinChainLength, chainType: PrimeBlockchain.BITWIN_CHAIN };
    }
  }

}