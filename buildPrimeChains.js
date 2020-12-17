"use strict";

const { readFileSync, writeFileSync } = require('fs');
const BigInteger = require('jsbn').BigInteger;

const PrimeBlockchain = require('./primeBlockchain.js');
const Prime = require('./prime.js');


/**
 * Reconstruct prime chain accoridng to length and type. Chain is
 * represented as a string with prime numbers delimited by commas.
 *
 * @param {BigInteger} origin - chain origin number
 * @param {int} chainLength - length of prime chain
 * @param {string} chainType - type of prime chain
 *
 * @returns {string} - prime chain numbers delimited by commas
 */
function buildChain(origin, chainLength, chainType) {
  let primeChain = [];
  
  // Error for chain length of 0
  if (chainLength < 1) {
    console.error("Invalid chain, chain length less than 1");
    process.exit();
  }

  if (chainType === PrimeBlockchain.CUNNINGHAM_CHAIN_1) {
    origin = origin.subtract(Prime.BI_ONE);
    primeChain.push(origin.toString());
    for (let i = 1; i < chainLength; i++) {
      origin = origin.multiply(Prime.BI_TWO).add(Prime.BI_ONE);
      primeChain.push(origin.toString());
    }
  }else if (chainType === PrimeBlockchain.CUNNINGHAM_CHAIN_2) {
    origin = origin.add(Prime.BI_ONE);
    primeChain.push(origin.toString());
    for (let i = 1; i < chainLength; i++) {
      origin = origin.multiply(Prime.BI_TWO).subtract(Prime.BI_ONE);
      primeChain.push(origin.toString());
    }
  }else if (chainType === PrimeBlockchain.BITWIN_CHAIN) {
    let first = origin.subtract(Prime.BI_ONE);
    primeChain.push(first.toString());
    let second = origin.add(Prime.BI_ONE);
    primeChain.push(second.toString());
    for (let i = 2; i < chainLength; i+=2) {
      first = first.multiply(Prime.BI_TWO).add(Prime.BI_ONE);
      primeChain.push(first.toString());
      second = second.multiply(Prime.BI_TWO).subtract(Prime.BI_ONE);
      primeChain.push(second.toString());
      if (i + 1 === chainLength) {
        first = first.multiply(Prime.BI_TWO).add(Prime.BI_ONE);
        primeChain.push(first.toString());
      }
    }
  }else {
    console.error("Invalid chain type found");
    process.exit();
  }

  return primeChain.join(",");
}

// Print usage if wrong command line arguments
if (process.argv.length !== 3) {
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <primes.json>`);
  console.error("Prime JSON file should be first generated from tcpPrimeMiner.js");
  process.exit();
}

// Parse JSON
let chainInfo = JSON.parse(readFileSync(process.argv[2]));
let chains = [];

// Exit if nothing found from expected filled array
if (chainInfo.length < 1) {
  console.error("No elements found in parsed JSON array");
  process.exit();
}

// Exit if wrong object property found, maybe prime chains are already built?
if (!chainInfo[0].hasOwnProperty("blockHeaderHash")) {
  console.error("Parsed JSON is missing required properties, maybe this file already has its prime chains built?");
  process.exit();
}

chainInfo.forEach((block) => {
  // Compute origin number
  let origin = new BigInteger(block.blockHeaderHash).multiply(new BigInteger(block.primeMultiplier));
  
  // Build and return prime chain as comma delimited string
  let primeChain = buildChain(origin, block.primeChainLength, block.primeChainType);
  
  // Change chain type to style Primecoin uses for display
  let type = "";
  if (block.primeChainType === PrimeBlockchain.CUNNINGHAM_CHAIN_1) {
    type = "1CC";
  }else if (block.primeChainType === PrimeBlockchain.CUNNINGHAM_CHAIN_2) {
    type = "2CC";
  }else if (block.primeChainType === PrimeBlockchain.BITWIN_CHAIN) {
    type = "TWN";
  }else {
    console.error("Invalid chain type found");
    process.exit();
  }

  // Add built chain to array
  chains.push({
    blockID: block.blockNumber,
    hash: block.blockHash,
    type: type,
    length: block.primeChainLength,
    digits: origin.toString().length,
    primeOrigin: origin.toString(),
    primeChain: primeChain,
  });
});

writeFileSync(process.argv[2], JSON.stringify(chains));
