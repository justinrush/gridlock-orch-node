## About the Orchestration Node

The orchestration node (orch node) is a crucial component of the Gridlock Network. It acts as the heart of the network, facilitating communication between clients and guardians. The orch node enables complex interactions such as creating new wallets or signing transactions.

While the orchestration node ensures the smooth operation of the system, it is important to note that it is not a gatekeeper. It cannot see any of the information being passed back and forth, maintaining the privacy and security of the data.

## Prerequisites

Before running the project, ensure you have the following installed:

#### 1. Install GMP and Node version 18

**MacOS:**

```sh
brew install gmp
brew install n
n 18
```

## Setup Orchestration Node

```sh
git clone https://github.com/GridlockNetwork/gridlock-orch-node
# add environment file .env with correct parameters to repo (see below)
yarn
yarn compile
yarn run dev
```
