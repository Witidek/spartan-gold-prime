# SpartanGoldPrime

SpartanGoldPrime (SG) is a proof-of-work alternative using prime number chains for the simplif    ied cryptocurrency SpartanGold.

https://github.com/taustin/spartan-gold

The proof-of-work concept is inspired by Primecoin, but keeps the simplicity of SpartanGold.

https://github.com/primecoin/primecoin

## Dependencies
This project requires Node.js, SpartanGold, and all of SpartanGold's dependencies. After cloning this repository you can fetch dependencies with:

``
$ npm update
``

## Implementation Details at a Glance
Cunningham chains of both kinds and bi-twin chains are the accepted types of prime chains.
https://en.wikipedia.org/wiki/Cunningham_chain
https://en.wikipedia.org/wiki/Bi-twin_chain

Primality tests for prime numbers and prime chains include Fermat's little theorem, Lifchitz's generalization of the Euler-Lagrange thereom, and Miller-Rabin primality test.
https://en.wikipedia.org/wiki/Fermat_primality_test
http://www.primenumbers.net/Henri/us/NouvTh1us.htm
https://en.wikipedia.org/wiki/Miller%E2%80%93Rabin_primality_test

Default prime chain target length is 3 and there is no scaling difficulty.

Prime chain origin generation is aided by multiplying the base number with a fixed primorial of 7# = 210 similar to Primecoin's implementation, but does not use a sieve to find better prime chain origin candidates.

For some more details on prime chains and the project implementation, see `report.pdf`.

## Using SpartanGoldPrime

Like SpartanGold, SpartanGoldPrime can be run in either single-threaded mode with miners and clients in the same process, or multi-process mode. See SpartanGold's README for details.

### Single-threaded Mode
Same as base project SpartanGold, run in command line:

``
$ node driver.js
``

### Multi-process Mode

SpartanGoldPrime adds a user option to the TCP mining client to export prime chain data discovered into a JSON file named by the user. Start by running the new TCP client with any example miner config from SpartanGold.

``` fundamental
$ node tcpPrimeMiner.js node_modules/spartan-gold/sampleConfigs/minnie.json

Starting Minnie

  Funds: 501
  Address: hDDXlpBFlnKViXVhbpJbf+tua7F8yMPIYtjJ+8KbWbk=
  Pending transactions: 
  
  What would you like to do?
  *(c)onnect to miner?
  *(t)ransfer funds?
  *(r)esend pending transactions?
  *show (b)alances?
  #save all (p)rime chains found?
  *show blocks for (d)ebugging and exit?
  *e(x)it?
  
  Your choice:

```

Choose p to dump prime chain info to JSON. This new JSON file does not have complete prime chains enumerated out and needs to be built. The mining client does not take the time to build the full prime chains as it is usually busy trying to mine said prime chains in the background. To build the prime chains from a file `primes.json`, run in command line:

``
$ node buildPrimeChains.js primes.json
``

This script will overwrite the file and build all prime chains with format similar to how PRIMES.ZONE represents prime chains from Primecoin.

https://primes.zone

