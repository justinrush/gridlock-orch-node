import { pubToAddress } from 'ethereumjs-util';
import { PublicKey } from '@solana/web3.js';
import { IGuardian } from '../wallet.interfaces';
import { logger } from '../../logger';

/* eslint-disable import/prefer-default-export */
export const generateSessionId = () => {
  let sessionId = '';

  while (sessionId.length < 36) {
    if (sessionId.length === 8 || sessionId.length === 13 || sessionId.length === 18 || sessionId.length === 23) {
      sessionId += '-';
    } else {
      sessionId += Number(Math.random() * 10).toFixed(0)[0];
    }
  }

  return sessionId;
};

export const get3Nodes = (nodePool: IGuardian[]) => {
  const sortOrder = ['ownerGuardian', 'gridlockGuardian', 'partnerGuardian', 'userGuardian'];
  return nodePool
    .sort(function (a, b) {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return sortOrder.indexOf(a.type) - sortOrder.indexOf(b.type);
    })
    .slice(0, 3);
};

export const getEthereumKeyFromCurve = (curve: { x: any; y: any }): { address: string | null; pubKey: string | null } => {
  try {
    if (typeof curve === 'object' && curve.x && curve.y) {
      const bigString = `${curve.x}${curve.y}`;
      const buf = Buffer.from(bigString, 'hex');
      const address = pubToAddress(buf, true).toString('hex');
      return { address: `0x${address}`, pubKey: bigString };
    }
    return { address: null, pubKey: null };
  } catch (err) {
    return { address: null, pubKey: null };
  }
};

export const checkAllNodesAgreeOnResult = (resultPool: string[]) => {
  // Assume nodes initially agree (true)
  let allNodesAgree = true;
  let firstResult: { x: any; y: any } | undefined;

  resultPool.forEach((result) => {
    try {
      const ySum = JSON.parse(result).y_sum;

      if (typeof ySum === 'object' && ySum.x && ySum.y) {
        if (typeof firstResult === 'undefined') {
          firstResult = {
            x: ySum.x,
            y: ySum.y,
          };
          return;
        }
        // Check matches firstResult
        if (!(ySum.x === firstResult.x && ySum.y === firstResult.y)) {
          allNodesAgree = false;
        }
      }
    } catch (err) {
      logger.debug(`ERR: Invalid result format #0474957866. ${err}`);
    }
  });
  return allNodesAgree;
};

export const generateVValue = (recid: number, chainId: number) => {
  return recid + 35 + chainId * 2;
};

export const pkFromStringEDDSA = (publicKeyString: string) => {
  return new PublicKey(publicKeyString);
};

export const hexToBytes = (hex: string) => {
  let bytes;
  let c;
  for (bytes = [], c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
  return bytes;
};

export const blockchainToKeyType = (blockchain: string) => {
  let keyType;
  switch (blockchain) {
    case 'solana':
      keyType = 'EdDSA';
      break;
    case 'ethereum':
    case 'etheriumTest':
      keyType = 'ECDSA';
      break;
    case '2fa':
      keyType = 'TwoFA';
      break;
    case 'sr25519':
      keyType = 'Sr25519';
      break;
    default:
      keyType = null;
      break;
  }
  return keyType;
};
