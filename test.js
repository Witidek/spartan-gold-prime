"use strict";

const assert = require('chai').assert;
const BigInteger = require('jsbn').BigInteger;
const { Transaction, utils } = require('spartan-gold');

const PrimeBlock = require('./primeBlock.js');
const PrimeBlockchain = require('./primeBlockchain.js');
const PrimeClient = require('./primeClient.js');
const PrimeMiner = require('./primeMiner.js');
const Prime = require('./prime.js');


// Generating keypair for multiple test cases, since key generation is slow.
const kp = utils.generateKeypair();
let addr = utils.calcAddress(kp.public);

// Adding a POW target that should be trivial to match.
const EASY_POW_TARGET = 1;

// Setting blockchain configuration.  (Usually this would be done during the creation of the genesis block.)
PrimeBlockchain.makeGenesis({ blockClass: PrimeBlock, transactionClass: Transaction });

describe('utils', () => {
  describe('.verifySignature', () => {
    let sig = utils.sign(kp.private, "hello");
    it('should accept a valid signature', () => {
      assert.ok(utils.verifySignature(kp.public, "hello", sig));
    });

    it('should reject an invalid signature', () => {
      assert.ok(!utils.verifySignature(kp.public, "goodbye", sig));
    });
  });
});

describe("Transaction", () => {
  let outputs = [{amount: 20, address: "ffff"},
                 {amount: 40, address: "face"}];
  let t = new Transaction({from: addr, pubKey: kp.public, outputs: outputs, fee: 1, nonce: 1});
  t.sign(kp.private);

  describe("#totalOutput", () => {
    it('should sum up all of the outputs and the transaction fee', () => {
      assert.equal(t.totalOutput(), 61);
    });
  });

});

describe('PrimeBlock', () => {
  let prevBlock = new PrimeBlock("8e7912");
  prevBlock.balances = new Map([ [addr, 500], ["ffff", 100], ["face", 99] ]);

  let outputs = [{amount: 20, address: "ffff"}, {amount: 40, address: "face"}];
  let t = new Transaction({from: addr, pubKey: kp.public, outputs: outputs, fee: 1, nonce: 0});

  describe('#addTransaction', () => {
    it("should fail if a transaction is not signed.", () => {
      let b = new PrimeBlock(addr, prevBlock);
      let tx = new Transaction(t);
      assert.isFalse(b.addTransaction(tx));
    });

    it("should fail if the 'from' account does not have enough gold.", () => {
      let b = new PrimeBlock(addr, prevBlock);
      let tx = new Transaction(t);
      tx.outputs = [{amount:20000000000000, address: "ffff"}];
      tx.sign(kp.private);
      assert.isFalse(b.addTransaction(tx));
    });

    it("should transfer gold from the sender to the receivers.", () => {
      let b = new PrimeBlock(addr, prevBlock);
      let tx = new Transaction(t);
      tx.sign(kp.private);
      b.addTransaction(tx);
      assert.equal(b.balances.get(addr), 500-61); // Extra 1 for transaction fee.
      assert.equal(b.balances.get("ffff"), 100+20);
      assert.equal(b.balances.get("face"), 99+40);
    });

    it("should ignore any transactions that were already received in a previous block.", () => {
      let b = new PrimeBlock(addr, prevBlock);
      let tx = new Transaction(t);
      tx.sign(kp.private);
      b.addTransaction(tx);

      // Attempting to add transaction to subsequent block.
      let b2 = new PrimeBlock(addr, b);
      b2.addTransaction(tx);
      assert.isEmpty(b2.transactions);
    });
  });

  describe('#rerun', () => {
    it("should redo transactions to return to the same block.", () => {
      let b = new PrimeBlock(addr, prevBlock);

      let tx = new Transaction(t);
      tx.sign(kp.private);
      b.addTransaction(tx);

      // Wiping out balances and then rerunning the block
      b.balances = new Map();
      b.rerun(prevBlock);

      // Verifying prevBlock's balances are unchanged.
      assert.equal(prevBlock.balances.get(addr), 500);
      assert.equal(prevBlock.balances.get("ffff"), 100);
      assert.equal(prevBlock.balances.get("face"), 99);

      // Verifying b's balances are correct.
      assert.equal(b.balances.get(addr), 500-61);
      assert.equal(b.balances.get("ffff"), 100+20);
      assert.equal(b.balances.get("face"), 99+40);
    });

    it("should take a serialized/deserialized block and get back the same block.", () => {
      let b = new PrimeBlock(addr, prevBlock);

      let tx = new Transaction(t);
      tx.sign(kp.private);
      b.addTransaction(tx);

      let hash = b.hashVal();

      let serialBlock = b.serialize();
      let o = JSON.parse(serialBlock);
      let b2 = PrimeBlockchain.deserializeBlock(o);
      b2.rerun(prevBlock);

      // Verify hashes still match
      assert.equal(b2.hashVal(), hash);

      assert.equal(b2.balances.get(addr), 500-61);
      assert.equal(b2.balances.get("ffff"), 100+20);
      assert.equal(b2.balances.get("face"), 99+40);
    });
  });

  describe('#hashHeader', () => {
    it("should not be the same as hashVal/id (hash of entire block).", () => {
      let b = new PrimeBlock(addr, prevBlock);

      let blockHeaderHash = b.hashHeader();
      let blockHash = b.hashVal();

      assert.notEqual(blockHeaderHash, blockHash);
    });

    it("should give a different result if block nonce is changed.", () => {
      let b = new PrimeBlock(addr, prevBlock);

      let firstHash = b.hashHeader();
      b.primeNonce++;
      let secondHash = b.hashHeader();

      assert.notEqual(firstHash, secondHash);
    });
  });

  describe('#hasValidProof', () => {
    it("should not accept faulty proof certificate (negative multiplier, short chain length).", () => {
      let b = new PrimeBlock(addr, prevBlock);

      b.primeMultiplier = new BigInteger("0");
      b.primeChainLength = 0;

      assert.isFalse(b.hasValidProof());
    }); 
  });
});

describe('PrimeClient', () => {
  let genesis = new PrimeBlock("8e7912");
  genesis.balances = new Map([ [addr, 500], ["ffff", 100], ["face", 99] ]);
  let net = { broadcast: function(){} };

  let outputs = [{amount: 20, address: "ffff"}, {amount: 40, address: "face"}];
  let t = new Transaction({from: addr, pubKey: kp.public, outputs: outputs, fee: 1, nonce: 0});
  t.sign(kp.private);

  let outputs2 = [{amount: 10, address: "face"}];
  let t2 = new Transaction({from: addr, pubKey: kp.public, outputs: outputs2, fee: 1, nonce: 1});
  t2.sign(kp.private);

  let clint = new PrimeClient({net: net, startingBlock: genesis});
  clint.log = function(){};

  let miner = new PrimeMiner({name: "Minnie", net: net, startingBlock: genesis});
  miner.log = function(){};

  describe('#receiveBlock', () => {
    it("should reject any block without a valid proof.", () => {
      let b = new PrimeBlock(addr, genesis);
      b.addTransaction(t);
      // Receiving and verifying block
      b = clint.receiveBlock(b);
      assert.isNull(b);
    });

    it("should store all valid blocks, but only change lastBlock if the newer block is better.", () => {
      let b = new PrimeBlock(addr, genesis, EASY_POW_TARGET);
      b.addTransaction(t);
      // Finding a proof.
      miner.currentBlock = b;

      miner.findProof();
      // Receiving and verifying block
      clint.receiveBlock(b);
      assert.equal(clint.blocks.get(b.id), b);
      assert.equal(clint.lastBlock, b);

      let b2 = new PrimeBlock(addr, b, EASY_POW_TARGET);
      b2.addTransaction(t2);
      // Finding a proof.
      miner.currentBlock = b2;

      miner.findProof();
      // Receiving and verifying block
      clint.receiveBlock(b2);
      assert.equal(clint.blocks.get(b2.id), b2);
      assert.equal(clint.lastBlock, b2);

      let bAlt = new PrimeBlock(addr, genesis, EASY_POW_TARGET);
      bAlt.addTransaction(t2);
      // Finding a proof.
      miner.currentBlock = bAlt;

      miner.findProof();
      // Receiving and verifying block
      clint.receiveBlock(bAlt);
      assert.equal(clint.blocks.get(bAlt.id), bAlt);
      assert.equal(clint.lastBlock, b2);
    });
  });

  describe('Prime', () => {
    let prime1 = new BigInteger("2");
    let prime2 = new BigInteger("97");
    let prime3 = new BigInteger("67026081958959551441168950416445192340375003089599891848159881651712771889548358759525302759");
    let composite1 = new BigInteger("4");
    let composite2 = new BigInteger("100");
    let composite3 = new BigInteger("43254354352389257781273986594814904732849254353412");

    describe('#fermatPrimalityTest', () => {
      it("should pass pseudoprimes and fail obvious composites.", () => {
        assert(Prime.fermatPrimalityTest(prime1));
        assert(Prime.fermatPrimalityTest(prime2));
        assert(Prime.fermatPrimalityTest(prime3));
        assert.isFalse(Prime.fermatPrimalityTest(composite1));
        assert.isFalse(Prime.fermatPrimalityTest(composite2));
        assert.isFalse(Prime.fermatPrimalityTest(composite3));
      });
    });

    describe('#eulerLagrangePrimalityTest', () => {
      it("should pass pseudoprimes next in chain and fail obvious composites next in chain.", () => {
        assert(Prime.eulerLagrangePrimalityTest(prime1, PrimeBlockchain.CUNNINGHAM_CHAIN_1));
        assert(Prime.eulerLagrangePrimalityTest(prime2, PrimeBlockchain.CUNNINGHAM_CHAIN_2));
        assert(Prime.eulerLagrangePrimalityTest(prime3, PrimeBlockchain.CUNNINGHAM_CHAIN_1));
        assert.isFalse(Prime.eulerLagrangePrimalityTest(prime2, PrimeBlockchain.CUNNINGHAM_CHAIN_1));
      });
    });

    describe('#findPrimeChain', () => {
      it("should find chains for known example origins and fail on bad origins.", () => {
        let goodOrigin = new BigInteger("18");
        let badOrigin = new BigInteger("17");

        let { chainLength, chainType } = Prime.findPrimeChain(goodOrigin);
        assert(chainLength > 2);
        let o = Prime.findPrimeChain(badOrigin);
        assert(o.chainLength === 0);
      });
    });
  });
});
